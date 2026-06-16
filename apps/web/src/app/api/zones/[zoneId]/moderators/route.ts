import { NextResponse } from "next/server";
import {
  buildGovernanceEvent,
  buildModeratorSelectionPatch,
  readModeratorTier,
} from "@ai-oss/zones";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import {
  correlationIdFromRequest,
  insertAuditEvent,
  isRecord,
  readRequestBody,
  readString,
  requirePermissionForRequest,
} from "@/lib/permissions-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ zoneId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const { data, error } = await service.client
    .from("zone_members")
    .select("*, profiles(username, display_name, avatar_file_id)")
    .eq("zone_id", zoneId)
    .in("member_role", ["moderator", "admin"])
    .neq("status", "banned")
    .order("joined_at", { ascending: true });
  if (error !== null) {
    return problem(400, "zone-moderators-read-failed", error.message);
  }

  return NextResponse.json(
    { zoneId, moderators: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const guard = await requirePermissionForRequest(request, "zones.members.update", { zoneId });
  if (!guard.ok) {
    return guard.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-moderator-action", "Expected a JSON object body.");
  }

  const targetUserId = readString(body.userId ?? body.user_id);
  if (!targetUserId) {
    return problem(400, "moderator-target-required", "userId is required.");
  }

  const event = buildGovernanceEvent({
    zoneId,
    action: "moderator_appointment",
    actorId: guard.actor.id,
    targetUserId,
    reason: readString(body.reason) || "Moderator appointed.",
  });
  const selection = buildModeratorSelectionPatch({
    tier: readModeratorTier(body.tier ?? body.moderatorTier ?? body.moderator_tier),
    source: "lead_invitation",
    actorId: guard.actor.id,
    reason: readString(body.reason) || "Moderator appointed.",
  });

  const { data, error } = await guard.service
    .from("zone_members")
    .upsert({
      zone_id: zoneId,
      user_id: targetUserId,
      ...selection,
    })
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "moderator-appointment-failed", error.message);
  }

  await auditModeratorAction(request, guard.service, guard.actor.id, "zone_admin", event, data);

  return NextResponse.json(
    { ok: true, event, moderator: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readRequestBody(request);
  const targetUserId = isRecord(body)
    ? readString(body.userId ?? body.user_id) || auth.user.id
    : auth.user.id;
  const selfResignation = targetUserId === auth.user.id;

  if (!selfResignation) {
    const guard = await requirePermissionForRequest(request, "zones.members.update", { zoneId });
    if (!guard.ok) {
      return guard.response;
    }
    return removeModerator(
      request,
      guard.service,
      guard.actor.id,
      "zone_admin",
      zoneId,
      targetUserId,
      "global_admin_removal",
      body,
    );
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  return removeModerator(
    request,
    service.client,
    auth.user.id,
    "member",
    zoneId,
    targetUserId,
    "moderator_resignation",
    body,
  );
}

async function removeModerator(
  request: Request,
  service: Parameters<typeof insertAuditEvent>[0],
  actorId: string,
  actorRole: string,
  zoneId: string,
  targetUserId: string,
  action: "moderator_resignation" | "global_admin_removal",
  body: unknown,
) {
  const event = buildGovernanceEvent({
    zoneId,
    action,
    actorId,
    targetUserId,
    reason: isRecord(body) ? readString(body.reason) || "Moderator removed." : "Moderator removed.",
  });

  const { data, error } = await service
    .from("zone_members")
    .update({
      member_role: "member",
      moderator_tier: null,
      moderator_status: "removed",
      moderator_status_reason: event.reason,
      moderator_selection_source:
        action === "moderator_resignation" ? "moderator_resignation" : "admin_emergency_removal",
      moderator_updated_by: actorId,
    })
    .eq("zone_id", zoneId)
    .eq("user_id", targetUserId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "moderator-removal-failed", error.message);
  }

  await auditModeratorAction(request, service, actorId, actorRole, event, data);

  return NextResponse.json(
    { ok: true, event, member: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function auditModeratorAction(
  request: Request,
  service: Parameters<typeof insertAuditEvent>[0],
  actorId: string,
  actorRole: string,
  event: ReturnType<typeof buildGovernanceEvent>,
  newState: unknown,
) {
  await insertAuditEvent(service, {
    actor: { id: actorId, roleBindings: [] },
    actorRole,
    action: event.auditAction,
    resourceType: "zone_moderator",
    resourceId: event.targetUserId,
    zoneId: event.zoneId,
    newState,
    reason: event.reason,
    request,
    correlationId: correlationIdFromRequest(request),
  });
}
