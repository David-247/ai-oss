import { NextResponse } from "next/server";
import { buildRealtimeChannelGrant } from "@ai-oss/chat";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { isRecord, loadChatRoomAccess, readString } from "@/lib/chat-server";

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
    return problem(400, "invalid-chat-token-request", "Expected a JSON object body.");
  }
  const roomId = readString(body.roomId ?? body.room_id);
  const access = await loadChatRoomAccess(service.client, roomId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.access.canRead) {
    return problem(403, "chat-channel-denied", "Realtime channel subscription is not authorized.");
  }

  return NextResponse.json(
    {
      grant: buildRealtimeChannelGrant({
        roomId,
        userId: auth.user.id,
        canRead: access.access.canRead,
        canWrite: access.access.canWrite,
        canModerate: access.access.canModerate,
      }),
      realtime: {
        provider: "supabase",
        channelPolicy: "membership-gated",
        longLivedVercelSocketServer: false,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
