import { NextResponse } from "next/server";
import {
  buildLiveKitAccessClaims,
  buildVoiceParticipantUpsertRow,
  evaluateJoinRateLimit,
  evaluateRecordingConsent,
  VOICE_PARTICIPANT_ROLES,
  type VoiceParticipantRole,
} from "@ai-oss/voice";
import { evaluateVoiceRoomDuration } from "@ai-oss/performance";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import {
  getLiveKitConfig,
  isRecord,
  liveKitConfigProblem,
  loadVoiceRoomAccess,
  readBoolean,
  readString,
  signLiveKitAccessToken,
} from "@/lib/voice-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

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
    return problem(400, "invalid-voice-token-request", "Expected a JSON object body.");
  }

  const roomId = readString(body.roomId ?? body.room_id);
  const access = await loadVoiceRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.access.canJoin) {
    return problem(403, "voice-join-denied", "Voice room join is not authorized.");
  }
  const duration = evaluateVoiceRoomDuration({ startedAt: readString(access.access.room.created_at) });
  if (!duration.allowed && !access.access.canModerate) {
    return NextResponse.json(
      {
        type: "https://www.ai-oss.net/errors/voice-room-duration-limit",
        title: "Request rejected",
        status: 409,
        detail: "Voice room duration limit reached.",
        duration,
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "room_join",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const recent = await service.client
    .from("voice_participants")
    .select("joined_at")
    .eq("user_id", auth.user.id)
    .gte("joined_at", new Date(Date.now() - 60 * 1000).toISOString());
  if (recent.error !== null) {
    return problem(400, "voice-join-rate-read-failed", recent.error.message);
  }
  const joinRate = evaluateJoinRateLimit({
    recentJoinAts: (recent.data ?? []).map((participant) => readString(participant.joined_at)),
  });
  if (!joinRate.allowed) {
    return NextResponse.json(
      {
        type: "https://www.ai-oss.net/errors/voice-join-rate-limit",
        title: "Request rejected",
        status: 429,
        detail: "Voice joins are temporarily rate limited.",
        retryAfterSeconds: joinRate.retryAfterSeconds,
      },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const roomMetadata = isRecord(access.access.room.metadata) ? access.access.room.metadata : {};
  const consent = evaluateRecordingConsent({
    recordingEnabled: access.access.room.recording_enabled === true,
    transcriptionEnabled: access.access.room.transcription_enabled === true,
    recordingConsentAccepted: readBoolean(
      body.recordingConsentAccepted ?? body.recording_consent_accepted,
    ),
    transcriptionConsentAccepted: readBoolean(
      body.transcriptionConsentAccepted ?? body.transcription_consent_accepted,
    ),
    notice: readString(roomMetadata.recording_notice),
  });
  if (!consent.allowed) {
    return NextResponse.json(
      {
        type: "https://www.ai-oss.net/errors/voice-consent-required",
        title: "Request rejected",
        status: 409,
        detail: "Recording or transcription consent is required before joining.",
        consent,
        recordingIndicatorRequired: true,
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const liveKit = getLiveKitConfig();
  if (!liveKit.configured) {
    return liveKitConfigProblem();
  }

  const role = resolveParticipantRole(access.access);
  const waitingRoom = access.access.waitingRoom && !access.access.canModerate;
  const participant = buildVoiceParticipantUpsertRow({
    roomId,
    userId: auth.user.id,
    role: waitingRoom ? "listener" : role,
    pushToTalkEnabled:
      readBoolean(body.pushToTalkEnabled ?? body.push_to_talk_enabled) ??
      roomMetadata.push_to_talk_default === true,
    deafen: readBoolean(body.deafen) === true,
    consent,
  });
  const upsert = await service.client.from("voice_participants").upsert(participant, {
    onConflict: "voice_room_id,user_id",
  });
  if (upsert.error !== null) {
    return problem(400, "voice-participant-join-failed", upsert.error.message);
  }

  const profile = await service.client
    .from("profiles")
    .select("display_name, username")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile.error !== null) {
    return problem(400, "voice-profile-read-failed", profile.error.message);
  }

  const canPublish = !waitingRoom && !access.access.isMuted;
  const canShareScreen =
    access.access.room.screen_share_enabled === true && access.access.canModerate;
  const claims = buildLiveKitAccessClaims({
    apiKey: liveKit.apiKey,
    roomName: readString(access.access.room.livekit_room_name),
    userId: auth.user.id,
    displayName: readString(profile.data?.display_name) || readString(profile.data?.username),
    role: waitingRoom ? "listener" : role,
    canPublish,
    canSubscribe: true,
    canShareScreen,
    canRecord:
      access.access.canModerate &&
      (access.access.room.recording_enabled === true ||
        access.access.room.transcription_enabled === true),
    metadata: {
      room_id: roomId,
      waiting_room: waitingRoom,
      recording_active: access.access.room.recording_enabled === true,
      transcription_active: access.access.room.transcription_enabled === true,
    },
  });

  return NextResponse.json(
    {
      token: signLiveKitAccessToken(
        claims as unknown as Record<string, unknown>,
        liveKit.apiSecret,
      ),
      livekitUrl: liveKit.url,
      expiresAt: new Date(claims.exp * 1000).toISOString(),
      grant: {
        provider: "livekit",
        roomId,
        livekitRoomName: claims.video.room,
        userId: auth.user.id,
        canPublish,
        canSubscribe: true,
        canShareScreen,
        waitingRoom,
      },
      consent,
      duration,
      recordingIndicatorRequired: consent.required,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function resolveParticipantRole(access: {
  participant: Record<string, unknown> | null;
  isOwner: boolean;
  canModerate: boolean;
}): VoiceParticipantRole {
  const existing = readString(access.participant?.participant_role);
  if (VOICE_PARTICIPANT_ROLES.includes(existing as VoiceParticipantRole)) {
    return existing as VoiceParticipantRole;
  }
  if (access.isOwner) {
    return "host";
  }
  if (access.canModerate) {
    return "moderator";
  }
  return "speaker";
}
