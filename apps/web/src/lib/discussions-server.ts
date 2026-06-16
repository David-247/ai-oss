import { buildPublicVoteSummary, type VoteState, type VoteTargetType } from "@ai-oss/discussions";
import type { SupabaseClient } from "@ai-oss/auth";
import { problem } from "@/lib/auth-server";

type SupabaseServiceClient = SupabaseClient;

export interface ZoneAccess {
  zone: Record<string, unknown>;
  member: Record<string, unknown> | null;
  canRead: boolean;
  canPost: boolean;
  canModerate: boolean;
  memberIsMuted: boolean;
}

export async function loadZoneAccess(
  client: SupabaseServiceClient,
  zoneId: string,
  userId: string | null,
) {
  const zone = await client
    .from("zones")
    .select("id, visibility, status, deleted_at, default_post_visibility")
    .eq("id", zoneId)
    .maybeSingle();
  if (zone.error !== null) {
    return { ok: false as const, response: problem(400, "zone-read-failed", zone.error.message) };
  }
  if (zone.data === null || zone.data.deleted_at !== null || zone.data.status !== "active") {
    return { ok: false as const, response: problem(404, "zone-not-found", "Zone does not exist.") };
  }

  const member = userId
    ? await client
        .from("zone_members")
        .select("member_role, status")
        .eq("zone_id", zoneId)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null, error: null };
  if (member.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "zone-member-read-failed", member.error.message),
    };
  }

  const status = readString(member.data?.status);
  if (status === "banned") {
    return {
      ok: false as const,
      response: problem(403, "zone-access-denied", "Zone membership is banned."),
    };
  }

  const role = readString(member.data?.member_role);
  const activeMember = status === "active";
  const readableMember = status === "active" || status === "muted";
  const publicZone = zone.data.visibility === "public";

  return {
    ok: true as const,
    access: {
      zone: zone.data,
      member: member.data,
      canRead: publicZone || readableMember,
      canPost: userId !== null && (publicZone ? status !== "muted" : activeMember),
      canModerate: activeMember && (role === "moderator" || role === "admin"),
      memberIsMuted: status === "muted",
    } satisfies ZoneAccess,
  };
}

export async function loadPostAccess(
  client: SupabaseServiceClient,
  postId: string,
  userId: string | null,
) {
  const post = await client.from("posts").select("*").eq("id", postId).maybeSingle();
  if (post.error !== null) {
    return { ok: false as const, response: problem(400, "post-read-failed", post.error.message) };
  }
  if (post.data === null || post.data.deleted_at !== null) {
    return { ok: false as const, response: problem(404, "post-not-found", "Post does not exist.") };
  }

  const authorOwnsPost = userId !== null && post.data.author_id === userId;
  const zoneId = readString(post.data.zone_id) || null;
  let zoneAccess: ZoneAccess | null = null;
  if (zoneId !== null) {
    const access = await loadZoneAccess(client, zoneId, userId);
    if (!access.ok) {
      return access;
    }
    zoneAccess = access.access;
  }

  const isVisibleStatus =
    post.data.status === "published" && post.data.moderation_status !== "removed";
  const canRead =
    authorOwnsPost ||
    (isVisibleStatus &&
      (zoneAccess === null
        ? post.data.visibility === "public"
        : postVisibilityAllowsRead(
            readString(post.data.visibility),
            readString(zoneAccess.zone.visibility),
            zoneAccess.canRead,
          )));

  return {
    ok: true as const,
    post: post.data as Record<string, unknown>,
    zoneAccess,
    authorOwnsPost,
    canRead,
    canComment:
      canRead &&
      post.data.status === "published" &&
      post.data.is_locked !== true &&
      zoneAccess?.memberIsMuted !== true,
    canModerate: zoneAccess?.canModerate ?? false,
  };
}

