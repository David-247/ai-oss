import { NextResponse } from "next/server";
import {
  AUTOMOD_RULE_STATUSES,
  buildAutomodRuleInsertRow,
  buildAutomodRuleLifecyclePatch,
  buildAutomodRuleUpdatePatch,
  normalizeStoredAutomodRule,
  parseAutomodRuleSource,
  type AutomodRuleStatus,
} from "@ai-oss/moderation";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { isRecord, readRequestBody } from "@/lib/permissions-server";
import { readString } from "@/lib/discussions-server";
import {
  auditModerationEvent,
  moderationReadableZoneFilter,
  requireAutomodManage,
  requireModerationSession,
  requireReadModeration,
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
  const zoneId = readString(url.searchParams.get("zoneId")) || null;
  const access = requireReadModeration(session.viewer, zoneId);
  if (!access.ok) {
    return access.response;
  }
  const status = readRuleStatus(url.searchParams.get("status"));
  const filter = moderationReadableZoneFilter(session.viewer, zoneId);

  let query = service.client
    .from("automod_rules")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(clampNumber(url.searchParams.get("limit"), 1, 100, 50));
  if (status !== null) {
    query = query.eq("status", status);
  }
  if (filter.zoneIds.length > 0) {
    query =
      filter.zoneIds.length === 1
        ? query.eq("zone_id", filter.zoneIds[0])
        : query.in("zone_id", filter.zoneIds);
  } else if (!filter.global) {
    return problem(403, "automod-rules-denied", "No readable moderation zones.");
  } else if (zoneId === null && url.searchParams.get("globalOnly") === "true") {
    query = query.is("zone_id", null);
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "automod-rules-read-failed", error.message);
  }
  return NextResponse.json(
    {
      rules: (data ?? []).map((row) => ({
        ...row,
        parsed: tryParseStoredRule(row),
      })),
      statuses: AUTOMOD_RULE_STATUSES,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
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
    return problem(400, "invalid-automod-rule-request", "Expected a JSON object body.");
  }

  const zoneId = readString(body.zoneId ?? body.zone_id) || null;
  const access = requireAutomodManage(session.viewer, zoneId);
  if (!access.ok) {
    return access.response;
  }

  const source = readRuleSource(body);
  let row;
  try {
    const rule = parseAutomodRuleSource(source);
    row = buildAutomodRuleInsertRow({
      rule,
      zoneId,
      createdBy: session.auth.user.id,
      source: typeof source === "string" ? source : JSON.stringify(source, null, 2),
      status: readRuleStatus(body.status) ?? "draft",
    });
  } catch (error) {
    return problem(
      400,
      "invalid-automod-rule",
      error instanceof Error ? error.message : "AutoMod rule is invalid.",
    );
  }

  const { data, error } = await service.client
    .from("automod_rules")
    .insert(row)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "automod-rule-create-failed", error.message);
  }
  await auditModerationEvent({
    client: service.client,
    request,
    viewer: session.viewer,
    action: "moderation.automod_rule_create",
    resourceType: "automod_rule",
    resourceId: readString(data.id),
    zoneId,
    newState: data,
    reason: "automod rule created",
  });

  return NextResponse.json(
    { ok: true, rule: data },
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
    return problem(400, "invalid-automod-rule-update", "Expected a JSON object body.");
  }
  const ruleId = readString(body.ruleId ?? body.rule_id ?? body.id);
  const existing = await service.client
    .from("automod_rules")
    .select("*")
    .eq("id", ruleId)
    .maybeSingle();
  if (existing.error !== null) {
    return problem(400, "automod-rule-read-failed", existing.error.message);
  }
  if (existing.data === null) {
    return problem(404, "automod-rule-not-found", "AutoMod rule does not exist.");
  }
  const zoneId = readString(existing.data.zone_id) || null;
  const access = requireAutomodManage(session.viewer, zoneId);
  if (!access.ok) {
    return access.response;
  }

  const lifecycleAction = readString(body.action);
  let patch: Record<string, unknown>;
  try {
    if (
      lifecycleAction === "update" ||
      body.rule !== undefined ||
      body.source !== undefined ||
      body.yaml !== undefined
    ) {
      const source = readRuleSource(body);
      const rule = parseAutomodRuleSource(source);
      patch = buildAutomodRuleUpdatePatch({
        rule,
        source: typeof source === "string" ? source : JSON.stringify(source, null, 2),
        status: readRuleStatus(body.status) ?? readRuleStatus(existing.data.status) ?? "draft",
      });
    } else if (
      lifecycleAction === "publish" ||
      lifecycleAction === "dry_run" ||
      lifecycleAction === "disable" ||
      lifecycleAction === "rollback" ||
      lifecycleAction === "archive"
    ) {
      patch = buildAutomodRuleLifecyclePatch({
        action: lifecycleAction,
        version: readVersion(body.version),
        rollbackOf: readString(body.rollbackOf ?? body.rollback_of) || ruleId,
      });
    } else {
      return problem(400, "invalid-automod-rule-action", "Unknown AutoMod rule lifecycle action.");
    }
  } catch (error) {
    return problem(
      400,
      "invalid-automod-rule-update-body",
      error instanceof Error ? error.message : "AutoMod rule update is invalid.",
    );
  }

  const { data, error } = await service.client
    .from("automod_rules")
    .update(patch)
    .eq("id", ruleId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "automod-rule-update-failed", error.message);
  }
  await auditModerationEvent({
    client: service.client,
    request,
    viewer: session.viewer,
    action: `moderation.automod_rule_${lifecycleAction || "update"}`,
    resourceType: "automod_rule",
    resourceId: ruleId,
    zoneId,
    previousState: existing.data,
    newState: data,
    reason: `automod rule ${lifecycleAction || "update"}`,
  });

  return NextResponse.json({ ok: true, rule: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const session = await requireModerationSession(request, service.client);
  if (!session.ok) {
    return session.response;
  }
  const url = new URL(request.url);
  const ruleId = readString(url.searchParams.get("ruleId"));
  const existing = await service.client
    .from("automod_rules")
    .select("*")
    .eq("id", ruleId)
    .maybeSingle();
  if (existing.error !== null) {
    return problem(400, "automod-rule-read-failed", existing.error.message);
  }
  if (existing.data === null) {
    return problem(404, "automod-rule-not-found", "AutoMod rule does not exist.");
  }
  const zoneId = readString(existing.data.zone_id) || null;
  const access = requireAutomodManage(session.viewer, zoneId);
  if (!access.ok) {
    return access.response;
  }

  const patch = buildAutomodRuleLifecyclePatch({ action: "archive" });
  const { data, error } = await service.client
    .from("automod_rules")
    .update(patch)
    .eq("id", ruleId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "automod-rule-archive-failed", error.message);
  }
  await auditModerationEvent({
    client: service.client,
    request,
    viewer: session.viewer,
    action: "moderation.automod_rule_archive",
    resourceType: "automod_rule",
    resourceId: ruleId,
    zoneId,
    previousState: existing.data,
    newState: data,
    reason: "automod rule archived",
  });

  return NextResponse.json({ ok: true, rule: data }, { headers: { "Cache-Control": "no-store" } });
}

function readRuleSource(body: Record<string, unknown>): string | Record<string, unknown> {
  const source = body.source ?? body.yaml ?? body.json ?? body.rule;
  if (typeof source === "string" || isRecord(source)) {
    return source;
  }
  return body;
}

function readRuleStatus(value: unknown): AutomodRuleStatus | null {
  const status = readString(value);
  return AUTOMOD_RULE_STATUSES.includes(status as AutomodRuleStatus)
    ? (status as AutomodRuleStatus)
    : null;
}

function readVersion(value: unknown): number | undefined {
  const version = Number(value);
  return Number.isFinite(version) && version > 0 ? Math.trunc(version) : undefined;
}

function tryParseStoredRule(row: Record<string, unknown>) {
  try {
    return normalizeStoredAutomodRule(row);
  } catch (error) {
    return {
      invalid: true,
      error: error instanceof Error ? error.message : "stored rule is invalid",
    };
  }
}

function clampNumber(value: string | null, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(number)));
}
