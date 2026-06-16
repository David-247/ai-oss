import { NextResponse } from "next/server";
import {
  buildVoteUpsertRow,
  parseVoteTargetType,
  parseVoteValue,
  type VoteTargetType,
} from "@ai-oss/discussions";
import { buildVoteCertificationPatch, classifyVoteAnomaly } from "@ai-oss/trust";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import {
  isRecord,
  loadCommentAccess,
  loadPostAccess,
  loadZoneAccess,
  loadVoteSummary,
  readString,
  refreshVoteTargetScores,
} from "@/lib/discussions-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const url = new URL(request.url);
  const target = readTarget(url.searchParams.get("targetType"), url.searchParams.get("targetId"));
  if (!target.ok) {
    return target.response;
  }
  const user = await maybeAuthenticatedUser(request);
  if (!user.ok) {
    return user.response;
  }

  const readable = await ensureVoteTargetReadable(
    service.client,
    target.targetType,
    target.targetId,
    user.userId,
  );
  if (!readable.ok) {
    return readable.response;
  }

  const summary = await loadVoteSummary(
    service.client,
    target.targetType,
    target.targetId,
    readable.scoreHiddenUntil,
  );
  if (!summary.ok) {
    return summary.response;
  }

  return NextResponse.json(
    {
      summary: summary.summary,
      privacy: {
        individualVotesExposed: false,
      },
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
    return problem(400, "invalid-vote-request", "Expected a JSON object body.");
  }

  const target = readTarget(body.targetType ?? body.target_type, body.targetId ?? body.target_id);
  if (!target.ok) {
    return target.response;
  }
  const readable = await ensureVoteTargetReadable(
    service.client,
    target.targetType,
    target.targetId,
    auth.user.id,
  );
  if (!readable.ok) {
    return readable.response;
  }

  const value = parseVoteValue(body.value ?? body.vote);
  if (body.action === "remove" || body.value === 0 || body.value === "0") {
    return removeVote(
      service.client,
      auth.user.id,
      target.targetType,
      target.targetId,
      readable.scoreHiddenUntil,
    );
  }
  if (value === null) {
    return problem(400, "invalid-vote-value", "Vote value must be upvote, downvote, 1, or -1.");
  }

  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: value === -1 ? "downvote_scale" : "vote",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const anomalyContext = body.anomalyContext ?? body.anomaly_context;
  const anomaly = await classifyVoteRequest(service.client, request, {
    userId: auth.user.id,
    targetType: target.targetType,
    targetId: target.targetId,
    value,
    trustScore: Number(trustGate.profile?.trust_score ?? 0),
    accountCreatedAt: readString(trustGate.profile?.created_at),
    context: isRecord(anomalyContext) ? anomalyContext : {},
  });
  const row = {
    ...buildVoteUpsertRow({
      userId: auth.user.id,
      targetType: target.targetType,
      targetId: target.targetId,
      value,
    }),
    ...buildVoteCertificationPatch(anomaly),
  };
  const { error } = await service.client
    .from("votes")
    .upsert(row, { onConflict: "user_id,target_type,target_id" });
  if (error !== null) {
    return problem(400, "vote-upsert-failed", error.message);
  }
  await applyVoteMitigations(service.client, target.targetType, target.targetId, anomaly);

  const summary = await refreshVoteTargetScores(
    service.client,
    target.targetType,
    target.targetId,
    readable.scoreHiddenUntil,
  );
  if (!summary.ok) {
    return summary.response;
  }

  return NextResponse.json(
    { ok: true, summary: summary.summary, certification: row.certification_status, anomaly },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  return POST(request);
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const url = new URL(request.url);
  const target = readTarget(url.searchParams.get("targetType"), url.searchParams.get("targetId"));
  if (!target.ok) {
    return target.response;
  }
  const readable = await ensureVoteTargetReadable(
    service.client,
    target.targetType,
    target.targetId,
    auth.user.id,
  );
  if (!readable.ok) {
    return readable.response;
  }

  return removeVote(
    service.client,
    auth.user.id,
    target.targetType,
    target.targetId,
    readable.scoreHiddenUntil,
  );
}

async function removeVote(
  client: Parameters<typeof refreshVoteTargetScores>[0],
  userId: string,
  targetType: VoteTargetType,
  targetId: string,
  scoreHiddenUntil: string | null,
) {
  const { error } = await client
    .from("votes")
    .delete()
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (error !== null) {
    return problem(400, "vote-remove-failed", error.message);
  }

  const summary = await refreshVoteTargetScores(client, targetType, targetId, scoreHiddenUntil);
  if (!summary.ok) {
    return summary.response;
  }

  return NextResponse.json(
    { ok: true, summary: summary.summary },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function classifyVoteRequest(
  client: Parameters<typeof refreshVoteTargetScores>[0],
  request: Request,
  input: {
    userId: string;
    targetType: VoteTargetType;
    targetId: string;
    value: -1 | 1;
    trustScore: number;
    accountCreatedAt: string;
    context: Record<string, unknown>;
  },
) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recentTargetVotes = await client
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId)
    .gte("created_at", since);
  const priorUserVotes = await client
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId);
  const externalReferrer = isExternalReferrer(request);

  return classifyVoteAnomaly({
    targetType: input.targetType,
    targetId: input.targetId,
    value: input.value,
    voterAccountAgeDays: accountAgeDays(input.accountCreatedAt),
    voterTrustScore: input.trustScore,
    voterPriorVoteCount: priorUserVotes.count ?? 0,
    voterZoneHistoryCount: readNumber(
      input.context.zoneHistoryCount ?? input.context.zone_history_count,
    ),
    votesInWindow: recentTargetVotes.count ?? 0,
    newAccountVoteRatio: readNumber(
      input.context.newAccountVoteRatio ?? input.context.new_account_vote_ratio,
    ),
    noZoneHistoryVoteRatio: readNumber(
      input.context.noZoneHistoryVoteRatio ?? input.context.no_zone_history_vote_ratio,
    ),
    sharedIpVoteCount: readNumber(
      input.context.sharedIpVoteCount ?? input.context.shared_ip_vote_count,
    ),
    sharedDeviceVoteCount: readNumber(
      input.context.sharedDeviceVoteCount ?? input.context.shared_device_vote_count,
    ),
    externalReferrerVoteCount: externalReferrer ? (recentTargetVotes.count ?? 0) : 0,
    abnormalTimingScore: readNumber(
      input.context.abnormalTimingScore ?? input.context.abnormal_timing_score,
    ),
    upvoteRatioShift: readNumber(
      input.context.upvoteRatioShift ?? input.context.upvote_ratio_shift,
    ),
    downvoteRatioShift: readNumber(
      input.context.downvoteRatioShift ?? input.context.downvote_ratio_shift,
    ),
    moderatorRemovalVote: input.context.moderatorRemovalVote === true,
  });
}

