import { NextResponse } from "next/server";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { isRecord, loadChatRoomAccess, readString } from "@/lib/chat-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const { roomId } = await context.params;
  const access = await loadChatRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.access.canRead) {
    return problem(403, "chat-room-read-denied", "Room is not visible to this session.");
  }

  return NextResponse.json(
    {
      room: access.access.room,
      member: access.access.member,
      permissions: {
        canWrite: access.access.canWrite,
        canModerate: access.access.canModerate,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const { roomId } = await context.params;
  const access = await loadChatRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.access.canModerate && access.access.room.created_by !== auth.user.id) {
    return problem(403, "chat-room-update-denied", "Room update requires room owner or moderator.");
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-chat-room-update", "Expected a JSON object body.");
  }
  const patch = removeUndefined({
    title: readOptionalString(body.title),
    description: readOptionalNullableString(body.description),
    slow_mode_seconds: readOptionalNumber(body.slowModeSeconds ?? body.slow_mode_seconds),
    rules: readOptionalNullableString(body.rules),
    locked_at:
      body.locked === true || body.isLocked === true
        ? new Date().toISOString()
        : body.locked === false || body.isLocked === false
          ? null
          : undefined,
  });
  if (Object.keys(patch).length === 0) {
    return problem(400, "empty-chat-room-update", "No supported room fields provided.");
  }

  const { data, error } = await service.client
    .from("chat_rooms")
    .update(patch)
    .eq("id", roomId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "chat-room-update-failed", error.message);
  }

  return NextResponse.json({ ok: true, room: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const { roomId } = await context.params;
  const access = await loadChatRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.access.canModerate && access.access.room.created_by !== auth.user.id) {
    return problem(
      403,
      "chat-room-delete-denied",
      "Room deletion requires room owner or moderator.",
    );
  }

  const { data, error } = await service.client
    .from("chat_rooms")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", roomId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "chat-room-delete-failed", error.message);
  }

  return NextResponse.json({ ok: true, room: data }, { headers: { "Cache-Control": "no-store" } });
}

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value);
  return text ? text : undefined;
}

function readOptionalNullableString(value: unknown): string | null | undefined {
  return value === null ? null : readOptionalString(value);
}

function readOptionalNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : undefined;
}

function removeUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
