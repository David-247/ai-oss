import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      routes: {
        rooms: "/api/voice/rooms",
        token: "/api/voice/token",
        end: "/api/voice/end",
      },
      media: {
        provider: "livekit",
        serverSideMediaRelay: false,
        tokenIssuer: "vercel-function",
      },
      defaults: {
        recordingEnabled: false,
        transcriptionEnabled: false,
        participantConsentRequiredWhenRecorded: true,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
