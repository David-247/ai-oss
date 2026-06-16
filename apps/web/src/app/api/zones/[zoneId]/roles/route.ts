import { NextResponse } from "next/server";
import type { PermissionScope } from "@ai-oss/permissions";
import type { SupabaseClient } from "@ai-oss/auth";
import {
  correlationIdFromRequest,
  insertAuditEvent,
  insertPermissionAudit,
  isRecord,
  readRequestBody,
  readString,
  requirePermissionForRequest,
} from "@/lib/permissions-server";
import { problem } from "@/lib/auth-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ zoneId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const guard = await requirePermissionForRequest(request, "zones.members.read", {
    zoneId,
  });
  if (!guard.ok) {
    return guard.response;
  }

  const { data, error } = await guard.service
    .from("role_bindings")
    .select("*, roles(role_key, name, permissions)")
    .eq("zone_id", zoneId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error !== null) {
    return problem(400, "zone-role-bindings-read-failed", error.message);
  }

  return NextResponse.json(
    { zoneId, bindings: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const guard = await requirePermissionForRequest(request, "zones.members.update", {
    zoneId,
  });
  if (!guard.ok) {
    return guard.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-zone-role-request", "Expected a JSON object body.");
  }

  const userId = readString(body.userId) || readString(body.user_id);
  const roleKey = readString(body.roleKey) || readString(body.role_key);
  if (!userId || !roleKey) {
    return problem(400, "invalid-zone-role-grant", "userId and roleKey are required.");
  }
  if (roleKey === "owner" || roleKey === "super_admin") {
    return problem(
      400,
      "global-role-zone-grant-rejected",
      "Owner and super admin grants must use /api/admin/roles.",
    );
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
      user_id: userId,
      zone_id: zoneId,
      granted_by: guard.actor.id,
      grant_reason: readString(body.reason),
      expires_at: readString(body.expiresAt) || null,
    })
    .select("*")
    .single();

  if (error !== null) {
    return problem(400, "zone-role-grant-failed", error.message);
  }

  await insertPermissionAudit(guard.service, {
    actor: guard.actor,
    targetUserId: userId,
    roleId: role.id,
    zoneId,
    action: "roles.grant_zone",
    newState: data,
    reason: readString(body.reason) || "Zone role granted.",
    correlationId,
  });
  await insertAuditEvent(guard.service, {
    actor: guard.actor,
    actorRole: guard.decision.actorRoles[0] ?? "unknown",
    action: "roles.grant_zone",
    resourceType: "role_binding",
    resourceId: data.id,
    zoneId,
    newState: data,
    reason: readString(body.reason) || "Zone role granted.",
    request,
    correlationId,
  });

  return NextResponse.json(
    { ok: true, binding: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const guard = await requirePermissionForRequest(request, "zones.members.update", {
    zoneId,
  });
  if (!guard.ok) {
    return guard.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-zone-role-revoke", "Expected a JSON object body.");
  }

  const userId = readString(body.userId) || readString(body.user_id);
  const roleKey = readString(body.roleKey) || readString(body.role_key);
  if (!userId || !roleKey) {
    return problem(400, "invalid-zone-role-revoke", "userId and roleKey are required.");
  }

  const role = await findRoleByKey(guard.service, roleKey);
  if (role === null) {
    return problem(404, "role-not-found", "Role does not exist.");
  }

  const previous = await guard.service
    .from("role_bindings")
    .select("*")
    .eq("role_id", role.id)
    .eq("user_id", userId)
    .eq("zone_id", zoneId)
    .is("revoked_at", null);
  if (previous.error !== null) {
    return problem(400, "zone-role-binding-read-failed", previous.error.message);
  }

  const { data, error } = await guard.service
    .from("role_bindings")
    .update({ revoked_at: new Date().toISOString() })
    .eq("role_id", role.id)
    .eq("user_id", userId)
    .eq("zone_id", zoneId)
    .is("revoked_at", null)
    .select("*");

  if (error !== null) {
    return problem(400, "zone-role-revoke-failed", error.message);
  }

  const correlationId = correlationIdFromRequest(request);
  await insertPermissionAudit(guard.service, {
    actor: guard.actor,
    targetUserId: userId,
    roleId: role.id,
    zoneId,
    action: "roles.revoke_zone",
    previousState: previous.data,
    newState: data,
    reason: readString(body.reason) || "Zone role revoked.",
    correlationId,
  });
  await insertAuditEvent(guard.service, {
    actor: guard.actor,
    actorRole: guard.decision.actorRoles[0] ?? "unknown",
    action: "roles.revoke_zone",
    resourceType: "role_binding",
    zoneId,
    previousState: previous.data,
    newState: data,
    reason: readString(body.reason) || "Zone role revoked.",
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
