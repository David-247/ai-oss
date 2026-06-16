import { NextResponse } from "next/server";
import {
  buildAppealDecisionPatch,
  buildAppealInsertRow,
  isModerationActionAppealable,
  parseAppealStatus,
} from "@ai-oss/moderation";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { isRecord, readRequestBody } from "@/lib/permissions-server";
import { readString } from "@/lib/discussions-server";
import {
  auditModerationEvent,
  canReadModeration,
  requireModerationSession,
  requireUpdateModeration,
} from "@/lib/moderation-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const session = await requireModerationSession(request, service.client);
  if (!session.ok) {
    return session.response;
  }

  const url = new URL(request.url);
  const status = readString(url.searchParams.get("status"));
  const mine = url.searchParams.get("mine") !== "false";
  const actionId = readString(url.searchParams.get("actionId"));
  const limit = clampNumber(url.searchParams.get("limit"), 1, 100, 50);

  let query = service.client
    .from("appeals")
    .select("*, moderation_actions(*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) {
    const parsed = parseAppealStatus(status);
    if (parsed === null) {
      return problem(400, "invalid-appeal-status", "Appeal status is invalid.");
    }
    query = query.eq("status", parsed);
  }
  if (actionId) {
    query = query.eq("moderation_action_id", actionId);
  }
  if (mine) {
    query = query.eq("appellant_id", session.auth.user.id);
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "appeals-read-failed", error.message);
  }

  const appeals = (data ?? []).filter((appeal) => {
    if (mine) {
      return true;
    }
    const action = readJoinedAction(appeal);
    return canReadModeration(session.viewer, readString(action.zone_id) || null);
  });
  return NextResponse.json({ appeals }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const session = await requireModerationSession(request, service.client);
  if (!session.ok) {
    return session.response;
  }
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-appeal-request", "Expected a JSON object body.");
  }

  const moderationActionId = readString(body.moderationActionId ?? body.moderation_action_id);
  const action = await service.client
    .from("moderation_actions")
    .select("*")
    .eq("id", moderationActionId)
    .maybeSingle();
  if (action.error !== null) {
    return problem(400, "moderation-action-read-failed", action.error.message);
  }
  if (action.data === null) {
    return problem(404, "moderation-action-not-found", "Moderation action does not exist.");
  }
  if (!isModerationActionAppealable(action.data)) {
    return problem(
      409,
      "moderation-action-not-appealable",
      "This moderation action is not appealable.",
    );
  }

  let row;
  try {
    row = buildAppealInsertRow({
      moderationActionId,
      appellantId: session.auth.user.id,
      appealText: readString(body.appealText ?? body.body ?? body.appeal_text),
      evidence: isRecord(body.evidence) ? body.evidence : {},
      originalAction: action.data,
    });
  } catch (error) {
    return problem(
      400,
      "invalid-appeal",
      error instanceof Error ? error.message : "Appeal is invalid.",
    );
  }

  const { data, error } = await service.client.from("appeals").insert(row).select("*").single();
  if (error !== null) {
    return problem(400, "appeal-create-failed", error.message);
  }
  await auditModerationEvent({
    client: service.client,
    request,
    viewer: session.viewer,
    action: "moderation.appeal_create",
    resourceType: "appeal",
    resourceId: readString(data.id),
    zoneId: readString(action.data.zone_id) || null,
    newState: data,
    reason: "appeal submitted",
  });

  return NextResponse.json(
    { ok: true, appeal: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const session = await requireModerationSession(request, service.client);
  if (!session.ok) {
    return session.response;
  }
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-appeal-decision-request", "Expected a JSON object body.");
  }

  const appealId = readString(body.appealId ?? body.appeal_id);
  const appeal = await service.client
    .from("appeals")
    .select("*, moderation_actions(*)")
    .eq("id", appealId)
    .maybeSingle();
  if (appeal.error !== null) {
    return problem(400, "appeal-read-failed", appeal.error.message);
  }
  if (appeal.data === null) {
    return problem(404, "appeal-not-found", "Appeal does not exist.");
  }
  const action = readJoinedAction(appeal.data);
  const access = requireUpdateModeration(session.viewer, readString(action.zone_id) || null);
  if (!access.ok) {
    return access.response;
  }

  let patch;
  try {
    patch = buildAppealDecisionPatch({
      reviewerId: session.auth.user.id,
      status: body.status ?? body.decision,
      decisionReason: readString(body.decisionReason ?? body.decision_reason ?? body.reason),
      previousAuditTrail: appeal.data.audit_trail,
    });
  } catch (error) {
    return problem(
      400,
      "invalid-appeal-decision",
      error instanceof Error ? error.message : "Appeal decision is invalid.",
    );
  }

  const { data, error } = await service.client
    .from("appeals")
    .update(patch)
    .eq("id", appealId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "appeal-decision-failed", error.message);
  }
  await auditModerationEvent({
    client: service.client,
    request,
    viewer: session.viewer,
    action: "moderation.appeal_decide",
    resourceType: "appeal",
    resourceId: appealId,
    zoneId: readString(action.zone_id) || null,
    previousState: appeal.data,
    newState: data,
    reason: readString(patch.decision_reason),
  });

  return NextResponse.json(
    { ok: true, appeal: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function readJoinedAction(appeal: Record<string, unknown>): Record<string, unknown> {
  const action = appeal.moderation_actions;
  if (Array.isArray(action)) {
    return isRecord(action[0]) ? action[0] : {};
  }
  return isRecord(action) ? action : {};
}

function clampNumber(value: string | null, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(number)));
}
