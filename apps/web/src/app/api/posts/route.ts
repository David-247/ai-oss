import { NextResponse } from "next/server";
import {
  buildPostInsertRow,
  parsePostType,
  parseRankingMode,
  parseTopWindow,
  rankContent,
  type RankableContentItem,
} from "@ai-oss/discussions";
import {
  buildCursorWindow,
  cacheHeadersForPublicContent,
  pageFromRows,
} from "@ai-oss/performance";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { isRecord, loadZoneAccess, readString, readStringArray } from "@/lib/discussions-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const url = new URL(request.url);
  const zoneId = url.searchParams.get("zoneId");
  const pageWindow = buildCursorWindow({
    limit: url.searchParams.get("limit"),
    cursor: url.searchParams.get("cursor"),
    defaultLimit: 50,
    maxLimit: 100,
  });
  const user = await maybeAuthenticatedUser(request);
  if (!user.ok) {
    return user.response;
  }

  let includeMemberOnlyPosts = false;
  if (zoneId !== null) {
    const access = await loadZoneAccess(service.client, zoneId, user.userId);
    if (!access.ok) {
      return access.response;
    }
    if (!access.access.canRead) {
      return problem(403, "zone-read-denied", "Zone membership is required.");
    }
    includeMemberOnlyPosts = access.access.member !== null;
  }

  const mode = parseRankingMode(url.searchParams.get("sort") ?? url.searchParams.get("rank"));
  const topWindow = parseTopWindow(url.searchParams.get("window"));
  let query = service.client
    .from("posts")
    .select("*, profiles(username, display_name), zones(slug, name, visibility, status)")
    .is("deleted_at", null)
    .eq("status", "published")
    .neq("moderation_status", "removed")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(200, pageWindow.fetchLimit * (mode === "new" ? 1 : 4)));

  if (pageWindow.cursor !== null) {
    query = query.lt("created_at", pageWindow.cursor.sortValue);
  }

  if (zoneId !== null) {
    query = query.eq("zone_id", zoneId);
    if (!includeMemberOnlyPosts) {
      query = query.eq("visibility", "public");
    }
  } else {
    query = query.eq("visibility", "public");
  }

  const postType = url.searchParams.get("postType");
  if (postType !== null) {
    query = query.eq("post_type", parsePostType(postType));
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "posts-read-failed", error.message);
  }

  const ranked = rankContent((data ?? []).map(toRankablePost), {
    mode,
    topWindow,
    zoneId: zoneId ?? undefined,
  });

  const rowsById = new Map((data ?? []).map((post) => [readString(post.id), post]));
  const posts: Record<string, unknown>[] = ranked.flatMap((rank) => {
    const row = rowsById.get(rank.item.id);
    return row === undefined
      ? []
      : [
          {
            ...serializePost(row),
            rank_score: rank.rankScore,
            rankable_score: rank.rankableScore,
          },
        ];
  });
  const page = pageFromRows(posts, pageWindow, (post) => ({
    sortValue: readString(post.created_at),
    id: readString(post.id),
  }));

  return NextResponse.json(
    {
      posts: page.items,
      ranking: {
        mode,
        window: topWindow,
        scoreBasis: "certified_plus_non_suspicious_pending",
      },
      page: page.page,
    },
    {
      headers: cacheHeadersForPublicContent({
        personalized: user.userId !== null,
        moderationSensitive: false,
        feed: true,
      }),
    },
  );
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-post-request", "Expected a JSON object body.");
  }
  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "post_create",
    emailVerified: readEmailVerified(auth.user),
    similarityScore: readSimilarityScore(body),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const zoneId = readString(body.zoneId ?? body.zone_id) || null;
  const postType = parsePostType(body.postType ?? body.post_type);
  let defaultVisibility = "public" as const;
  if (zoneId !== null) {
    const access = await loadZoneAccess(service.client, zoneId, auth.user.id);
    if (!access.ok) {
      return access.response;
    }
    if (!access.access.canPost) {
      return problem(403, "post-create-denied", "Posting is not allowed for this zone.");
    }
    if (isModeratorOnlyPostType(postType) && !access.access.canModerate) {
      return problem(403, "post-type-requires-moderator", "This post type requires a moderator.");
    }
    defaultVisibility =
      access.access.zone.default_post_visibility === "zone" ||
      access.access.zone.default_post_visibility === "private"
        ? access.access.zone.default_post_visibility
        : "public";
  } else if (isModeratorOnlyPostType(postType)) {
    return problem(403, "post-type-requires-zone", "Moderator post types require a zone.");
  }

  let row;
  try {
    row = buildPostInsertRow({
      authorId: auth.user.id,
      zoneId,
      postType,
      title: readString(body.title),
      body: readString(body.body),
      url: readString(body.url),
      tags: readStringArray(body.tags),
      visibility:
        body.visibility === "public" || body.visibility === "zone" || body.visibility === "private"
          ? body.visibility
          : defaultVisibility,
      flairId: readString(body.flairId ?? body.flair_id) || null,
      pollOptions: readStringArray(body.pollOptions ?? body.poll_options),
      voteVisibilityWindowHours: clampNumber(
        body.voteVisibilityWindowHours ?? body.vote_visibility_window_hours,
        0,
        72,
        0,
      ),
    });
  } catch (error) {
    return problem(
      400,
      "invalid-post-draft",
      error instanceof Error ? error.message : "Post draft is invalid.",
    );
  }

  const { data, error } = await service.client.from("posts").insert(row).select("*").single();
  if (error !== null) {
    return problem(400, "post-create-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, post: serializePost(data) },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function maybeAuthenticatedUser(request: Request) {
  const hasToken =
    request.headers.get("authorization") !== null ||
    (request.headers.get("cookie") ?? "").includes("sb-access-token=");
  if (!hasToken) {
    return { ok: true as const, userId: null };
  }

  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth;
  }
  return { ok: true as const, userId: auth.user.id };
}

function toRankablePost(row: Record<string, unknown>): RankableContentItem {
  return {
    id: readString(row.id),
    createdAt: readString(row.created_at),
    updatedAt: readString(row.updated_at),
    lastActivityAt: readString(row.updated_at),
    zoneId: readString(row.zone_id) || null,
    score: Number(row.score ?? 0),
    certifiedScore: Number(row.certified_score ?? 0),
    commentCount: Number(row.comment_count ?? 0),
  };
}

function serializePost(row: Record<string, unknown>) {
  const hiddenUntil = readString(row.vote_visibility_until);
  const scoreHidden = hiddenUntil.length > 0 && new Date(hiddenUntil).getTime() > Date.now();
  return {
    ...row,
    score: scoreHidden ? null : row.score,
    certified_score: scoreHidden ? null : row.certified_score,
    score_hidden: scoreHidden,
  };
}

function isModeratorOnlyPostType(postType: string): boolean {
  return postType === "announcement" || postType === "safety_notice";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function readSimilarityScore(body: Record<string, unknown>): number | undefined {
  const score = Number(body.similarityScore ?? body.similarity_score);
  return Number.isFinite(score) ? score : undefined;
}
