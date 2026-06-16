import { NextResponse } from "next/server";
import { buildModerationActionRow } from "@ai-oss/moderation";
import type { SupabaseClient } from "@ai-oss/auth";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { isRecord, readRequestBody } from "@/lib/permissions-server";
import { readString } from "@/lib/discussions-server";
import {
  auditModerationEvent,
  moderationReadableZoneFilter,
  requireModerationSession,
  requireReadModeration,
  requireUpdateModeration,
} from "@/lib/moderation-server";

export const runtime = "nodejs";

type SupabaseServiceClient = SupabaseClient;

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
  const zoneId = readString(url.searchParams.get("zoneId")) || null;
  const access = requireReadModeration(session.viewer, zoneId);
  if (!access.ok) {
    return access.response;
  }
  const filter = moderationReadableZoneFilter(session.viewer, zoneId);
  const targetType = readString(url.searchParams.get("targetType"));
  const targetId = readString(url.searchParams.get("targetId"));
  const limit = clampNumber(url.searchParams.get("limit"), 1, 100, 50);

  let query = service.client
    .from("moderation_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (targetType) {
    query = query.eq("target_type", targetType);
  }
  if (targetId) {
    query = query.eq("target_id", targetId);
  }
  if (filter.zoneIds.length > 0) {
    query =
      filter.zoneIds.length === 1
        ? query.eq("zone_id", filter.zoneIds[0])
        : query.in("zone_id", filter.zoneIds);
  } else if (!filter.global) {
    return problem(403, "moderation-actions-denied", "No readable moderation zones.");
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "moderation-actions-read-failed", error.message);
  }
  return NextResponse.json({ actions: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
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
    return problem(400, "invalid-moderation-action-request", "Expected a JSON object body.");
  }

  const zoneId = readString(body.zoneId ?? body.zone_id) || null;
  const access = requireUpdateModeration(session.viewer, zoneId);
  if (!access.ok) {
    return access.response;
  }

  let row;
  try {
    row = buildModerationActionRow({
      actorId: session.auth.user.id,
      targetType: body.targetType ?? body.target_type,
      targetId: readString(body.targetId ?? body.target_id),
      zoneId,
      action: body.action ?? body.actionType ?? body.action_type,
      reason: readString(body.reason),
      previousState: isRecord(body.previousState ?? body.previous_state)
        ? (body.previousState ?? body.previous_state)
        : null,
      newState: isRecord(body.newState ?? body.new_state)
        ? (body.newState ?? body.new_state)
        : null,
      expiresAt: readExpiresAt(body),
      automated: body.automated === true,
      correlationId: request.headers.get("x-correlation-id"),
      appealable: body.appealable === false ? false : undefined,
    });
  } catch (error) {
    return problem(
      400,
      "invalid-moderation-action",
      error instanceof Error ? error.message : "Moderation action is invalid.",
    );
  }

  const applied =
    body.apply === false
      ? { ok: true as const, applied: false }
      : await applyModerationAction(service.client, row);
  if (!applied.ok) {
    return applied.response;
  }

  const { data, error } = await service.client
    .from("moderation_actions")
    .insert(row)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "moderation-action-create-failed", error.message);
  }

  const reportId = readString(body.reportId ?? body.report_id);
  if (reportId) {
    await service.client
      .from("reports")
      .update({ status: "actioned", assigned_to: session.auth.user.id })
      .eq("id", reportId);
  }
  await auditModerationEvent({
    client: service.client,
    request,
    viewer: session.viewer,
    action: `moderation.${row.action_type}`,
    resourceType: row.target_type,
    resourceId: row.target_id,
    zoneId: row.zone_id,
    previousState: row.previous_state,
    newState: { action: data, applied },
    reason: row.reason,
    automated: row.automated,
  });

  return NextResponse.json(
    { ok: true, action: data, applied },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function applyModerationAction(
  client: SupabaseServiceClient,
  row: ReturnType<typeof buildModerationActionRow>,
) {
  const patch = buildTargetPatch(row);
  if (patch === null) {
    return { ok: true as const, applied: false, reason: "no_direct_target_patch" };
  }
  const { data, error } = await client
    .from(patch.table)
    .update(patch.values)
    .eq("id", row.target_id)
    .select("*")
    .single();
  if (error !== null) {
    return {
      ok: false as const,
      response: problem(400, "moderation-target-update-failed", error.message),
    };
  }
  return { ok: true as const, applied: true, table: patch.table, target: data };
}

function buildTargetPatch(row: ReturnType<typeof buildModerationActionRow>): {
  table: string;
  values: Record<string, unknown>;
} | null {
  const action = row.action_type;
  const reason = row.reason;
  const now = new Date().toISOString();

  if (row.target_type === "post") {
    if (action === "remove") {
      return {
        table: "posts",
        values: { status: "removed", moderation_status: "removed", removal_reason: reason },
      };
    }
    if (action === "lock") {
      return { table: "posts", values: { is_locked: true } };
    }
    if (action === "filter_to_queue") {
      return { table: "posts", values: { moderation_status: "flagged" } };
    }
    if (action === "hide_score") {
      return { table: "posts", values: { vote_visibility_until: addSeconds(24 * 60 * 60) } };
    }
  }

  if (row.target_type === "comment") {
    if (action === "remove") {
      return {
        table: "comments",
        values: { status: "removed", moderation_status: "removed", removal_reason: reason },
      };
    }
    if (action === "lock") {
      return { table: "comments", values: { is_locked: true } };
    }
    if (action === "filter_to_queue") {
      return { table: "comments", values: { moderation_status: "flagged" } };
    }
  }

  if (row.target_type === "chat_message") {
    if (action === "remove") {
      return {
        table: "chat_messages",
        values: { status: "removed", moderation_status: "removed", deleted_at: now },
      };
    }
    if (action === "filter_to_queue") {
      return { table: "chat_messages", values: { moderation_status: "flagged" } };
    }
  }

  if (row.target_type === "paper") {
    if (action === "remove") {
      return {
        table: "papers",
        values: { status: "removed_by_moderation", moderation_status: "removed", removed_at: now },
      };
    }
    if (action === "quarantine_paper_file" || action === "filter_to_queue") {
      return {
        table: "papers",
        values: { status: "quarantined", moderation_status: "quarantined" },
      };
    }
  }

  if (row.target_type === "paper_file") {
    if (action === "remove") {
      return { table: "files", values: { moderation_status: "removed" } };
    }
    if (action === "quarantine_paper_file" || action === "filter_to_queue") {
      return { table: "files", values: { moderation_status: "quarantined" } };
    }
  }

  if (row.target_type === "paper_review" || row.target_type === "replication_report") {
    const table = row.target_type === "paper_review" ? "paper_reviews" : "replication_reports";
    if (action === "remove") {
      return { table, values: { status: "removed", moderation_status: "removed" } };
    }
    if (action === "filter_to_queue") {
      return { table, values: { moderation_status: "flagged" } };
    }
  }

  if (row.target_type === "zone") {
    if (action === "remove") {
      return { table: "zones", values: { status: "removed", moderation_status: "removed" } };
    }
    if (action === "filter_to_queue") {
      return { table: "zones", values: { moderation_status: "flagged" } };
    }
  }

  if (row.target_type === "voice_participant") {
    if (action === "temporary_mute") {
      return {
        table: "voice_participants",
        values: { muted_at: now, cooldown_until: row.expires_at },
      };
    }
    if (action === "temporary_ban") {
      return {
        table: "voice_participants",
        values: { banned_at: now, cooldown_until: row.expires_at },
      };
    }
  }

  return null;
}

function readExpiresAt(body: Record<string, unknown>): string | null {
  const explicit = readString(body.expiresAt ?? body.expires_at);
  if (explicit) {
    return explicit;
  }
  const durationSeconds = Number(body.durationSeconds ?? body.duration_seconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }
  return addSeconds(durationSeconds);
}

function addSeconds(seconds: number): string {
  return new Date(Date.now() + Math.trunc(seconds) * 1000).toISOString();
}

function clampNumber(value: string | null, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(number)));
}