export async function loadCommentAccess(
  client: SupabaseServiceClient,
  commentId: string,
  userId: string | null,
) {
  const comment = await client.from("comments").select("*").eq("id", commentId).maybeSingle();
  if (comment.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "comment-read-failed", comment.error.message),
    };
  }
  if (comment.data === null || comment.data.deleted_at !== null) {
    return {
      ok: false as const,
      response: problem(404, "comment-not-found", "Comment does not exist."),
    };
  }

  const authorOwnsComment = userId !== null && comment.data.author_id === userId;
  const postId = readString(comment.data.post_id);
  if (postId) {
    const postAccess = await loadPostAccess(client, postId, userId);
    if (!postAccess.ok) {
      return postAccess;
    }
    return {
      ok: true as const,
      comment: comment.data as Record<string, unknown>,
      authorOwnsComment,
      canRead:
        authorOwnsComment ||
        (postAccess.canRead &&
          comment.data.status === "published" &&
          comment.data.moderation_status !== "removed"),
      canEdit:
        authorOwnsComment &&
        comment.data.is_locked !== true &&
        postAccess.post.is_locked !== true &&
        comment.data.status === "published",
      canModerate: postAccess.canModerate,
      zoneId: readString(postAccess.post.zone_id) || null,
      postId,
    };
  }

  const paperId = readString(comment.data.paper_id);
  if (!paperId) {
    return {
      ok: false as const,
      response: problem(400, "comment-target-missing", "Comment target is missing."),
    };
  }

  const paper = await client
    .from("papers")
    .select("id, zone_id, status, moderation_status, deleted_at")
    .eq("id", paperId)
    .maybeSingle();
  if (paper.error !== null || paper.data === null || paper.data.deleted_at !== null) {
    return {
      ok: false as const,
      response: problem(404, "paper-not-found", "Paper does not exist."),
    };
  }

  const zoneId = readString(paper.data.zone_id) || null;
  const zoneAccess = zoneId === null ? null : await loadZoneAccess(client, zoneId, userId);
  if (zoneAccess !== null && !zoneAccess.ok) {
    return zoneAccess;
  }
  const canReadPaper =
    paper.data.status === "published" &&
    paper.data.moderation_status !== "removed" &&
    (zoneAccess === null || zoneAccess.access.canRead);

  return {
    ok: true as const,
    comment: comment.data as Record<string, unknown>,
    authorOwnsComment,
    canRead:
      authorOwnsComment ||
      (canReadPaper &&
        comment.data.status === "published" &&
        comment.data.moderation_status !== "removed"),
    canEdit:
      authorOwnsComment && comment.data.is_locked !== true && comment.data.status === "published",
    canModerate: zoneAccess?.access.canModerate ?? false,
    zoneId,
    postId: null,
  };
}

export async function refreshPostCommentCount(client: SupabaseServiceClient, postId: string) {
  const counted = await client
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)
    .eq("status", "published")
    .is("deleted_at", null);
  if (counted.error !== null) {
    return counted;
  }
  return client
    .from("posts")
    .update({ comment_count: counted.count ?? 0 })
    .eq("id", postId);
}

export async function refreshVoteTargetScores(
  client: SupabaseServiceClient,
  targetType: VoteTargetType,
  targetId: string,
  scoreHiddenUntil?: string | null,
) {
  const summaryResult = await loadVoteSummary(client, targetType, targetId, scoreHiddenUntil);
  if (!summaryResult.ok) {
    return summaryResult;
  }
  const { summary } = summaryResult;

  if (targetType === "post") {
    const updated = await client
      .from("posts")
      .update({ score: summary.score, certified_score: summary.certifiedScore })
      .eq("id", targetId);
    if (updated.error !== null) {
      return {
        ok: false as const,
        response: problem(400, "post-score-update-failed", updated.error.message),
      };
    }
  }
  if (targetType === "comment") {
    const updated = await client
      .from("comments")
      .update({ score: summary.score, certified_score: summary.certifiedScore })
      .eq("id", targetId);
    if (updated.error !== null) {
      return {
        ok: false as const,
        response: problem(400, "comment-score-update-failed", updated.error.message),
      };
    }
  }

  return { ok: true as const, summary };
}

export async function loadVoteSummary(
  client: SupabaseServiceClient,
  targetType: VoteTargetType,
  targetId: string,
  scoreHiddenUntil?: string | null,
) {
  const votes = await client
    .from("votes")
    .select("user_id, target_type, target_id, value, is_certified, suspicious_score")
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (votes.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "votes-read-failed", votes.error.message),
    };
  }

  const voteStates = readVoteStates(votes.data ?? []);
  const summary = buildPublicVoteSummary(
    voteStates,
    {
      targetType,
      targetId,
    },
    {
      scoreHiddenUntil,
      fuzz: true,
    },
  );

  return { ok: true as const, summary };
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => readString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readVoteStates(rows: readonly Record<string, unknown>[]): VoteState[] {
  return rows.flatMap((row) => {
    const targetType = row.target_type;
    if (
      targetType !== "post" &&
      targetType !== "comment" &&
      targetType !== "paper" &&
      targetType !== "paper_review" &&
      targetType !== "replication_report"
    ) {
      return [];
    }
    const userId = readString(row.user_id);
    const targetId = readString(row.target_id);
    const value = Number(row.value);
    if (!userId || !targetId || (value !== 1 && value !== -1)) {
      return [];
    }
    return [
      {
        userId,
        targetType,
        targetId,
        value,
        isCertified: row.is_certified === true,
        suspiciousScore: Number(row.suspicious_score ?? 0),
      },
    ];
  });
}

function postVisibilityAllowsRead(
  postVisibility: string,
  zoneVisibility: string,
  canReadZone: boolean,
): boolean {
  if (zoneVisibility !== "public") {
    return canReadZone;
  }
  return postVisibility === "public" || canReadZone;
}
