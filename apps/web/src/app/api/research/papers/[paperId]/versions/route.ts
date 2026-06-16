import { NextResponse } from "next/server";
import {
  buildPaperAuthorRows,
  buildPaperLinkRows,
  buildPaperVersionInsertRow,
  nextVersionNumber,
} from "@ai-oss/research";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import {
  buildSubmissionInput,
  ensureCanSubmitToZone,
  isRecord,
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

  const { data, error } = await service.client
    .from("paper_versions")
    .select("*")
    .eq("paper_id", readString(access.paper.id))
    .order("version_number", { ascending: false });
  if (error !== null) {
    return problem(400, "paper-versions-read-failed", error.message);
  }

  return NextResponse.json({ versions: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
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
  if (!access.canUpdate) {
    return problem(403, "paper-version-denied", "Only the submitter can append a new version.");
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-paper-version-request", "Expected a JSON object body.");
  }

  const paperIdValue = readString(access.paper.id);
  const versions = await service.client
    .from("paper_versions")
    .select("id, version_number, full_text_snapshot")
    .eq("paper_id", paperIdValue)
    .order("version_number", { ascending: false });
  if (versions.error !== null) {
    return problem(400, "paper-versions-read-failed", versions.error.message);
  }

  const submission = buildSubmissionInput({
    body: {
      ...body,
      identifier: access.paper.identifier,
      authors: body.authors,
    },
    submitterId: auth.user.id,
    identifier: readString(access.paper.identifier),
  });
  const zone = await ensureCanSubmitToZone(service.client, submission.zoneId ?? null, auth.user.id);
  if (!zone.ok) {
    return zone.response;
  }

  const nextNumber = nextVersionNumber(versions.data ?? []);
  let versionRow;
  let linkRows;
  try {
    versionRow = buildPaperVersionInsertRow(submission, {
      paperId: paperIdValue,
      versionNumber: nextNumber,
      previousFullText: readString(versions.data?.[0]?.full_text_snapshot) || null,
    });
    linkRows = buildPaperLinkRows(submission, paperIdValue);
  } catch (error) {
    return problem(
      400,
      "invalid-paper-version",
      error instanceof Error ? error.message : "Paper version is invalid.",
    );
  }

  const versionInsert = await service.client
    .from("paper_versions")
    .insert(versionRow)
    .select("*")
    .single();
  if (versionInsert.error !== null) {
    return problem(400, "paper-version-create-failed", versionInsert.error.message);
  }

  await Promise.all([
    service.client.from("paper_authors").delete().eq("paper_id", paperIdValue),
    service.client.from("paper_links").delete().eq("paper_id", paperIdValue),
  ]);
  const [authorsInsert, linksInsert, paperUpdate] = await Promise.all([
    service.client.from("paper_authors").insert(buildPaperAuthorRows(submission, paperIdValue)),
    linkRows.length > 0
      ? service.client.from("paper_links").insert(linkRows)
      : Promise.resolve({ error: null }),
    service.client
      .from("papers")
      .update({
        title: versionRow.title_snapshot,
        abstract: versionRow.abstract_snapshot,
        categories: submission.categories,
        tags: submission.tags ?? [],
        license: submission.license,
        status: "submitted",
        safety_status: "pending",
        moderation_status: "clear",
        current_version_number: nextNumber,
      })
      .eq("id", paperIdValue)
      .select("*")
      .single(),
  ]);
  if (authorsInsert.error !== null) {
    return problem(400, "paper-authors-update-failed", authorsInsert.error.message);
  }
  if (linksInsert.error !== null) {
    return problem(400, "paper-links-update-failed", linksInsert.error.message);
  }
  if (paperUpdate.error !== null) {
    return problem(400, "paper-version-paper-update-failed", paperUpdate.error.message);
  }

  return NextResponse.json(
    {
      ok: true,
      paper: paperUpdate.data,
      version: versionInsert.data,
      immutable: true,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
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