async function applyVoteMitigations(
  client: Parameters<typeof refreshVoteTargetScores>[0],
  targetType: VoteTargetType,
  targetId: string,
  anomaly: ReturnType<typeof classifyVoteAnomaly>,
) {
  const hideScore = anomaly.mitigations.find(
    (mitigation) => mitigation.type === "hide_scores_temporarily",
  );
  if (targetType !== "post" || hideScore === undefined) {
    return;
  }
  const durationSeconds = hideScore.durationSeconds ?? 24 * 60 * 60;
  await client
    .from("posts")
    .update({ vote_visibility_until: new Date(Date.now() + durationSeconds * 1000).toISOString() })
    .eq("id", targetId);
}

function readTarget(targetTypeInput: unknown, targetIdInput: unknown) {
  const targetType = parseVoteTargetType(targetTypeInput);
  const targetId = readString(targetIdInput);
  if (targetType === null || !targetId) {
    return {
      ok: false as const,
      response: problem(400, "vote-target-required", "Valid targetType and targetId are required."),
    };
  }
  return { ok: true as const, targetType, targetId };
}

function isExternalReferrer(request: Request): boolean {
  const referer = request.headers.get("referer");
  if (referer === null) {
    return false;
  }
  const host = request.headers.get("host");
  return Boolean(host && !referer.includes(host));
}

function accountAgeDays(createdAt: string): number {
  const created = createdAt ? new Date(createdAt) : new Date();
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / 86_400_000));
}

function readNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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

async function ensureVoteTargetReadable(
  client: Parameters<typeof refreshVoteTargetScores>[0],
  targetType: VoteTargetType,
  targetId: string,
  userId: string | null,
) {
  if (targetType === "post") {
    const access = await loadPostAccess(client, targetId, userId);
    if (!access.ok) {
      return access;
    }
    if (!access.canRead) {
      return {
        ok: false as const,
        response: problem(403, "vote-target-denied", "Post is not visible."),
      };
    }
    return {
      ok: true as const,
      scoreHiddenUntil: readString(access.post.vote_visibility_until) || null,
    };
  }

  if (targetType === "comment") {
    const access = await loadCommentAccess(client, targetId, userId);
    if (!access.ok) {
      return access;
    }
    if (!access.canRead) {
      return {
        ok: false as const,
        response: problem(403, "vote-target-denied", "Comment is not visible."),
      };
    }
    return { ok: true as const, scoreHiddenUntil: null };
  }

  if (targetType === "paper") {
    return ensurePaperReadable(client, targetId, userId);
  }

  const table = targetType === "paper_review" ? "paper_reviews" : "replication_reports";
  const target = await client
    .from(table)
    .select("id, paper_id, status, moderation_status, deleted_at")
    .eq("id", targetId)
    .maybeSingle();
  if (target.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "vote-target-read-failed", target.error.message),
    };
  }
  if (
    target.data === null ||
    target.data.deleted_at !== null ||
    target.data.status !== "published" ||
    target.data.moderation_status === "removed"
  ) {
    return {
      ok: false as const,
      response: problem(404, "vote-target-not-found", "Vote target does not exist."),
    };
  }
  return ensurePaperReadable(client, readString(target.data.paper_id), userId);
}

async function ensurePaperReadable(
  client: Parameters<typeof refreshVoteTargetScores>[0],
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
  if (zoneId) {
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
  }

  return { ok: true as const, scoreHiddenUntil: null };
}
