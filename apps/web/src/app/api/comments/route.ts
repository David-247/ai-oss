import { NextResponse } from "next/server";
import { buildCommentInsertRow, buildCommentTree } from "@ai-oss/discussions";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import {
  isRecord,
  loadPostAccess,
  loadZoneAccess,
  readString,
  refreshPostCommentCount,
} from "@/lib/discussions-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");
  const paperId = url.searchParams.get("paperId");
  if ((postId === null) === (paperId === null)) {
    return problem(400, "comment-target-required", "Provide exactly one of postId or paperId.");
  }

  const user = await maybeAuthenticatedUser(request);
  if (!user.ok) {
    return user.response;
  }

  if (postId !== null) {
    const access = await loadPostAccess(service.client, postId, user.userId);
    if (!access.ok) {
      return access.response;
    }
    if (!access.canRead) {
      return problem(403, "post-comments-read-denied", "Post comments are not visible.");
    }
  }

  if (paperId !== null) {
    const paperAccess = await ensurePaperCommentsReadable(service.client, paperId, user.userId);
    if (!paperAccess.ok) {
      return paperAccess.response;
    }
  }

  let query = service.client
    .from("comments")
    .select("*, profiles(username, display_name)")
    .eq("status", "published")
    .neq("moderation_status", "removed")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  query = postId !== null ? query.eq("post_id", postId) : query.eq("paper_id", paperId);

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "comments-read-failed", error.message);
  }

  return NextResponse.json(
    {
      comments: data ?? [],
      tree: buildCommentTree(data ?? []),
    },
    { headers: { "Cache-Control": "no-store" } },
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
    return problem(400, "invalid-comment-request", "Expected a JSON object body.");
  }
  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "comment_create",
    emailVerified: readEmailVerified(auth.user),
    similarityScore: readSimilarityScore(body),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const postId = readString(body.postId ?? body.post_id) || null;
  const paperId = readString(body.paperId ?? body.paper_id) || null;
  const parentCommentId = readString(body.parentCommentId ?? body.parent_comment_id) || null;

  if ((postId === null) === (paperId === null)) {
    return problem(400, "comment-target-required", "Provide exactly one of postId or paperId.");
  }

  if (postId !== null) {
    const access = await loadPostAccess(service.client, postId, auth.user.id);
    if (!access.ok) {
      return access.response;
    }
    if (!access.canComment) {
      return problem(403, "comment-create-denied", "This post is not open for comments.");
    }
  }

  if (paperId !== null) {
    const paperAccess = await ensurePaperCommentsReadable(service.client, paperId, auth.user.id);
    if (!paperAccess.ok) {
      return paperAccess.response;
    }
  }

  if (parentCommentId !== null) {
    const parent = await service.client
      .from("comments")
      .select("id, post_id, paper_id, status, is_locked")
      .eq("id", parentCommentId)
      .maybeSingle();
    if (parent.error !== null) {
      return problem(400, "parent-comment-read-failed", parent.error.message);
    }
    if (
      parent.data === null ||
      parent.data.status !== "published" ||
      parent.data.is_locked === true ||
      readString(parent.data.post_id) !== (postId ?? "") ||
      readString(parent.data.paper_id) !== (paperId ?? "")
    ) {
      return problem(409, "parent-comment-invalid", "Parent comment is not available.");
    }
  }

  let row;
  try {
    row = buildCommentInsertRow({
      authorId: auth.user.id,
      postId,
      paperId,
      paperVersionId: readString(body.paperVersionId ?? body.paper_version_id) || null,
      parentCommentId,
      body: readString(body.body),
    });
  } catch (error) {
    return problem(
      400,
      "invalid-comment-draft",
      error instanceof Error ? error.message : "Comment draft is invalid.",
    );
  }

  const { data, error } = await service.client.from("comments").insert(row).select("*").single();
  if (error !== null) {
    return problem(400, "comment-create-failed", error.message);
  }

  if (postId !== null) {
    await refreshPostCommentCount(service.client, postId);
  }

  return NextResponse.json(
    {
      ok: true,
      comment: data,
      permalink: `/api/comments/${data.id}`,
    },
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

async function ensurePaperCommentsReadable(
  client: Parameters<typeof loadZoneAccess>[0],
  paperId: string,
  userId: string | null,
) {
  const paper = await client
    .from("papers")
    .select("id, zone_id, status, moderation_status, deleted_at")
    .eq("id", paperId)
    .maybeSingle();
  if (paper.error !== null) {
    return { ok: false as const, response: problem(400, "paper-read-failed", paper.error.message) };
  }
  if (
    paper.data === null ||
    paper.data.deleted_at !== null ||
    paper.data.status !== "published" ||
    paper.data.moderation_status === "removed"
  ) {
    return {
      ok: false as const,
      response: problem(404, "paper-not-found", "Paper does not exist."),
    };
  }

  const zoneId = readString(paper.data.zone_id);
  if (!zoneId) {
    return { ok: true as const };
  }

  const access = await loadZoneAccess(client, zoneId, userId);
  if (!access.ok) {
    return access;
  }
  if (!access.access.canRead) {
    return {
      ok: false as const,
      response: problem(403, "paper-read-denied", "Paper zone membership is required."),
    };
  }
  return { ok: true as const };
}

function readSimilarityScore(body: Record<string, unknown>): number | undefined {
  const score = Number(body.similarityScore ?? body.similarity_score);
  return Number.isFinite(score) ? score : undefined;
}
