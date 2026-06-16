import { NextResponse } from "next/server";
import { problem, requireAuthenticatedUser, getServiceClientOrProblem } from "@/lib/auth-server";
import {
  correlationIdFromRequest,
  insertAuditEvent,
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
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const { zoneId } = await context.params;
  const zone = await service.client
    .from("zones")
    .select("*, zone_settings(*), zone_governance_settings(*), zone_flairs(*), zone_wiki_pages(*)")
    .eq("id", zoneId)
    .is("deleted_at", null)
    .maybeSingle();
  if (zone.error !== null) {
    return problem(400, "zone-read-failed", zone.error.message);
  }
  if (zone.data === null) {
    return problem(404, "zone-not-found", "Zone does not exist.");
  }

  if (zone.data.visibility !== "public") {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    const member = await service.client
      .from("zone_members")
      .select("user_id")
      .eq("zone_id", zoneId)
      .eq("user_id", auth.user.id)
      .neq("status", "banned")
      .maybeSingle();
    if (member.error !== null || member.data === null) {
      return problem(403, "zone-membership-required", "Zone membership is required.");
    }
  }

  return NextResponse.json({ zone: zone.data }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const guard = await requirePermissionForRequest(request, "zones.update", { zoneId });
  if (!guard.ok) {
    return guard.response;
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-zone-update", "Expected a JSON object body.");
  }

  const patch = removeUndefined({
    name: readOptionalString(body.name),
    description: readOptionalString(body.description),
    visibility: readZoneVisibility(body.visibility),
    default_post_visibility: readDefaultPostVisibility(
      body.defaultPostVisibility ?? body.default_post_visibility,
    ),
  });

  if (Object.keys(patch).length === 0) {
    return problem(400, "empty-zone-update", "No supported zone fields provided.");
  }

  const previous = await guard.service.from("zones").select("*").eq("id", zoneId).maybeSingle();
  const { data, error } = await guard.service
    .from("zones")
    .update(patch)
    .eq("id", zoneId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "zone-update-failed", error.message);
  }

  const correlationId = correlationIdFromRequest(request);
  await insertAuditEvent(guard.service, {
    actor: guard.actor,
    actorRole: guard.decision.actorRoles[0] ?? "zone_admin",
    action: "zones.update",
    resourceType: "zone",
    resourceId: zoneId,
    zoneId,
    previousState: previous.data,
    newState: data,
    reason: readString(body.reason) || "Zone updated.",
    request,
    correlationId,
  });

  return NextResponse.json({ ok: true, zone: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const guard = await requirePermissionForRequest(request, "zones.delete", { zoneId });
  if (!guard.ok) {
    return guard.response;
  }

  const previous = await guard.service.from("zones").select("*").eq("id", zoneId).maybeSingle();
  const { data, error } = await guard.service
    .from("zones")
    .update({ status: "archived", deleted_at: new Date().toISOString() })
    .eq("id", zoneId)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "zone-delete-failed", error.message);
  }

  const correlationId = correlationIdFromRequest(request);
  await insertAuditEvent(guard.service, {
    actor: guard.actor,
    actorRole: guard.decision.actorRoles[0] ?? "zone_admin",
    action: "zones.delete",
    resourceType: "zone",
    resourceId: zoneId,
    zoneId,
    previousState: previous.data,
    newState: data,
    reason: "Zone archived by authorized actor.",
    request,
    correlationId,
  });

  return NextResponse.json({ ok: true, zone: data }, { headers: { "Cache-Control": "no-store" } });
}

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value);
  return text.length > 0 ? text : undefined;
}

function readZoneVisibility(value: unknown): "public" | "restricted" | "private" | undefined {
  return value === "public" || value === "restricted" || value === "private" ? value : undefined;
}

function readDefaultPostVisibility(value: unknown): "public" | "zone" | "private" | undefined {
  return value === "public" || value === "zone" || value === "private" ? value : undefined;
}

function removeUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
