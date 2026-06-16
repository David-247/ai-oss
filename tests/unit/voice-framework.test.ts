import { describe, expect, it } from "vitest";
import {
  VOICE_ROOM_TYPES,
  buildLiveKitAccessClaims,
  buildRecordingSettingsPatch,
  buildVoiceParticipantControlPatch,
  buildVoiceParticipantUpsertRow,
  buildVoiceRoomControlPatch,
  buildVoiceRoomInsertRow,
  evaluateHostReputation,
  evaluateJoinRateLimit,
  evaluateRecordingConsent,
  evaluateRoomCreationRateLimit,
} from "@ai-oss/voice";

describe("Phase 11 voice framework", () => {
  it("builds every required voice room type with recording disabled by default", () => {
    for (const roomType of VOICE_ROOM_TYPES) {
      const row = buildVoiceRoomInsertRow({
        title: `${roomType} room`,
        createdBy: "user-1",
        roomType,
        zoneId: roomType === "temporary_invite" ? null : "zone-1",
        linkedPaperId: roomType === "paper_review" ? "paper-1" : null,
        now: new Date("2026-06-12T00:00:00.000Z"),
      });

      expect(row.room_type).toBe(roomType);
      expect(row.livekit_room_name).toMatch(/^voice-/);
      expect(row.recording_enabled).toBe(false);
      expect(row.transcription_enabled).toBe(false);
      expect(row.metadata.abuse_metadata_audio_recorded).toBe(false);
    }
  });

  it("requires paper review voice rooms to link a paper", () => {
    expect(() =>
      buildVoiceRoomInsertRow({
        title: "Paper review",
        createdBy: "user-1",
        roomType: "paper_review",
        zoneId: "zone-1",
      }),
    ).toThrow(/linked paper/i);
  });

  it("enforces recording and transcription consent before token issuance", () => {
    expect(
      evaluateRecordingConsent({
        recordingEnabled: true,
        transcriptionEnabled: true,
        recordingConsentAccepted: true,
        transcriptionConsentAccepted: false,
        notice: "This room records audio and creates an automated transcript.",
      }),
    ).toMatchObject({
      allowed: false,
      required: true,
      missing: ["transcription"],
    });

    expect(() =>
      buildRecordingSettingsPatch({
        recordingEnabled: true,
        transcriptionEnabled: false,
      }),
    ).toThrow(/consent notice/i);
  });

  it("builds auditable room and participant control patches without audio capture", () => {
    expect(
      buildVoiceRoomControlPatch({
        action: "anti_raid_lock",
        actorId: "mod-1",
        previousVisibility: "public",
        reason: "raid",
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      visibility: "private",
      locked_at: "2026-06-12T00:00:00.000Z",
      metadata: {
        anti_raid: {
          previous_visibility: "public",
          audio_recorded: false,
        },
      },
    });

    expect(
      buildVoiceParticipantControlPatch({
        action: "cooldown",
        actorId: "mod-1",
        cooldownSeconds: 120,
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      cooldown_until: "2026-06-12T00:02:00.000Z",
      metadata: {
        last_control: {
          audio_recorded: false,
        },
      },
    });
  });

  it("applies creation/join rate limits and public host reputation gates", () => {
    const now = new Date("2026-06-12T00:10:00.000Z");
    expect(
      evaluateRoomCreationRateLimit({
        recentRoomCreatedAts: [
          "2026-06-12T00:01:00.000Z",
          "2026-06-12T00:02:00.000Z",
          "2026-06-12T00:03:00.000Z",
        ],
        now,
      }),
    ).toMatchObject({ allowed: false });

    expect(
      evaluateJoinRateLimit({
        recentJoinAts: Array.from({ length: 8 }, (_, index) =>
          new Date(now.getTime() - index * 1000).toISOString(),
        ),
        now,
      }),
    ).toMatchObject({ allowed: false });

    expect(evaluateHostReputation({ visibility: "public", trustScore: 10 })).toMatchObject({
      allowed: false,
      requiredTrustScore: 25,
    });
    expect(evaluateHostReputation({ visibility: "zone", trustScore: 0 })).toMatchObject({
      allowed: true,
    });
  });

  it("builds participant joins and short-lived LiveKit claims", () => {
    const consent = evaluateRecordingConsent({
      recordingEnabled: false,
      transcriptionEnabled: false,
    });
    expect(
      buildVoiceParticipantUpsertRow({
        roomId: "room-1",
        userId: "user-1",
        role: "speaker",
        consent,
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      voice_room_id: "room-1",
      user_id: "user-1",
      left_at: null,
      banned_at: null,
    });

    expect(
      buildLiveKitAccessClaims({
        apiKey: "api-key",
        roomName: "voice-room",
        userId: "user-1",
        role: "moderator",
        canPublish: true,
        canSubscribe: true,
        canShareScreen: true,
        canRecord: false,
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      iss: "api-key",
      sub: "user-1",
      exp: 1781223000,
      video: {
        roomJoin: true,
        room: "voice-room",
        roomAdmin: true,
        roomRecord: false,
        canPublishSources: ["microphone", "camera", "screen_share", "screen_share_audio"],
      },
    });
  });
});
