import { NextResponse } from "next/server";
import {
  buildChatMessageEditPatch,
  buildChatMessageInsertRow,
  buildDeletedMessagePatch,
  evaluateSlowMode,
  previewAutomod,
} from "@ai-oss/chat";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import {
  assertCleanAttachmentIds,
  isRecord,
  loadChatRoomAccess,
  loadMessageWithRoom,
  readString,
  readStringArray,
  requireAuditedPrivateRoomRead,
} from "@/lib/chat-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const url = new URL(request.url);
  const roomId = readString(url.searchParams.get("roomId"));
  if (!roomId) {
    return problem(400, "chat-room-required", "roomId is required.");
  }
  const access = await loadChatRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.access.canRead) {
    if (!access.access.isPrivate) {
      return problem(403, "chat-messages-read-denied", "Room is not visible to this session.");
    }
    const admin = await requireAuditedPrivateRoomRead({
      client: service.client,
      request,
      roomId,
      userId: auth.user.id,
      reason: readString(url.searchParams.get("reason")),
    });
    if (!admin.ok) {
      return admin.response;
    }
  }

  const { data, error } = await service.client
    .from("chat_messages")
    .select("*, profiles(username, display_name)")
    .eq("room_id", roomId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error !== null) {
    return problem(400, "chat-messages-read-failed", error.message);
  }

  return NextResponse.json({ messages: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-chat-message-request", "Expected a JSON object body.");
  }
  const roomId = readString(body.roomId ?? body.room_id);
  const access = await loadChatRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.access.canWrite) {
    return problem(
      403,
      "chat-message-write-denied",
      "Message writing is not allowed in this room.",
    );
  }

  const recent = await service.client
    .from("chat_messages")
    .select("created_at")
    .eq("room_id", roomId)
    .eq("author_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent.error !== null) {
    return problem(400, "chat-slow-mode-read-failed", recent.error.message);
  }
  const slowMode = evaluateSlowMode({
    slowModeSeconds: Number(access.access.room.slow_mode_seconds ?? 0),
    lastMessageAt: readString(recent.data?.created_at) || null,
  });
  if (!slowMode.allowed) {
    return NextResponse.json(
      {
        type: "https://www.ai-oss.net/errors/chat-slow-mode",
        title: "Request rejected",
        status: 429,
        detail: "Slow mode is active for this room.",
        retryAfterSeconds: slowMode.retryAfterSeconds,
      },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const attachmentFileIds = readStringArray(body.attachmentFileIds ?? body.attachment_file_ids);
  const attachments = await assertCleanAttachmentIds(service.client, attachmentFileIds);
  if (!attachments.ok) {
    return attachments.response;
  }

  let row;
  try {
    row = buildChatMessageInsertRow({
      roomId,
      authorId: auth.user.id,
      body: readString(body.body),
      parentMessageId: readString(body.parentMessageId ?? body.parent_message_id) || null,
      attachmentFileIds,
    });
  } catch (error) {
    return problem(
      400,
      "invalid-chat-message",
      error instanceof Error ? error.message : "Chat message is invalid.",
    );
  }

  const automod = previewAutomod(row.body);
  if (automod.action === "quarantine") {
    row.moderation_status = "quarantined";
  }

  const { data, error } = await service.client
    .from("chat_messages")
    .insert(row)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "chat-message-create-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, message: data, automod },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-chat-message-update", "Expected a JSON object body.");
  }
  const messageId = readString(body.messageId ?? body.message_id);
  const loaded = await loadMessageWithRoom(service.client, messageId, auth.user.id);
  if (!loaded.ok) {
    return loaded.response;
  }
  if (!loaded.authorOwnsMessage && !loaded.access.canModerate) {
    return problem(403, "chat-message-update-denied", "Only the author or moderator can update.");
  }

  const patch =
    body.status === "removed" || body.moderationStatus === "removed"
      ? buildDeletedMessagePatch({ moderator: true })
      : buildChatMessageEditPatch({
          previousBody: readString(loaded.message.body),
          previousEditHistory: loaded.message.edit_history,
          newBody: readString(body.body),
          editorId: auth.user.id,
          reason: readString(body.reason),
        });
  const { data, error } = await service.client
    .from("chat_messages")
    .update(patch)
    .eq("id", messageId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "chat-message-update-failed", error.message);
  }
  return NextResponse.json(
    { ok: true, message: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const url = new URL(request.url);
  const messageId = readString(url.searchParams.get("messageId"));
  const loaded = await loadMessageWithRoom(service.client, messageId, auth.user.id);
  if (!loaded.ok) {
    return loaded.response;
  }
  if (!loaded.authorOwnsMessage && !loaded.access.canModerate) {
    return problem(403, "chat-message-delete-denied", "Only the author or moderator can delete.");
  }
  const { data, error } = await service.client
    .from("chat_messages")
    .update(buildDeletedMessagePatch({ moderator: !loaded.authorOwnsMessage }))
    .eq("id", messageId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "chat-message-delete-failed", error.message);
  }
  return NextResponse.json(
    { ok: true, message: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
