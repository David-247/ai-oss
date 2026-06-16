import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 11 voice privacy and LiveKit boundaries", () => {
  it("exposes the required voice API and page route files", () => {
    const root = resolve("..");
    for (const file of [
      "apps/web/src/app/api/voice/route.ts",
      "apps/web/src/app/api/voice/rooms/route.ts",
      "apps/web/src/app/api/voice/rooms/[roomId]/route.ts",
      "apps/web/src/app/api/voice/token/route.ts",
      "apps/web/src/app/api/voice/end/route.ts",
      "apps/web/src/app/z/[zoneSlug]/voice/[roomId]/page.tsx",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });

  it("keeps LiveKit as the media server and Vercel as token issuer only", () => {
    const root = resolve("..");
    const surface = readFileSync(resolve(root, "apps/web/src/app/api/voice/route.ts"), "utf8");
    const token = readFileSync(resolve(root, "apps/web/src/app/api/voice/token/route.ts"), "utf8");
    const helper = readFileSync(resolve(root, "apps/web/src/lib/voice-server.ts"), "utf8");

    expect(surface).toContain('provider: "livekit"');
    expect(surface).toContain("serverSideMediaRelay: false");
    expect(token).toContain("buildLiveKitAccessClaims");
    expect(token).toContain("signLiveKitAccessToken");
    expect(helper).toContain("LIVEKIT_API_SECRET");
  });

  it("keeps recording and transcription disabled by default with consent gates", () => {
    const root = resolve("..");
    const voicePackage = readFileSync(resolve(root, "packages/voice/src/index.ts"), "utf8");
    const token = readFileSync(resolve(root, "apps/web/src/app/api/voice/token/route.ts"), "utf8");
    const page = readFileSync(
      resolve(root, "apps/web/src/app/z/[zoneSlug]/voice/[roomId]/voice-room-client.tsx"),
      "utf8",
    );

    expect(voicePackage).toContain("recording_enabled: false");
    expect(voicePackage).toContain("transcription_enabled: false");
    expect(token).toContain("voice-consent-required");
    expect(token).toContain("recordingIndicatorRequired: true");
    expect(page).toContain("recordingConsentAccepted");
    expect(page).toContain("transcriptionConsentAccepted");
  });

  it("adds LiveKit room metadata without creating persistent audio storage by default", () => {
    const root = resolve("..");
    const migration = readFileSync(
      resolve(root, "supabase/migrations/20260612011100_phase11_voice_livekit.sql"),
      "utf8",
    );

    expect(migration).toContain("livekit_room_name");
    expect(migration).toContain("recording/transcription");
    expect(migration).not.toContain("create table public.voice_recordings");
    expect(migration).not.toContain("create table public.audio_recordings");
  });

  it("logs abuse metadata without recording audio by default", () => {
    const root = resolve("..");
    const roomRoute = readFileSync(
      resolve(root, "apps/web/src/app/api/voice/rooms/[roomId]/route.ts"),
      "utf8",
    );
    const voicePackage = readFileSync(resolve(root, "packages/voice/src/index.ts"), "utf8");

    expect(roomRoute).toContain("voice.mute_all");
    expect(roomRoute).toContain("anti_raid_lock");
    expect(voicePackage).toContain("abuse_metadata_audio_recorded: false");
    expect(voicePackage).toContain("audio_recorded: false");
  });
});
