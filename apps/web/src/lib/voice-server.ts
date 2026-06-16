import { createHmac } from "node:crypto";
import { checkPermission } from "@ai-oss/permissions";
import type { SupabaseClient } from "@ai-oss/auth";
import { problem } from "@/lib/auth-server";
import { insertAuditEvent, loadActorContext } from "@/lib/permissions-server";
import { isRecord, loadZoneAccess, readString } from "@/lib/discussions-server";

type SupabaseServiceClient = SupabaseClient;

export interface VoiceRoomAccess {
  room: Record<string, unknown>;
  participant: Record<string, unknown> | null;
  canRead: boolean;
  canJoin: boolean;
  canModerate: boolean;
  isOwner: boolean;
  isBanned: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  waitingRoom: boolean;
}

export function getLiveKitConfig() {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() ?? "";
  const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";
  return {
    url,
    apiKey,
    apiSecret,
    configured: url.length > 0 && apiKey.length > 0 && apiSecret.length > 0,
  };
}

export function liveKitConfigProblem() {
  return problem(
    503,
    "livekit-not-configured",
    "LiveKit environment variables are not configured server-side.",
  );
}

export function signLiveKitAccessToken(claims: Record<string, unknown>, apiSecret: string): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify(claims));
  const signature = createHmac("sha256", apiSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export async function loadVoiceRoomAccess(
  client: SupabaseServiceClient,
  roomId: string,
  userId: string | null,
) {
  const room = await client.from("voice_rooms").select("*").eq("id", roomId).maybeSingle();
  if (room.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "voice-room-read-failed", room.error.message),
    };
  }
  if (room.data === null) {
    return {
      ok: false as const,
      response: problem(404, "voice-room-not-found", "Voice room does not exist."),
    };
  }

  const participant = userId
    ? await client
        .from("voice_participants")
        .select("*")
        .eq("voice_room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null, error: null };
  if (participant.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "voice-participant-read-failed", participant.error.message),
    };
  }

  const zoneId = readString(room.data.zone_id) || null;
  const zoneAccess = zoneId === null ? null : await loadZoneAccess(client, zoneId, userId);
  if (zoneAccess !== null && !zoneAccess.ok) {
    return zoneAccess;
  }

  const visibility = readString(room.data.visibility);
  const invitedUserIds = readStringArrayFromMetadata(room.data.metadata, "invite_user_ids");
  const isInvited = userId !== null && invitedUserIds.includes(userId);
  const participantRole = readString(participant.data?.participant_role);
  const participantIsActive =
    participant.data !== null &&
    readString(participant.data.left_at).length === 0 &&
    readString(participant.data.banned_at).length === 0;
  const isOwner = userId !== null && room.data.created_by === userId;
  const canModerate =
    isOwner ||
    zoneAccess?.access.canModerate === true ||
    (participantIsActive && (participantRole === "host" || participantRole === "moderator"));
  const canRead =
    visibility === "public" ||
    isOwner ||
    isInvited ||
    participantIsActive ||
    (visibility === "zone" && zoneAccess?.access.canRead === true) ||
    (visibility === "moderator" && canModerate) ||
    (visibility === "admin" && (await hasVoiceReadPermission(client, userId)));
  const isBanned = readString(participant.data?.banned_at).length > 0;
  const cooldownUntil = readString(participant.data?.cooldown_until);
  const cooldownActive = cooldownUntil ? new Date(cooldownUntil).getTime() > Date.now() : false;
  const roomIsActive = room.data.is_active === true && readString(room.data.ended_at).length === 0;
  const locked = readString(room.data.locked_at).length > 0;
  const canJoin =
    userId !== null &&
    canRead &&
    roomIsActive &&
    !isBanned &&
    !cooldownActive &&
    (!locked || canModerate);

  return {
    ok: true as const,
    access: {
      room: room.data as Record<string, unknown>,
      participant: participant.data,
      canRead,
      canJoin,
      canModerate,
      isOwner,
      isBanned,
      isMuted: readString(participant.data?.muted_at).length > 0,
      isDeafened: readString(participant.data?.deafen_at).length > 0,
      waitingRoom: room.data.waiting_room_enabled === true && !canModerate,
    } satisfies VoiceRoomAccess,
  };
}

export async function auditVoiceEvent(input: {
  client: SupabaseServiceClient;
  request: Request;
  userId: string;
  action: string;
  roomId: string;
  zoneId?: string | null;
  targetUserId?: string | null;
  reason?: string | null;
  previousState?: unknown;
  newState?: unknown;
}) {
  const actor = await loadActorContext(input.client, input.userId);
  return insertAuditEvent(input.client, {
    actor,
    actorRole: "voice_actor",
    action: input.action,
    resourceType: input.targetUserId ? "voice_participant" : "voice_room",
    resourceId: input.targetUserId ?? input.roomId,
    zoneId: input.zoneId ?? null,
    previousState: input.previousState,
    newState: input.newState,
    reason: input.reason ?? "voice control",
    request: input.request,
    correlationId: input.request.headers.get("x-correlation-id") ?? `voice-${Date.now()}`,
  });
}

export function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

export function readNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

async function hasVoiceReadPermission(
  client: SupabaseServiceClient,
  userId: string | null,
): Promise<boolean> {
  if (userId === null) {
    return false;
  }
  const actor = await loadActorContext(client, userId);
  return checkPermission({ actor, scope: "voice.read", resource: {} }).allowed;
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function readStringArrayFromMetadata(metadata: unknown, key: string): string[] {
  if (!isRecord(metadata)) {
    return [];
  }
  const value = metadata[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => readString(item)).filter(Boolean);
}

export { isRecord, readString };
