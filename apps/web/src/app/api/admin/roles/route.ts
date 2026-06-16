import { NextResponse } from "next/server";
import { SYSTEM_ROLES, type PermissionScope } from "@ai-oss/permissions";
import type { SupabaseClient } from "@ai-oss/auth";
import {
  correlationIdFromRequest,
  insertAuditEvent,
  insertPermissionAudit,
  isRecord,
  parseCustomRole,
  readRequestBody,
  readString,
  requireHighRiskApproval,
  requirePermissionForRequest,
} from "@/lib/permissions-server";
import { problem } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await requirePermissionForRequest(request, "roles.read");
  if (!guard.ok) {
    return guard.response;
  }

  const { data, error } = await guard.service
    .from("roles")
    .select("*")
    .order("system_role", { ascending: false })
    .order("role_key", { ascending: true });

  if (error !== null) {
    return problem(400, "roles-read-failed", error.message);
  }

  return NextResponse.json(
    {
      systemRoles: SYSTEM_ROLES,
      roles: data,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-role-request", "Expected a JSON object body.");
  }

  const action = readString(body.action) || "create_role";
  if (action === "create_role") {
    return createRole(request, body);
  }
  if (action === "grant_global_role") {
    return grantGlobalRole(request, body);
  }
  if (action === "revoke_global_role") {
    return revokeGlobalRole(request, body);
  }

  return problem(400, "unknown-role-action", "Unknown role action.");
}

