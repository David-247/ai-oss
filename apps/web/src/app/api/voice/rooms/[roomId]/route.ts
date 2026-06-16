import { NextResponse } from "next/server";
import {
  buildRecordingSettingsPatch,
  buildVoiceParticipantControlPatch,
  buildVoiceRoomControlPatch,
} from "@ai-oss/voice";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import {
  auditVoiceEvent,
  isRecord,
  loadVoiceRoomAccess,
  readBoolean,
  readNumber,
  readString,
} from "@/lib/voice-server";

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
  const access = await loadVoiceRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.access.canRead) {
    return problem(403, "voice-room-read-denied", "Voice room is not visible to this session.");
  }

  const participants = await service.client
    .from("voice_participants")
    .select("*, profiles(username, display_name)")
    .eq("voice_room_id", roomId)
    .is("banned_at", null)
    .order("joined_at", { ascending: true });
  if (participants.error !== null) {
    return problem(400, "voice-participants-read-failed", participants.error.message);
  }

  return NextResponse.json(
    {
      room: access.access.room,
      participant: access.access.participant,
      participants: participants.data ?? [],
      permissions: {
        canJoin: access.access.canJoin,
        canModerate: access.access.canModerate,
        waitingRoom: access.access.waitingRoom,
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
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-voice-room-update", "Expected a JSON object body.");
  }

  const access = await loadVoiceRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }

  const action = readString(body.action);
  if (isSelfParticipantAction(action)) {
    const patch = buildVoiceParticipantControlPatch({
      action,
      existingMetadata: access.access.participant?.metadata,
      actorId: auth.user.id,
      reason: readString(body.reason),
    });
    const { data, error } = await service.client
      .from("voice_participants")
      .update(patch)
      .eq("voice_room_id", roomId)
      .eq("user_id", auth.user.id)
      .select("*")
      .single();
    if (error !== null) {
      return problem(400, "voice-self-control-failed", error.message);
    }
    return NextResponse.json(
      { ok: true, participant: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!access.access.canModerate) {
    return problem(403, "voice-control-denied", "Voice room control requires host or moderator.");
  }

  if (action === "mute_all") {
    const mutedAt = new Date().toISOString();
    const { data, error } = await service.client
      .from("voice_participants")
      .update({
        muted_at: mutedAt,
        metadata: {
          last_control: {
            action,
            actor_id: auth.user.id,
            reason: readString(body.reason),
            at: mutedAt,
            audio_recorded: false,
          },
        },
      })
      .eq("voice_room_id", roomId)
      .is("left_at", null)
      .select("*");
    if (error !== null) {
      return problem(400, "voice-mute-all-failed", error.message);
    }
    await auditVoiceEvent({
      client: service.client,
      request,
      userId: auth.user.id,
      action: "voice.mute_all",
      roomId,
      zoneId: readString(access.access.room.zone_id) || null,
      reason: readString(body.reason) || "emergency mute all",
      newState: { muted_at: mutedAt, affected: data?.length ?? 0 },
    });
    return NextResponse.json(
      { ok: true, participants: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (isParticipantModeratorAction(action)) {
    const targetUserId = readString(body.targetUserId ?? body.target_user_id);
    if (!targetUserId) {
      return problem(400, "voice-target-required", "targetUserId is required.");
    }
    const current = await service.client
      .from("voice_participants")
      .select("*")
      .eq("voice_room_id", roomId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (current.error !== null) {
      return problem(400, "voice-target-read-failed", current.error.message);
    }
    const patch = buildVoiceParticipantControlPatch({
      action,
      existingMetadata: current.data?.metadata,
      actorId: auth.user.id,
      reason: readString(body.reason),
      cooldownSeconds: readNumber(body.cooldownSeconds ?? body.cooldown_seconds),
    });
    const { data, error } = await service.client
      .from("voice_participants")
      .update(patch)
      .eq("voice_room_id", roomId)
      .eq("user_id", targetUserId)
      .select("*")
      .single();
    if (error !== null) {
      return problem(400, "voice-participant-control-failed", error.message);
    }
    await auditVoiceEvent({
      client: service.client,
      request,
      userId: auth.user.id,
      action: `voice.${action}`,
      roomId,
      zoneId: readString(access.access.room.zone_id) || null,
      targetUserId,
      reason: readString(body.reason) || `voice ${action}`,
      previousState: current.data,
      newState: data,
    });
    return NextResponse.json(
      { ok: true, participant: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  let patch: Record<string, unknown>;
  try {
    patch = buildRoomPatch(action, body, access.access.room, auth.user.id);
  } catch (error) {
    return problem(
      400,
      "invalid-voice-control",
      error instanceof Error ? error.message : "Voice control is invalid.",
    );
  }
  if (Object.keys(patch).length === 0) {
    return problem(400, "empty-voice-room-update", "No supported room fields provided.");
  }

  const { data, error } = await service.client
    .from("voice_rooms")
    .update(patch)
    .eq("id", roomId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "voice-room-update-failed", error.message);
  }

  await auditVoiceEvent({
    client: service.client,
    request,
    userId: auth.user.id,
    action: `voice.${action || "room_update"}`,
    roomId,
    zoneId: readString(access.access.room.zone_id) || null,
    reason: readString(body.reason) || "voice room update",
    previousState: access.access.room,
    newState: data,
  });

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
  const access = await loadVoiceRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.access.canModerate) {
    return problem(403, "voice-end-denied", "Ending a voice room requires host or moderator.");
  }

  const endedAt = new Date().toISOString();
  const { data, error } = await service.client
    .from("voice_rooms")
    .update({ is_active: false, ended_at: endedAt })
    .eq("id", roomId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "voice-room-end-failed", error.message);
  }
  await auditVoiceEvent({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "voice.room_ended",
    roomId,
    zoneId: readString(access.access.room.zone_id) || null,
    reason: "voice room ended",
    previousState: access.access.room,
    newState: data,
  });
  return NextResponse.json({ ok: true, room: data }, { headers: { "Cache-Control": "no-store" } });
}

function buildRoomPatch(
  action: string,
  body: Record<string, unknown>,
  room: Record<string, unknown>,
  actorId: string,
): Record<string, unknown> {
  if (
    action === "lock" ||
    action === "unlock" ||
    action === "anti_raid_lock" ||
    action === "enable_screen_share" ||
    action === "disable_screen_share"
  ) {
    return buildVoiceRoomControlPatch({
      action,
      existingMetadata: room.metadata,
      actorId,
      reason: readString(body.reason),
      previousVisibility: readString(room.visibility),
    });
  }

  if (
    action === "enable_recording" ||
    action === "disable_recording" ||
    action === "enable_transcription" ||
    action === "disable_transcription"
  ) {
    const recordingEnabled =
      action === "enable_recording"
        ? true
        : action === "disable_recording"
          ? false
          : room.recording_enabled === true;
    const transcriptionEnabled =
      action === "enable_transcription"
        ? true
        : action === "disable_transcription"
          ? false
          : room.transcription_enabled === true;
    return buildRecordingSettingsPatch({
      existingMetadata: room.metadata,
      recordingEnabled,
      transcriptionEnabled,
      consentNotice: readString(body.consentNotice ?? body.consent_notice),
      retentionDays: readNumber(body.retentionDays ?? body.retention_days),
    });
  }

  return removeUndefined({
    title: readOptionalString(body.title),
    waiting_room_enabled: readBoolean(body.waitingRoomEnabled ?? body.waiting_room_enabled),
    screen_share_enabled: readBoolean(body.screenShareEnabled ?? body.screen_share_enabled),
  });
}

function isSelfParticipantAction(
  action: string,
): action is "deafen" | "undeafen" | "push_to_talk_on" | "push_to_talk_off" {
  return (
    action === "deafen" ||
    action === "undeafen" ||
    action === "push_to_talk_on" ||
    action === "push_to_talk_off"
  );
}

function isParticipantModeratorAction(
  action: string,
): action is "mute" | "unmute" | "kick" | "ban" | "cooldown" {
  return (
    action === "mute" ||
    action === "unmute" ||
    action === "kick" ||
    action === "ban" ||
    action === "cooldown"
  );
}

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value);
  return text ? text : undefined;
}

function removeUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
