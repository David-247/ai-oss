import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  adminActionForKey,
  adminPanelForSection,
  buildAdminAuditDescriptor,
  buildStatementOfReasons,
  type AdminActionKey,
} from "@ai-oss/admin";
import {
  RUNBOOKS,
  buildAdminOperationalSignals,
  observabilityCoverageSummary,
} from "@ai-oss/observability";
import { buildCostDashboardSummary } from "@ai-oss/performance";
import { buildBreakGlassMonitorEvent, evaluateAdminSessionSecurity } from "@ai-oss/security";
import type { HighRiskAction, PermissionScope } from "@ai-oss/permissions";
import {
  correlationIdFromRequest,
  insertAuditEvent,
  isRecord,
  readRequestBody,
  readString,
  requireHighRiskApproval,
  requirePermissionForRequest,
} from "@/lib/permissions-server";
import { problem } from "@/lib/auth-server";

export async function handleAdminGet(request: Request, section?: readonly string[]) {
  const panel = adminPanelForSection(section);
  const guard = await requirePermissionForRequest(request, panel.permission as PermissionScope);
  if (!guard.ok) {
    return guard.response;
  }

  const counts = await Promise.all(
    panel.tables.map(async (table) => {
      const result = await guard.service.from(table).select("id", { count: "exact", head: true });
      return {
        table,
        count: result.error === null ? (result.count ?? 0) : null,
        error: result.error?.message ?? null,
      };
    }),
  );

  return NextResponse.json(
    {
      panel,
      counts,
      observability: {
        coverage: observabilityCoverageSummary(),
        signals: buildAdminOperationalSignals({
          jobFailures: 0,
          queueBacklog: 0,
          legalDeadlinesDueSoon: 0,
          privacyDeadlinesDueSoon: 0,
          adminRoleChanges: 0,
          securityAlerts: countForTable(counts, "alert_events"),
        }),
        runbooks: panel.key === "security" ? RUNBOOKS : [],
      },
      cost: buildCostDashboardSummary({
        storageBytes: 0,
        voiceMinutes: 0,
        searchQueries: 0,
        embeddingJobs: 0,
        projectedMonthlyCostCents: 0,
        donationFundingCents: 0,
      }),
      statementOfReasonsTemplate: buildStatementOfReasons({
        action: "moderation_action",
        policy: "Community Guidelines",
        facts: ["target", "policy", "decision_reason"],
        appealable: true,
        jurisdiction: "platform",
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function countForTable(
  counts: readonly { table: string; count: number | null; error: string | null }[],
  table: string,
): number {
  return counts.find((entry) => entry.table === table)?.count ?? 0;
}

export async function handleAdminAction(request: Request, section?: readonly string[]) {
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-admin-action", "Expected a JSON object body.");
  }

  const actionKey = readString(body.action) as AdminActionKey;
  const definition = adminActionForKey(actionKey);
  if (definition === null) {
    return problem(400, "unknown-admin-action", "Unknown admin action.");
  }

  const panel = adminPanelForSection(section);
  const guard = await requirePermissionForRequest(request, definition.permission as PermissionScope);
  if (!guard.ok) {
    return guard.response;
  }

  const reason = readString(body.reason);
  if (reason.length < 8) {
    return problem(400, "admin-action-reason-required", "Admin actions require a reason.");
  }

  const adminSession = await requireElevatedAdminSession(guard, request, body, reason);
  if (!adminSession.ok) {
    return adminSession.response;
  }

  if (definition.highRisk) {
    const approval = requireHighRiskApproval({
      actor: guard.actor,
      action: highRiskActionForAdmin(actionKey),
      approvalActorIds: readStringArray(body.approvalActorIds ?? body.approval_actor_ids),
      ownerEmergency: body.ownerEmergency === true || body.owner_emergency === true,
      reason,
    });
    if (!approval.ok) {
      return approval.response;
    }
  }

  const resourceId = readString(body.resourceId ?? body.resource_id) || null;
  const descriptor = buildAdminAuditDescriptor({
    panel: definition.panel,
    action: definition.key,
    actorId: guard.actor.id,
    resourceType: definition.resourceType,
    resourceId,
    reason,
    metadata: {
      requestedPanel: panel.key,
      serverSideOnly: true,
      highRisk: definition.highRisk,
    },
  });

  const mutation = await applyKnownAdminMutation(
    guard.service,
    definition.key,
    resourceId,
    body,
    guard.actor.id,
  );
  if (mutation.error !== null) {
    return problem(400, "admin-action-failed", mutation.error);
  }

  await insertAuditEvent(guard.service, {
    actor: guard.actor,
    actorRole: guard.decision.actorRoles[0] ?? "admin",
    action: descriptor.action,
    resourceType: descriptor.resourceType,
    resourceId: descriptor.resourceId,
    previousState: null,
    newState: {
      mutation: mutation.result,
      metadata: descriptor.metadata,
      statementOfReasons:
        definition.panel === "content" || definition.panel === "appeals"
          ? buildStatementOfReasons({
              action: definition.key,
              policy: readString(body.policy) || "Community Guidelines",
              facts: readStringArray(body.facts),
              appealable: true,
              jurisdiction: readString(body.jurisdiction) === "dsa" ? "dsa" : "platform",
            })
          : null,
    },
    reason: descriptor.reason,
    request,
    correlationId: correlationIdFromRequest(request),
  });

  return NextResponse.json(
    { ok: true, action: definition, result: mutation.result },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function requireElevatedAdminSession(
  guard: {
    service: Parameters<typeof insertAuditEvent>[0];
    actor: { id: string };
    decision: { actorRoles: string[] };
  },
  request: Request,
  body: Record<string, unknown>,
  reason: string,
) {
  const security = await guard.service
    .from("user_security_state")
    .select(
      [
        "mfa_enrolled",
        "passkey_enrolled",
        "step_up_verified_at",
        "mfa_verified_at",
        "passkey_verified_at",
        "admin_session_started_at",
        "risk_score",
        "device_risk",
        "break_glass_enabled",
      ].join(", "),
    )
    .eq("user_id", guard.actor.id)
    .maybeSingle();
  if (security.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "admin-session-security-read-failed", security.error.message),
    };
  }
  const securityRow = (security.data ?? {}) as Record<string, unknown>;

  const stepUpVerifiedAt =
    readString(body.stepUpVerifiedAt ?? body.step_up_verified_at) ||
    readString(securityRow.step_up_verified_at) ||
    readString(securityRow.mfa_verified_at) ||
    readString(securityRow.passkey_verified_at);
  const decision = evaluateAdminSessionSecurity({
    roles: guard.decision.actorRoles,
    mfaEnrolled: securityRow.mfa_enrolled === true,
    passkeyEnrolled: securityRow.passkey_enrolled === true,
    stepUpVerifiedAt,
    sessionStartedAt:
      readString(body.adminSessionStartedAt ?? body.admin_session_started_at) ||
      readString(securityRow.admin_session_started_at),
    ipRiskScore: Number(securityRow.risk_score ?? 0) / 100,
    deviceRiskScore: readDeviceRiskScore(securityRow.device_risk),
    breakGlass:
      securityRow.break_glass_enabled === true &&
      (body.ownerEmergency === true || body.owner_emergency === true),
  });

  if (decision.breakGlass) {
    const event = await guard.service.from("security_events").insert(
      buildBreakGlassMonitorEvent({
        actorId: guard.actor.id,
        reason,
        ipHash: hashNullable(readRequestIp(request)),
      }),
    );
    if (event.error !== null) {
      return {
        ok: false as const,
        response: problem(400, "break-glass-monitoring-failed", event.error.message),
      };
    }
  }

  if (!decision.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          type: "https://www.ai-oss.net/errors/admin-session-security-required",
          title: "Request rejected",
          status: 409,
          detail: decision.reasons.join(", "),
          requirements: decision.requirements,
          sessionExpiresAt: decision.sessionExpiresAt,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return { ok: true as const, decision };
}

async function applyKnownAdminMutation(
  service: Parameters<typeof insertAuditEvent>[0],
  action: AdminActionKey,
  resourceId: string | null,
  body: Record<string, unknown>,
  actorId: string,
): Promise<{ error: string | null; result: unknown }> {
  if (!resourceId) {
    return { error: null, result: { recordedOnly: true } };
  }

  if (action === "suspend_user") {
    return updateOne(service, "profiles", resourceId, { suspended_at: new Date().toISOString() });
  }
  if (action === "unsuspend_user") {
    return updateOne(service, "profiles", resourceId, { suspended_at: null });
  }
  if (action === "mark_user_review") {
    return updateOne(service, "profiles", resourceId, {
      moderation_status: "flagged",
      internal_note: readString(body.note ?? body.internal_note) || null,
    });
  }
  if (action === "quarantine_zone") {
    return updateOne(service, "zones", resourceId, { status: "quarantined" });
  }
  if (action === "remove_zone") {
    return updateOne(service, "zones", resourceId, { status: "removed", deleted_at: new Date().toISOString() });
  }
  if (action === "lock_zone" || action === "emergency_readonly_zone") {
    return updateOne(service, "zones", resourceId, { moderation_status: "flagged" });
  }
  if (action === "quarantine_paper") {
    return updateOne(service, "papers", resourceId, {
      status: "quarantined",
      moderation_status: "quarantined",
    });
  }
  if (action === "withdraw_paper") {
    return updateOne(service, "papers", resourceId, {
      status: "withdrawn",
      moderation_status: "removed",
    });
  }
  if (action === "legal_hold") {
    const legal = await service
      .from("legal_requests")
      .update({
        status: "reviewing",
        legal_hold: true,
        notification_status: "pending",
        audit_metadata: { adminAction: action, reason: readString(body.reason) },
      })
      .eq("id", resourceId)
      .select("*")
      .single();
    if (legal.error !== null) {
      return { error: legal.error.message, result: null };
    }
    const targetType = readString(legal.data?.target_type);
    const targetId = readString(legal.data?.target_id);
    if (targetType === "paper" && targetId) {
      await service.from("papers").update({ legal_hold: true }).eq("id", targetId);
    }
    return { error: null, result: legal.data };
  }
  if (action === "privacy_request_execute") {
    return updateOne(service, "privacy_requests", resourceId, {
      status: "processing",
      verification_status: "verified_by_privacy_admin",
      completed_by: actorId,
      outcome_summary: readString(body.outcomeSummary ?? body.outcome_summary) || null,
    });
  }
  return { error: null, result: { recordedOnly: true } };
}

async function updateOne(
  service: Parameters<typeof insertAuditEvent>[0],
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<{ error: string | null; result: unknown }> {
  const { data, error } = await service.from(table).update(patch).eq("id", id).select("*").single();
  return { error: error?.message ?? null, result: data };
}

function highRiskActionForAdmin(action: AdminActionKey): HighRiskAction {
  switch (action) {
    case "grant_role":
      return "roles.grant_super_admin";
    case "revoke_role":
      return "roles.revoke_super_admin";
    case "ban_user":
    case "suspend_user":
    case "remove_zone":
      return "users.bulk_ban";
    case "content_remove":
      return "content.bulk_remove";
    case "legal_hold":
      return "legal.purge";
    case "privacy_request_execute":
    case "trigger_account_deletion":
      return "privacy.delete_execute";
    case "refund_donation":
      return "finance.refund_export";
    case "automod_publish":
    case "automod_rollback":
      return "moderation.disable_global_automod";
    case "override_mod_removal":
      return "governance.vote_certification_threshold_update";
    case "rotate_secret_checklist":
      return "security.waf_bypass_update";
    default:
      return "roles.grant_super_admin";
  }
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => readString(item)).filter(Boolean);
}

function readDeviceRiskScore(value: unknown): number | null {
  if (typeof value !== "object" || value === null || !("score" in value)) {
    return null;
  }
  const score = Number(value.score);
  return Number.isFinite(score) ? score : null;
}

function readRequestIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")
  );
}

function hashNullable(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return createHash("sha256").update(value).digest("hex");
}
