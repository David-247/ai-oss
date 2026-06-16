import {
  buildAuditEvent,
  checkPermission,
  createCustomRole,
  evaluateHighRiskAction,
  isHighRiskAction,
  type ActorContext,
  type HighRiskAction,
  type PermissionScope,
  type ResourceContext,
} from "@ai-oss/permissions";
import type { SupabaseClient } from "@ai-oss/auth";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";

type SupabaseServiceClient = SupabaseClient;

export async function requirePermissionForRequest(
  request: Request,
  scope: PermissionScope,
  resource: ResourceContext = {},
) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth;
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service;
  }

  const actor = await loadActorContext(service.client, auth.user.id);
  const decision = checkPermission({
    actor,
    scope,
    resource,
  });

  if (!decision.allowed) {
    return {
      ok: false as const,
      response: problem(
        403,
        "permission-denied",
        `Missing ${scope}: ${decision.reasons.join(", ")}`,
      ),
    };
  }

  return {
    ok: true as const,
    auth,
    service: service.client,
    actor,
    decision,
  };
}

export async function loadActorContext(
  client: SupabaseServiceClient,
  userId: string,
): Promise<ActorContext> {
  const [bindings, security] = await Promise.all([
    client
      .from("role_bindings")
      .select("zone_id, expires_at, revoked_at, roles(role_key, permissions)")
      .eq("user_id", userId),
    client
      .from("user_security_state")
      .select(
        "risk_level, mfa_enrolled, passkey_enrolled, mfa_verified_at, passkey_verified_at, step_up_verified_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    id: userId,
    riskLevel: readRiskLevel(security.data?.risk_level),
    mfaVerifiedAt: readOptionalDate(security.data?.mfa_verified_at),
    passkeyVerifiedAt: readOptionalDate(security.data?.passkey_verified_at),
    stepUpVerifiedAt: readOptionalDate(security.data?.step_up_verified_at),
    roleBindings: (bindings.data ?? []).map((binding) => {
      const role = Array.isArray(binding.roles) ? binding.roles[0] : binding.roles;
      return {
        roleKey: String(role?.role_key ?? ""),
        permissions: Array.isArray(role?.permissions) ? role.permissions : [],
        zoneId: binding.zone_id,
        expiresAt: binding.expires_at,
        revokedAt: binding.revoked_at,
      };
    }),
  };
}

function readOptionalDate(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function insertAuditEvent(
  client: SupabaseServiceClient,
  input: {
    actor: ActorContext;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    zoneId?: string | null;
    previousState?: unknown;
    newState?: unknown;
    reason: string;
    request: Request;
    correlationId: string;
    automated?: boolean;
  },
) {
  const row = buildAuditEvent({
    actorId: input.actor.id,
    actorRole: input.actorRole,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    zoneId: input.zoneId,
    previousState: input.previousState,
    newState: input.newState,
    reason: input.reason,
    requestIp: readRequestIp(input.request),
    deviceMetadata: {
      user_agent: input.request.headers.get("user-agent") ?? undefined,
    },
    correlationId: input.correlationId,
    automated: input.automated,
  });

  return client.from("audit_events").insert(row);
}

export async function insertPermissionAudit(
  client: SupabaseServiceClient,
  input: {
    actor: ActorContext;
    targetUserId?: string | null;
    roleId?: string | null;
    zoneId?: string | null;
    action: string;
    previousState?: unknown;
    newState?: unknown;
    reason: string;
    correlationId: string;
  },
) {
  return client.from("permission_audit").insert({
    actor_id: input.actor.id,
    target_user_id: input.targetUserId ?? null,
    role_id: input.roleId ?? null,
    zone_id: input.zoneId ?? null,
    action: input.action,
    previous_state: input.previousState ?? null,
    new_state: input.newState ?? null,
    reason: input.reason,
    correlation_id: input.correlationId,
  });
}

export function requireHighRiskApproval(input: {
  actor: ActorContext;
  action: string;
  approvalActorIds?: readonly string[];
  ownerEmergency?: boolean;
  reason?: string;
}) {
  if (!isHighRiskAction(input.action)) {
    return { ok: true as const };
  }

  const decision = evaluateHighRiskAction({
    actor: input.actor,
    action: input.action as HighRiskAction,
    approvalActorIds: input.approvalActorIds,
    ownerEmergency: input.ownerEmergency,
    reason: input.reason,
  });

  if (decision.allowed) {
    return { ok: true as const, decision };
  }

  return {
    ok: false as const,
    response: problem(409, "high-risk-approval-required", decision.reasons.join(", ")),
    decision,
  };
}

export function parseCustomRole(input: unknown) {
  if (!isRecord(input)) {
    throw new Error("Expected role object.");
  }

  const key = readString(input.key);
  const name = readString(input.name);
  const description = readString(input.description);
  const permissions = Array.isArray(input.permissions)
    ? input.permissions.map((scope) => readString(scope))
    : [];

  if (!key || !name || permissions.length === 0) {
    throw new Error("Role key, name, and permissions are required.");
  }

  return createCustomRole({
    key,
    name,
    description,
    permissions: permissions as PermissionScope[],
  });
}

export async function readRequestBody(request: Request): Promise<unknown> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return await request.json();
    }

    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return null;
  }
}

export function correlationIdFromRequest(request: Request): string {
  return (
    request.headers.get("x-correlation-id") ??
    `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRiskLevel(value: unknown): ActorContext["riskLevel"] {
  if (
    value === "normal" ||
    value === "elevated" ||
    value === "restricted" ||
    value === "suspended"
  ) {
    return value;
  }
  return "normal";
}

function readRequestIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")
  );
}
