import { NextResponse } from "next/server";
import { buildReportInsertRow } from "@ai-oss/moderation";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { isRecord, readString } from "@/lib/discussions-server";
import {
  moderationReadableZoneFilter,
  requireModerationSession,
  requireReadModeration,
} from "@/lib/moderation-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const session = await requireModerationSession(request, service.client);
  if (!session.ok) {
    return session.response;
  }

  const url = new URL(request.url);
  const mine = url.searchParams.get("mine") !== "false";
  const zoneId = readString(url.searchParams.get("zoneId")) || null;
  let query = service.client
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const status = url.searchParams.get("status");
  if (status !== null) {
    query = query.eq("status", status);
  }
  const targetType = readString(url.searchParams.get("targetType"));
  if (targetType) {
    query = query.eq("target_type", targetType);
  }

  if (mine && zoneId === null) {
    query = query.eq("reporter_id", session.auth.user.id);
  } else {
    const access = requireReadModeration(session.viewer, zoneId);
    if (!access.ok) {
      return access.response;
    }
    const filter = moderationReadableZoneFilter(session.viewer, zoneId);
    if (filter.zoneIds.length > 0) {
      query =
        filter.zoneIds.length === 1
          ? query.eq("zone_id", filter.zoneIds[0])
          : query.in("zone_id", filter.zoneIds);
    } else if (!filter.global) {
      return problem(403, "reports-read-denied", "No readable moderation zones.");
    }
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "reports-read-failed", error.message);
  }

  return NextResponse.json({ reports: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

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
    return problem(400, "invalid-report-request", "Expected a JSON object body.");
  }
  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "mass_report",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const targetType = normalizeReportTargetType(body.targetType ?? body.target_type);
  const targetId = readString(body.targetId ?? body.target_id);
  let row;
  try {
    row = buildReportInsertRow({
      reporterId: auth.user.id,
      targetType,
      targetId,
      zoneId: readString(body.zoneId ?? body.zone_id) || null,
      reason: body.reason,
      details: readString(body.details) || null,
      severity: body.severity,
      metadata: isRecord(body.metadata) ? body.metadata : {},
    });
  } catch (error) {
    return problem(
      400,
      "invalid-report",
      error instanceof Error
        ? error.message
        : "Valid targetType, targetId, and reason are required.",
    );
  }

  const { data, error } = await service.client.from("reports").insert(row).select("*").single();
  if (error !== null) {
    return problem(400, "report-create-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, report: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

function normalizeReportTargetType(value: unknown): string | null {
  const targetType = readString(value);
  return targetType || null;
}
