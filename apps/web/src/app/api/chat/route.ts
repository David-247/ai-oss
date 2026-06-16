import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      routes: {
        rooms: "/api/chat/rooms",
        messages: "/api/chat/messages",
        token: "/api/chat/token",
      },
      transport: "supabase_realtime",
      persistence: "postgres",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
