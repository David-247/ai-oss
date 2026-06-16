import { NextResponse } from "next/server";
import { buildChatRoomInsertRow, buildRoomMemberRow, parseChatRoomType } from "@ai-oss/chat";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { isRecord, loadChatRoomAccess, readString, readStringArray } from "@/lib/chat-server";
import { loadZoneAccess } from "@/lib/discussions-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const user = await maybeAuthenticatedUser(request);
  if (!user.ok) {
    return user.response;
  }

  const url = new URL(request.url);
  const zoneId = url.searchParams.get("zoneId");
  let query = service.client
    .from("chat_rooms")
    .select("*, chat_room_members(member_role, status)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (zoneId !== null) {
    const zone = await loadZoneAccess(service.client, zoneId, user.userId);
    if (!zone.ok) {
      return zone.response;
    }
    if (!zone.access.canRead) {
      return problem(403, "chat-zone-denied", "Zone membership is required.");
    }
    query = query.eq("zone_id", zoneId);
  } else if (user.userId === null) {
    query = query.eq("visibility", "public");
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "chat-rooms-read-failed", error.message);
  }

  return NextResponse.json({ rooms: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
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
    return problem(400, "invalid-chat-room-request", "Expected a JSON object body.");
  }

  const zoneId = readString(body.zoneId ?? body.zone_id) || null;
  const roomType = parseChatRoomType(body.roomType ?? body.room_type);
  if (zoneId !== null) {
    const zone = await loadZoneAccess(service.client, zoneId, auth.user.id);
    if (!zone.ok) {
      return zone.response;
    }
    if (!zone.access.canRead) {
      return problem(403, "chat-room-zone-denied", "Zone membership is required.");
    }
    if ((roomType === "moderator" || roomType === "admin_security") && !zone.access.canModerate) {
      return problem(
        403,
        "chat-room-moderator-denied",
        "Moderator room creation requires a moderator.",
      );
    }
  } else if (roomType !== "temporary" && roomType !== "private" && roomType !== "admin_security") {
    return problem(400, "chat-room-zone-required", "Zone-backed room types require zoneId.");
  }

  let row;
  try {
    row = buildChatRoomInsertRow({
      title: readString(body.title),
      createdBy: auth.user.id,
      roomType,
      visibility:
        body.visibility === "public" ||
        body.visibility === "zone" ||
        body.visibility === "private" ||
        body.visibility === "moderator" ||
        body.visibility === "admin"
          ? body.visibility
          : undefined,
      zoneId,
      linkedPostId: readString(body.linkedPostId ?? body.linked_post_id) || null,
      linkedPaperId: readString(body.linkedPaperId ?? body.linked_paper_id) || null,
      description: readString(body.description) || null,
      slowModeSeconds: Number(body.slowModeSeconds ?? body.slow_mode_seconds ?? 0),
      rules: readString(body.rules) || null,
    });
  } catch (error) {
    return problem(
      400,
      "invalid-chat-room",
      error instanceof Error ? error.message : "Chat room is invalid.",
    );
  }

  const { data, error } = await service.client.from("chat_rooms").insert(row).select("*").single();
  if (error !== null) {
    return problem(400, "chat-room-create-failed", error.message);
  }

  const memberRows = [
    buildRoomMemberRow({ roomId: data.id, userId: auth.user.id, role: "admin" }),
    ...readStringArray(body.inviteUserIds ?? body.invite_user_ids).map((userId) =>
      buildRoomMemberRow({ roomId: data.id, userId, status: "invited" }),
    ),
  ];
  const members = await service.client.from("chat_room_members").upsert(memberRows);
  if (members.error !== null) {
    return problem(400, "chat-room-members-create-failed", members.error.message);
  }

  const access = await loadChatRoomAccess(service.client, data.id, auth.user.id);
  return NextResponse.json(
    { ok: true, room: data, access: access.ok ? access.access : null },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function maybeAuthenticatedUser(request: Request) {
  const hasToken =
    request.headers.get("authorization") !== null ||
    (request.headers.get("cookie") ?? "").includes("sb-access-token=");
  if (!hasToken) {
    return { ok: true as const, userId: null };
  }
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth;
  }
  return { ok: true as const, userId: auth.user.id };
}
