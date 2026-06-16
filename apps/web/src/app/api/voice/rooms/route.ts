import { NextResponse } from "next/server";
import {
  buildVoiceParticipantUpsertRow,
  buildVoiceRoomInsertRow,
  evaluateHostReputation,
  evaluateRoomCreationRateLimit,
  parseVoiceRoomType,
  parseVoiceVisibility,
} from "@ai-oss/voice";
import { buildCursorWindow, pageFromRows } from "@ai-oss/performance";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { loadZoneAccess, readStringArray } from "@/lib/discussions-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";
import { auditVoiceEvent, isRecord, readBoolean, readString } from "@/lib/voice-server";

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
  const zoneId = readString(url.searchParams.get("zoneId"));
  const roomType = url.searchParams.get("roomType");
  const pageWindow = buildCursorWindow({
    limit: url.searchParams.get("limit"),
    cursor: url.searchParams.get("cursor"),
    defaultLimit: 50,
    maxLimit: 100,
  });
  let query = service.client
    .from("voice_rooms")
    .select("*, voice_participants(id, user_id, participant_role, muted_at, deafen_at, left_at)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageWindow.fetchLimit);
  if (pageWindow.cursor !== null) {
    query = query.lt("created_at", pageWindow.cursor.sortValue);
  }

  if (zoneId) {
    const zone = await loadZoneAccess(service.client, zoneId, user.userId);
    if (!zone.ok) {
      return zone.response;
    }
    if (!zone.access.canRead) {
      return problem(403, "voice-zone-denied", "Zone membership is required.");
    }
    query = query.eq("zone_id", zoneId);
  } else if (user.userId === null) {
    query = query.eq("visibility", "public");
  }

  if (roomType !== null) {
    query = query.eq("room_type", parseVoiceRoomType(roomType));
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "voice-rooms-read-failed", error.message);
  }

  const page = pageFromRows(data ?? [], pageWindow, (room) => ({
    sortValue: readString(room.created_at),
    id: readString(room.id),
  }));

  return NextResponse.json(
    { rooms: page.items, page: page.page },
    { headers: { "Cache-Control": "no-store" } },
  );
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
    return problem(400, "invalid-voice-room-request", "Expected a JSON object body.");
  }

  const roomType = parseVoiceRoomType(body.roomType ?? body.room_type);
  const visibility = parseVoiceVisibility(body.visibility, roomType);
  const zoneId = readString(body.zoneId ?? body.zone_id) || null;
  if (roomType !== "temporary_invite" && zoneId === null) {
    return problem(400, "voice-zone-required", "Zone-backed voice rooms require zoneId.");
  }
  if (roomType === "temporary_invite" && visibility !== "private") {
    return problem(400, "temporary-voice-private", "Temporary invite voice rooms must be private.");
  }

  let canModerateZone = false;
  if (zoneId !== null) {
    const zone = await loadZoneAccess(service.client, zoneId, auth.user.id);
    if (!zone.ok) {
      return zone.response;
    }
    if (!zone.access.canRead) {
      return problem(403, "voice-zone-access-denied", "Zone membership is required.");
    }
    canModerateZone = zone.access.canModerate;
  }
  if (roomType === "moderator" && !canModerateZone) {
    return problem(403, "voice-moderator-room-denied", "Moderator rooms require a moderator.");
  }
  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "voice_room_create",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const recentSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recent = await service.client
    .from("voice_rooms")
    .select("created_at")
    .eq("created_by", auth.user.id)
    .gte("created_at", recentSince);
  if (recent.error !== null) {
    return problem(400, "voice-rate-read-failed", recent.error.message);
  }
  const rateLimit = evaluateRoomCreationRateLimit({
    recentRoomCreatedAts: (recent.data ?? []).map((room) => readString(room.created_at)),
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        type: "https://www.ai-oss.net/errors/voice-room-rate-limit",
        title: "Request rejected",
        status: 429,
        detail: "Voice room creation is temporarily rate limited.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const profile = await service.client
    .from("profiles")
    .select("trust_score")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile.error !== null) {
    return problem(400, "voice-profile-read-failed", profile.error.message);
  }
  const reputation = evaluateHostReputation({
    visibility,
    trustScore: Number(profile.data?.trust_score ?? 0),
  });
  if (!reputation.allowed) {
    return problem(
      403,
      "voice-host-reputation-required",
      `Public voice rooms require host trust score ${reputation.requiredTrustScore}.`,
    );
  }

  const inviteUserIds = readStringArray(body.inviteUserIds ?? body.invite_user_ids);
  let row;
  try {
    row = buildVoiceRoomInsertRow({
      title: readString(body.title),
      createdBy: auth.user.id,
      roomType,
      visibility,
      zoneId,
      chatRoomId: readString(body.chatRoomId ?? body.chat_room_id) || null,
      linkedPaperId: readString(body.linkedPaperId ?? body.linked_paper_id) || null,
      eventStartsAt: readString(body.eventStartsAt ?? body.event_starts_at) || null,
      waitingRoomEnabled: readBoolean(body.waitingRoomEnabled ?? body.waiting_room_enabled),
      screenShareEnabled: readBoolean(body.screenShareEnabled ?? body.screen_share_enabled),
      pushToTalkDefault: readBoolean(body.pushToTalkDefault ?? body.push_to_talk_default),
    });
    row.metadata = {
      ...row.metadata,
      invite_user_ids: inviteUserIds,
    };
  } catch (error) {
    return problem(
      400,
      "invalid-voice-room",
      error instanceof Error ? error.message : "Voice room is invalid.",
    );
  }

  const { data, error } = await service.client.from("voice_rooms").insert(row).select("*").single();
  if (error !== null) {
    return problem(400, "voice-room-create-failed", error.message);
  }

  const host = await service.client.from("voice_participants").upsert(
    buildVoiceParticipantUpsertRow({
      roomId: data.id,
      userId: auth.user.id,
      role: "host",
      pushToTalkEnabled: readBoolean(body.pushToTalkDefault ?? body.push_to_talk_default),
    }),
    { onConflict: "voice_room_id,user_id" },
  );
  if (host.error !== null) {
    return problem(400, "voice-host-create-failed", host.error.message);
  }

  await auditVoiceEvent({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "voice.room_created",
    roomId: data.id,
    zoneId,
    reason: "voice room created",
    newState: data,
  });

  return NextResponse.json(
    { ok: true, room: data },
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
