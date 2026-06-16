import { NextResponse } from "next/server";
import {
  buildDefaultZoneSettings,
  buildFounderMembership,
  buildZoneInsertRow,
  evaluateZoneCreation,
  zoneFeatureSurface,
  type DefaultPostVisibility,
  type ZoneVisibility,
} from "@ai-oss/zones";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import {
  correlationIdFromRequest,
  insertAuditEvent,
  readRequestBody,
  readString,
} from "@/lib/permissions-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

export async function GET() {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const { data, error } = await service.client
    .from("zones")
    .select("*, zone_settings(*), zone_governance_settings(*)")
    .is("deleted_at", null)
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error !== null) {
    return problem(400, "zones-read-failed", error.message);
  }

  return NextResponse.json(
    {
      zones: data,
      surface: zoneFeatureSurface(),
      creationPaused: isZoneCreationPaused(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
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
    return problem(400, "invalid-zone-request", "Expected a JSON object body.");
  }

  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "zone_create",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const slug = readString(body.slug);
  const existing = await service.client.from("zones").select("id").eq("slug", slug).maybeSingle();
  if (existing.error !== null) {
    return problem(400, "zone-slug-read-failed", existing.error.message);
  }

  const profile = await service.client
    .from("profiles")
    .select("id, trust_score, created_at, suspended_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile.error !== null) {
    return problem(400, "profile-read-failed", profile.error.message);
  }

  const candidate = {
    userId: auth.user.id,
    emailVerified: readEmailVerified(auth.user),
    accountCreatedAt: profile.data?.created_at ?? readUserCreatedAt(auth.user),
    trustScore: Number(profile.data?.trust_score ?? 0),
    riskLevel: profile.data?.suspended_at ? ("suspended" as const) : ("normal" as const),
    slug,
    name: readString(body.name),
    description: readString(body.description),
    rules: readStringArray(body.rules),
    topicTags: readStringArray(body.topicTags ?? body.topic_tags),
    visibility: readVisibility(body.visibility),
    defaultPostVisibility: readDefaultPostVisibility(
      body.defaultPostVisibility ?? body.default_post_visibility,
    ),
    creationPaused: isZoneCreationPaused(),
    slugAvailable: existing.data === null,
  };

  const decision = evaluateZoneCreation(candidate);
  if (!decision.allowed) {
    return NextResponse.json(
      {
        type: "https://www.ai-oss.net/errors/zone-creation-rejected",
        title: "Zone creation rejected",
        status: 403,
        detail: decision.reasons.join(", "),
        reasons: decision.reasons,
        requirements: decision.requirements,
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const zoneRow = buildZoneInsertRow(candidate);
  const { data: zone, error: zoneError } = await service.client
    .from("zones")
    .insert(zoneRow)
    .select("*")
    .single();
  if (zoneError !== null) {
    return problem(400, "zone-create-failed", zoneError.message);
  }

  const settings = buildDefaultZoneSettings({
    zoneId: zone.id,
    actorId: auth.user.id,
    visibility: zone.visibility,
    topicTags: candidate.topicTags,
  });
  const founder = buildFounderMembership({ zoneId: zone.id, userId: auth.user.id });
  const bootstrapMembers = readStringArray(body.moderatorUserIds ?? body.moderator_user_ids).map(
    (userId) => ({
      zone_id: zone.id,
      user_id: userId,
      member_role: "moderator",
      status: "active",
    }),
  );

  await Promise.all([
    service.client.from("zone_members").upsert([founder, ...bootstrapMembers]),
    service.client.from("zone_settings").upsert(settings.settings),
    service.client.from("zone_governance_settings").upsert(settings.governance),
  ]);

  const correlationId = correlationIdFromRequest(request);
  await insertAuditEvent(service.client, {
    actor: { id: auth.user.id, roleBindings: [] },
    actorRole: "member",
    action: "zones.create",
    resourceType: "zone",
    resourceId: zone.id,
    zoneId: zone.id,
    newState: { zone, settings, founder },
    reason: readString(body.reason) || "Zone created.",
    request,
    correlationId,
  });

  return NextResponse.json(
    {
      ok: true,
      zone,
      settings,
      founder,
      surface: zoneFeatureSurface(),
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

function isZoneCreationPaused(): boolean {
  return process.env.ZONE_CREATION_PAUSED === "true";
}

function readUserCreatedAt(user: unknown): string {
  return isRecord(user) && typeof user.created_at === "string"
    ? user.created_at
    : new Date().toISOString();
}

function readVisibility(value: unknown): ZoneVisibility {
  return value === "restricted" || value === "private" ? value : "public";
}

function readDefaultPostVisibility(value: unknown): DefaultPostVisibility {
  return value === "zone" || value === "private" ? value : "public";
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => readString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
