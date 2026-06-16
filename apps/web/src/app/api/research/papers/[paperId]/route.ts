import { NextResponse } from "next/server";
import { buildPaperPageDescriptor, evaluatePublishingChecks } from "@ai-oss/research";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import {
  isRecord,
  latestVersionForPaper,
  loadPaperAccess,
  readString,
} from "@/lib/research-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ paperId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const user = await maybeAuthenticatedUser(request);
  if (!user.ok) {
    return user.response;
  }

  const { paperId } = await context.params;
  const access = await loadPaperAccess(service.client, paperId, user.userId);
  if (!access.ok) {
    return access.response;
  }
  if (!access.canRead) {
    return problem(403, "paper-read-denied", "Paper is not visible to this session.");
  }

  const paperIdValue = readString(access.paper.id);
  const [versions, authors, files, links, reviews, replications] = await Promise.all([
    service.client
      .from("paper_versions")
      .select("*")
      .eq("paper_id", paperIdValue)
      .order("version_number", { ascending: false }),
    service.client
      .from("paper_authors")
      .select("*")
      .eq("paper_id", paperIdValue)
      .order("author_order", { ascending: true }),
    service.client.from("paper_files").select("*, files(*)").eq("paper_id", paperIdValue),
    service.client.from("paper_links").select("*").eq("paper_id", paperIdValue),
    service.client
      .from("paper_reviews")
      .select("*")
      .eq("paper_id", paperIdValue)
      .eq("status", "published")
      .neq("moderation_status", "removed"),
    service.client
      .from("replication_reports")
      .select("*")
      .eq("paper_id", paperIdValue)
      .eq("status", "published")
      .neq("moderation_status", "removed"),
  ]);

  for (const result of [versions, authors, files, links, reviews, replications]) {
    if (result.error !== null) {
      return problem(400, "paper-detail-read-failed", result.error.message);
    }
  }

  const latestVersion = versions.data?.[0] ?? null;
  const descriptor =
    latestVersion === null
      ? null
      : buildPaperPageDescriptor({
          paper: {
            identifier: readString(access.paper.identifier),
            title: readString(access.paper.title),
            status: readString(access.paper.status),
            safety_status: readString(access.paper.safety_status),
            legal_hold: access.paper.legal_hold === true,
          },
          version: latestVersion,
          authors: authors.data ?? [],
          abstract: readString(access.paper.abstract),
          license: readString(access.paper.license),
        });

  return NextResponse.json(
    {
      paper: access.paper,
      versions: versions.data ?? [],
      authors: authors.data ?? [],
      files: files.data ?? [],
      links: links.data ?? [],
      reviews: reviews.data ?? [],
      replications: replications.data ?? [],
      descriptor,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const { paperId } = await context.params;
  const access = await loadPaperAccess(service.client, paperId, auth.user.id);
  if (!access.ok) {
    return access.response;
  }
  if (!access.submitterOwnsPaper) {
    return problem(403, "paper-update-denied", "Only the submitter can update paper status.");
  }

  const body = await readRequestBody(request);
  if (!isRecord(body) || !isRecord(body.automatedChecks ?? body.automated_checks)) {
    return problem(400, "publishing-checks-required", "automatedChecks are required.");
  }

  const checks = body.automatedChecks ?? body.automated_checks;
  if (!isRecord(checks)) {
    return problem(400, "publishing-checks-required", "automatedChecks are required.");
  }
  const decision = evaluatePublishingChecks({
    malwareScan: readCheck(checks.malwareScan ?? checks.malware_scan, ["pass", "fail", "pending"]),
    metadataValidation: readCheck(checks.metadataValidation ?? checks.metadata_validation, [
      "pass",
      "fail",
    ]),
    licenseAttestation: readCheck(checks.licenseAttestation ?? checks.license_attestation, [
      "pass",
      "fail",
    ]),
    safetyCheck: readCheck(checks.safetyCheck ?? checks.safety_check, [
      "pass",
      "flag",
      "block",
      "pending",
    ]),
    legalCheck: readCheck(checks.legalCheck ?? checks.legal_check, [
      "pass",
      "flag",
      "block",
      "pending",
    ]),
  });

  const paperIdValue = readString(access.paper.id);
  const latest = await latestVersionForPaper(service.client, paperIdValue);
  if (!latest.ok) {
    return latest.response;
  }

  const [paperUpdate, versionUpdate] = await Promise.all([
    service.client
      .from("papers")
      .update({
        status: decision.status,
        safety_status: decision.safetyStatus,
        moderation_status: decision.moderationStatus,
      })
      .eq("id", paperIdValue)
      .select("*")
      .single(),
    latest.version === null
      ? Promise.resolve({ error: null, data: null })
      : service.client
          .from("paper_versions")
          .update({
            status: decision.versionStatus,
            published_at: decision.publishable ? new Date().toISOString() : null,
          })
          .eq("id", latest.version.id)
          .select("*")
          .single(),
  ]);
  if (paperUpdate.error !== null) {
    return problem(400, "paper-status-update-failed", paperUpdate.error.message);
  }
  if (versionUpdate.error !== null) {
    return problem(400, "paper-version-status-update-failed", versionUpdate.error.message);
  }

  return NextResponse.json(
    {
      ok: true,
      decision,
      paper: paperUpdate.data,
      version: versionUpdate.data,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function DELETE() {
  return problem(
    409,
    "paper-delete-prohibited",
    "Published research versions are never destroyed; use the withdraw route.",
  );
}

async function maybeAuthenticatedUser(request: Request) {
  const hasToken =
    request.headers.get("authorization") !== null ||
    (request.headers.get("cookie") ?? "").includes("sb-access-token=");
  if (!hasToken) {
    return { ok: true as const, userId: null };
  }

  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth;
  }
  return { ok: true as const, userId: auth.user.id };
}

function readCheck<TValue extends string>(value: unknown, allowed: readonly TValue[]): TValue {
  if (allowed.includes(value as TValue)) {
    return value as TValue;
  }
  const fallback = allowed[allowed.length - 1];
  if (fallback === undefined) {
    throw new Error("At least one allowed check value is required.");
  }
  return fallback;
}
