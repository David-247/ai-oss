import { checkPermission, type ActorContext, type PermissionScope } from "@ai-oss/permissions";
import type { SupabaseClient } from "@ai-oss/auth";
import { problem, requireAuthenticatedUser } from "@/lib/auth-server";
import {
  correlationIdFromRequest,
  insertAuditEvent,
  loadActorContext,
} from "@/lib/permissions-server";
import { readString } from "@/lib/discussions-server";

type SupabaseServiceClient = SupabaseClient;

export interface ModerationViewer {
  userId: string;
  actor: ActorContext;
  moderatorZoneIds: string[];
  canReadGlobal: boolean;
  canUpdateGlobal: boolean;
  canManageAutomodGlobal: boolean;
}

export async function requireModerationSession(request: Request, client: SupabaseServiceClient) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth;
  }
  const viewer = await loadModerationViewer(client, auth.user.id);
  return {
    ok: true as const,
    auth,
    viewer,
  };
}

export async function loadModerationViewer(
  client: SupabaseServiceClient,
  userId: string,
): Promise<ModerationViewer> {
  const [actor, memberships] = await Promise.all([
    loadActorContext(client, userId),
    client
      .from("zone_members")
      .select("zone_id, member_role, status")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);
  const moderatorZoneIds = (memberships.data ?? [])
    .filter((membership) => {
      const role = readString(membership.member_role);
      return role === "moderator" || role === "admin";
    })
    .map((membership) => readString(membership.zone_id))
    .filter(Boolean);

  return {
    userId,
    actor,
    moderatorZoneIds: Array.from(new Set(moderatorZoneIds)),
    canReadGlobal: permissionAllowed(actor, "moderation.read", null),
    canUpdateGlobal: permissionAllowed(actor, "moderation.update", null),
    canManageAutomodGlobal: permissionAllowed(actor, "moderation.automod_manage", null),
  };
}

export function canReadModeration(viewer: ModerationViewer, zoneId?: string | null): boolean {
  if (viewer.canReadGlobal) {
    return true;
  }
  return Boolean(zoneId && viewer.moderatorZoneIds.includes(zoneId));
}

export function canUpdateModeration(viewer: ModerationViewer, zoneId?: string | null): boolean {
  if (viewer.canUpdateGlobal) {
    return true;
  }
  return Boolean(zoneId && viewer.moderatorZoneIds.includes(zoneId));
}

export function canManageAutomod(viewer: ModerationViewer, zoneId?: string | null): boolean {
  if (viewer.canManageAutomodGlobal) {
    return true;
  }
  if (zoneId && permissionAllowed(viewer.actor, "moderation.automod_manage", zoneId)) {
    return true;
  }
  return Boolean(zoneId && viewer.moderatorZoneIds.includes(zoneId));
}

export function requireReadModeration(viewer: ModerationViewer, zoneId?: string | null) {
  if (canReadModeration(viewer, zoneId)) {
    return { ok: true as const };
  }
  return {
    ok: false as const,
    response: problem(403, "moderation-read-denied", "Moderation visibility is not allowed."),
  };
}

export function requireUpdateModeration(viewer: ModerationViewer, zoneId?: string | null) {
  if (canUpdateModeration(viewer, zoneId)) {
    return { ok: true as const };
  }
  return {
    ok: false as const,
    response: problem(403, "moderation-update-denied", "Moderation updates are not allowed."),
  };
}

export function requireAutomodManage(viewer: ModerationViewer, zoneId?: string | null) {
  if (canManageAutomod(viewer, zoneId)) {
    return { ok: true as const };
  }
  return {
    ok: false as const,
    response: problem(403, "automod-manage-denied", "AutoMod rule management is not allowed."),
  };
}

export function moderationReadableZoneFilter(viewer: ModerationViewer, zoneId?: string | null) {
  const normalizedZoneId = readString(zoneId);
  if (viewer.canReadGlobal) {
    return { global: true, zoneIds: normalizedZoneId ? [normalizedZoneId] : [] };
  }
  if (normalizedZoneId) {
    return {
      global: false,
      zoneIds: viewer.moderatorZoneIds.includes(normalizedZoneId) ? [normalizedZoneId] : [],
    };
  }
  return { global: false, zoneIds: viewer.moderatorZoneIds };
}

export async function auditModerationEvent(input: {
  client: SupabaseServiceClient;
  request: Request;
  viewer: ModerationViewer;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  zoneId?: string | null;
  previousState?: unknown;
  newState?: unknown;
  reason: string;
  automated?: boolean;
}) {
  return insertAuditEvent(input.client, {
    actor: input.viewer.actor,
    actorRole: "moderation_actor",
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    zoneId: input.zoneId,
    previousState: input.previousState,
    newState: input.newState,
    reason: input.reason,
    request: input.request,
    correlationId: correlationIdFromRequest(input.request),
    automated: input.automated,
  });
}

function permissionAllowed(
  actor: ActorContext,
  scope: PermissionScope,
  zoneId: string | null,
): boolean {
  return checkPermission({
    actor,
    scope,
    resource: zoneId ? { type: "zone", zoneId } : {},
  }).allowed;
}
