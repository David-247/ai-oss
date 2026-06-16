import { NextResponse } from "next/server";
import { buildFounderMembership } from "@ai-oss/zones";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import {
  isRecord,
  readRequestBody,
  readString,
  requirePermissionForRequest,
} from "@/lib/permissions-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ zoneId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const guard = await requirePermissionForRequest(request, "zones.members.read", { zoneId });
  if (!guard.ok) {
    return guard.response;
  }

  const { data, error } = await guard.service
    .from("zone_members")
    .select("*, profiles(username, display_name, avatar_file_id)")
    .eq("zone_id", zoneId)
    .order("joined_at", { ascending: false });
  if (error !== null) {
    return problem(400, "zone-members-read-failed", error.message);
  }

  return NextResponse.json({ zoneId, members: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const body = await readRequestBody(request);
  const action = isRecord(body) ? readString(body.action) || "join" : "join";

  if (action === "join") {
    return joinZone(request, zoneId);
  }

  const guard = await requirePermissionForRequest(request, "zones.members.update", { zoneId });
  if (!guard.ok) {
    return guard.response;
  }
  if (!isRecord(body)) {
    return problem(400, "invalid-zone-member-request", "Expected a JSON object body.");
  }

  const userId = readString(body.userId ?? body.user_id);
  const memberRole = readMemberRole(body.memberRole ?? body.member_role);
  const status = readMemberStatus(body.status);
  if (!userId) {
    return problem(400, "zone-member-user-required", "userId is required.");
  }

  const { data, error } = await guard.service
    .from("zone_members")
    .upsert({
      zone_id: zoneId,
      user_id: userId,
      member_role: memberRole,
      status,
    })
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "zone-member-upsert-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, member: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const guard = await requirePermissionForRequest(request, "zones.members.update", { zoneId });
  if (!guard.ok) {
    return guard.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-zone-member-update", "Expected a JSON object body.");
  }

  const userId = readString(body.userId ?? body.user_id);
  if (!userId) {
    return problem(400, "zone-member-user-required", "userId is required.");
  }

  const patch = removeUndefined({
    member_role: readOptionalMemberRole(body.memberRole ?? body.member_role),
    status: readOptionalMemberStatus(body.status),
  });
  if (Object.keys(patch).length === 0) {
    return problem(400, "empty-zone-member-update", "No supported member fields provided.");
  }

  const { data, error } = await guard.service
    .from("zone_members")
    .update(patch)
    .eq("zone_id", zoneId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "zone-member-update-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, member: data },
    { headers: { "Cache-Control": "no-store" } },
  );
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
  const { zoneId } = await context.params;

  const { data, error } = await service.client
    .from("zone_members")
    .update({ status: "left" })
    .eq("zone_id", zoneId)
    .eq("user_id", auth.user.id)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "zone-leave-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, member: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function joinZone(request: Request, zoneId: string) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const zone = await service.client
    .from("zones")
    .select("id, visibility, status")
    .eq("id", zoneId)
    .maybeSingle();
  if (zone.error !== null || zone.data === null) {
    return problem(404, "zone-not-found", "Zone does not exist.");
  }
  if (zone.data.visibility !== "public" || zone.data.status !== "active") {
    return problem(403, "zone-join-restricted", "This zone does not allow open joins.");
  }

  const member = buildFounderMembership({ zoneId, userId: auth.user.id });
  const { data, error } = await service.client
    .from("zone_members")
    .upsert({ ...member, member_role: "member" })
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "zone-join-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, member: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

function readMemberRole(value: unknown): "member" | "contributor" | "moderator" | "admin" {
  return value === "contributor" || value === "moderator" || value === "admin" ? value : "member";
}

function readOptionalMemberRole(
  value: unknown,
): "member" | "contributor" | "moderator" | "admin" | undefined {
  return value === "member" || value === "contributor" || value === "moderator" || value === "admin"
    ? value
    : undefined;
}

function readMemberStatus(value: unknown): "invited" | "active" | "muted" | "banned" | "left" {
  return value === "invited" || value === "muted" || value === "banned" || value === "left"
    ? value
    : "active";
}

function readOptionalMemberStatus(
  value: unknown,
): "invited" | "active" | "muted" | "banned" | "left" | undefined {
  return value === "invited" ||
    value === "active" ||
    value === "muted" ||
    value === "banned" ||
    value === "left"
    ? value
    : undefined;
}

function removeUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
