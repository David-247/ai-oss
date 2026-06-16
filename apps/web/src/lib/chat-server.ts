import { checkPermission } from "@ai-oss/permissions";
import type { SupabaseClient } from "@ai-oss/auth";
import { problem } from "@/lib/auth-server";
import { insertAuditEvent, loadActorContext } from "@/lib/permissions-server";
import { isRecord, loadZoneAccess, readString, readStringArray } from "@/lib/discussions-server";

type SupabaseServiceClient = SupabaseClient;

export interface ChatRoomAccess {
  room: Record<string, unknown>;
  member: Record<string, unknown> | null;
  canRead: boolean;
  canWrite: boolean;
  canModerate: boolean;
  isPrivate: boolean;
  isMuted: boolean;
}

export async function loadChatRoomAccess(
  client: SupabaseServiceClient,
  roomId: string,
  userId: string | null,
) {
  const room = await client.from("chat_rooms").select("*").eq("id", roomId).maybeSingle();
  if (room.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "chat-room-read-failed", room.error.message),
    };
  }
  if (room.data === null || room.data.deleted_at !== null) {
    return {
      ok: false as const,
      response: problem(404, "chat-room-not-found", "Chat room does not exist."),
    };
  }

  const member = userId
    ? await client
        .from("chat_room_members")
        .select("member_role, status, last_read_at")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null, error: null };
  if (member.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "chat-member-read-failed", member.error.message),
    };
  }

  const status = readString(member.data?.status);
  if (status === "banned" || status === "kicked") {
    return {
      ok: false as const,
      response: problem(403, "chat-room-denied", "Room access is blocked."),
    };
  }

  const zoneId = readString(room.data.zone_id) || null;
  const zoneAccess = zoneId === null ? null : await loadZoneAccess(client, zoneId, userId);
  if (zoneAccess !== null && !zoneAccess.ok) {
    return zoneAccess;
  }

  const visibility = readString(room.data.visibility);
  const role = readString(member.data?.member_role);
  const activeMember = status === "active";
  const mutedMember = status === "muted";
  const memberCanRead = activeMember || mutedMember;
  const zoneCanRead = zoneAccess?.access.canRead ?? false;
  const zoneCanModerate = zoneAccess?.access.canModerate ?? false;
  const canModerate =
    zoneCanModerate || (activeMember && (role === "moderator" || role === "admin"));
  const canRead =
    visibility === "public" ||
    memberCanRead ||
    (visibility === "zone" && zoneCanRead) ||
    (visibility === "moderator" && canModerate);

  return {
    ok: true as const,
    access: {
      room: room.data as Record<string, unknown>,
      member: member.data,
      canRead,
      canWrite:
        userId !== null &&
        canRead &&
        !mutedMember &&
        readString(room.data.locked_at).length === 0 &&
        visibility !== "admin",
      canModerate,
      isPrivate: room.data.is_private === true || visibility === "private",
      isMuted: mutedMember,
    } satisfies ChatRoomAccess,
  };
}

export async function requireAuditedPrivateRoomRead(input: {
  client: SupabaseServiceClient;
  request: Request;
  roomId: string;
  userId: string;
  reason: string;
}) {
  if (!input.reason.trim()) {
    return {
      ok: false as const,
      response: problem(
        403,
        "private-chat-reason-required",
        "Private room access requires a reason.",
      ),
    };
  }
  const actor = await loadActorContext(input.client, input.userId);
  const permission = checkPermission({
    actor,
    scope: "chat.read",
    resource: {},
  });
  if (!permission.allowed) {
    return {
      ok: false as const,
      response: problem(403, "private-chat-admin-denied", permission.reasons.join(", ")),
    };
  }

  await insertAuditEvent(input.client, {
    actor,
    actorRole: permission.actorRoles[0] ?? "admin",
    action: "chat.private_read",
    resourceType: "chat_room",
    resourceId: input.roomId,
    reason: input.reason,
    request: input.request,
    correlationId: input.request.headers.get("x-correlation-id") ?? `chat-${Date.now()}`,
  });

  return { ok: true as const };
}

export async function assertCleanAttachmentIds(
  client: SupabaseServiceClient,
  attachmentFileIds: readonly string[],
) {
  if (attachmentFileIds.length === 0) {
    return { ok: true as const };
  }
  const files = await client
    .from("files")
    .select("id, scan_status, moderation_status")
    .in("id", attachmentFileIds);
  if (files.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "chat-files-read-failed", files.error.message),
    };
  }
  const found = new Set((files.data ?? []).map((file) => readString(file.id)));
  const unsafe = (files.data ?? []).some(
    (file) => file.scan_status !== "clean" || file.moderation_status !== "approved",
  );
  if (unsafe || attachmentFileIds.some((fileId) => !found.has(fileId))) {
    return {
      ok: false as const,
      response: problem(
        409,
        "chat-attachment-not-clean",
        "Attachments must be clean and approved.",
      ),
    };
  }
  return { ok: true as const };
}

export async function loadMessageWithRoom(
  client: SupabaseServiceClient,
  messageId: string,
  userId: string | null,
) {
  const message = await client.from("chat_messages").select("*").eq("id", messageId).maybeSingle();
  if (message.error !== null) {
    return {
      ok: false as const,
      response: problem(400, "chat-message-read-failed", message.error.message),
    };
  }
  if (message.data === null || message.data.deleted_at !== null) {
    return {
      ok: false as const,
      response: problem(404, "chat-message-not-found", "Message does not exist."),
    };
  }
  const access = await loadChatRoomAccess(client, readString(message.data.room_id), userId);
  if (!access.ok) {
    return access;
  }
  return {
    ok: true as const,
    message: message.data as Record<string, unknown>,
    access: access.access,
    authorOwnsMessage: userId !== null && message.data.author_id === userId,
  };
}

export { isRecord, readString, readStringArray };