async function createRole(request: Request, body: Record<string, unknown>) {
  const guard = await requirePermissionForRequest(request, "roles.create");
  if (!guard.ok) {
    return guard.response;
  }

  let role;
  try {
    role = parseCustomRole(body);
  } catch (error) {
    return problem(
      400,
      "invalid-custom-role",
      error instanceof Error ? error.message : String(error),
    );
  }

  const correlationId = correlationIdFromRequest(request);
  const { data, error } = await guard.service
    .from("roles")
    .insert({
      role_key: role.key,
      name: role.name,
      description: role.description,
      role_type: "custom",
      permissions: [...role.permissions],
      system_role: false,
      created_by: guard.actor.id,
    })
    .select("*")
    .single();

  if (error !== null) {
    return problem(400, "custom-role-create-failed", error.message);
  }

  await insertAuditEvent(guard.service, {
    actor: guard.actor,
    actorRole: guard.decision.actorRoles[0] ?? "unknown",
    action: "roles.create",
    resourceType: "role",
    resourceId: data.id,
    newState: data,
    reason: readString(body.reason) || "Custom role created.",
    request,
    correlationId,
  });

  return NextResponse.json(
    { ok: true, role: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function grantGlobalRole(request: Request, body: Record<string, unknown>) {
  const guard = await requirePermissionForRequest(request, "roles.grant");
  if (!guard.ok) {
    return guard.response;
  }

  const targetUserId = readString(body.userId) || readString(body.user_id);
  const roleKey = readString(body.roleKey) || readString(body.role_key);
  if (!targetUserId || !roleKey) {
    return problem(400, "invalid-role-grant", "userId and roleKey are required.");
  }

  const highRiskAction =
    roleKey === "owner"
      ? "roles.grant_owner"
      : roleKey === "super_admin"
        ? "roles.grant_super_admin"
        : null;
  const approval = highRiskAction
    ? requireHighRiskApproval({
        actor: {
          ...guard.actor,
          stepUpVerifiedAt: readString(body.stepUpVerifiedAt) || null,
        },
        action: highRiskAction,
        approvalActorIds: readStringArray(body.approvalActorIds),
        ownerEmergency: body.ownerEmergency === true,
        reason: readString(body.reason),
      })
    : { ok: true as const };
  if (!approval.ok) {
    return approval.response;
  }

  const role = await findRoleByKey(guard.service, roleKey);
  if (role === null) {
    return problem(404, "role-not-found", "Role does not exist.");
  }

  const correlationId = correlationIdFromRequest(request);
  const { data, error } = await guard.service
    .from("role_bindings")
    .insert({
      role_id: role.id,
      user_id: targetUserId,
      zone_id: null,
      granted_by: guard.actor.id,
      grant_reason: readString(body.reason),
      expires_at: readString(body.expiresAt) || null,
    })
    .select("*")
    .single();

  if (error !== null) {
    return problem(400, "role-grant-failed", error.message);
  }

  await insertPermissionAudit(guard.service, {
    actor: guard.actor,
    targetUserId,
    roleId: role.id,
    action: "roles.grant",
    newState: data,
    reason: readString(body.reason) || "Global role granted.",
    correlationId,
  });
  await insertAuditEvent(guard.service, {
    actor: guard.actor,
    actorRole: guard.decision.actorRoles[0] ?? "unknown",
    action: highRiskAction ?? "roles.grant",
    resourceType: "role_binding",
    resourceId: data.id,
    newState: data,
    reason: readString(body.reason) || "Global role granted.",
    request,
    correlationId,
  });

  return NextResponse.json(
    { ok: true, binding: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function revokeGlobalRole(request: Request, body: Record<string, unknown>) {
  const guard = await requirePermissionForRequest(request, "roles.revoke");
  if (!guard.ok) {
    return guard.response;
  }

  const targetUserId = readString(body.userId) || readString(body.user_id);
  const roleKey = readString(body.roleKey) || readString(body.role_key);
  if (!targetUserId || !roleKey) {
    return problem(400, "invalid-role-revoke", "userId and roleKey are required.");
  }

  const highRiskAction =
    roleKey === "owner"
      ? "roles.revoke_owner"
      : roleKey === "super_admin"
        ? "roles.revoke_super_admin"
        : null;
  const approval = highRiskAction
    ? requireHighRiskApproval({
        actor: {
          ...guard.actor,
          stepUpVerifiedAt: readString(body.stepUpVerifiedAt) || null,
        },
        action: highRiskAction,
        approvalActorIds: readStringArray(body.approvalActorIds),
        ownerEmergency: body.ownerEmergency === true,
        reason: readString(body.reason),
      })
    : { ok: true as const };
  if (!approval.ok) {
    return approval.response;
  }

  const role = await findRoleByKey(guard.service, roleKey);
  if (role === null) {
    return problem(404, "role-not-found", "Role does not exist.");
  }

  const previous = await guard.service
    .from("role_bindings")
    .select("*")
    .eq("role_id", role.id)
    .eq("user_id", targetUserId)
    .is("zone_id", null)
    .is("revoked_at", null);
  if (previous.error !== null) {
    return problem(400, "role-binding-read-failed", previous.error.message);
  }

  const revokedAt = new Date().toISOString();
  const { data, error } = await guard.service
    .from("role_bindings")
    .update({ revoked_at: revokedAt })
    .eq("role_id", role.id)
    .eq("user_id", targetUserId)
    .is("zone_id", null)
    .is("revoked_at", null)
    .select("*");

  if (error !== null) {
    return problem(400, "role-revoke-failed", error.message);
  }

  const correlationId = correlationIdFromRequest(request);
  await insertPermissionAudit(guard.service, {
    actor: guard.actor,
    targetUserId,
    roleId: role.id,
    action: "roles.revoke",
    previousState: previous.data,
    newState: data,
    reason: readString(body.reason) || "Global role revoked.",
    correlationId,
  });
  await insertAuditEvent(guard.service, {
    actor: guard.actor,
    actorRole: guard.decision.actorRoles[0] ?? "unknown",
    action: highRiskAction ?? "roles.revoke",
    resourceType: "role_binding",
    resourceId: null,
    previousState: previous.data,
    newState: data,
    reason: readString(body.reason) || "Global role revoked.",
    request,
    correlationId,
  });

  return NextResponse.json(
    { ok: true, revoked: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function findRoleByKey(service: SupabaseClient, roleKey: string) {
  const { data, error } = await service.from("roles").select("*").eq("role_key", roleKey).single();
  if (error !== null) {
    return null;
  }
  return data as { id: string; role_key: string; permissions: PermissionScope[] };
}

function readStringArray(value: unknown): string[] {
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
