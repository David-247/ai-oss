import { NextResponse } from "next/server";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { auditVoiceEvent, isRecord, loadVoiceRoomAccess, readString } from "@/lib/voice-server";

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
    return problem(400, "invalid-voice-end-request", "Expected a JSON object body.");
  }
  const roomId = readString(body.roomId ?? body.room_id);
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
    reason: readString(body.reason) || "voice room ended",
    previousState: access.access.room,
    newState: data,
  });

  return NextResponse.json({ ok: true, room: data }, { headers: { "Cache-Control": "no-store" } });
}
