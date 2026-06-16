import { NextResponse } from "next/server";
import {
  buildPaperAuthorRows,
  buildPaperInsertRow,
  buildPaperLinkRows,
  buildPaperVersionInsertRow,
  generatePaperIdentifier,
} from "@ai-oss/research";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import {
  buildSubmissionInput,
  ensureCanSubmitToZone,
  isRecord,
  nextMonthlyIdentifierSequence,
  readString,
} from "@/lib/research-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const url = new URL(request.url);
  const limit = clampNumber(url.searchParams.get("limit"), 1, 100, 50);
  let query = service.client
    .from("papers")
    .select(
      "*, paper_authors(*), paper_versions(version_number, status, submitted_at, published_at)",
    )
    .in("status", ["published", "withdrawn", "superseded", "retracted", "redacted"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  const tag = url.searchParams.get("tag");
  if (tag !== null) {
    query = query.contains("tags", [tag]);
  }
  const category = url.searchParams.get("category");
  if (category !== null) {
    query = query.contains("categories", [category]);
  }

  const { data, error } = await query;
  if (error !== null) {
    return problem(400, "papers-read-failed", error.message);
  }

  return NextResponse.json(
    {
      papers: data ?? [],
      label: "Not peer reviewed / not platform endorsed",
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
    return problem(400, "invalid-paper-request", "Expected a JSON object body.");
  }
  const trustGate = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "research_upload",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!trustGate.ok) {
    return trustGate.response;
  }

  const sequence = await nextMonthlyIdentifierSequence(service.client);
  if (!sequence.ok) {
    return sequence.response;
  }
  const identifier =
    readString(body.identifier) ||
    generatePaperIdentifier({
      sequence: sequence.sequence,
    });
  const submission = buildSubmissionInput({
    body,
    submitterId: auth.user.id,
    identifier,
  });

  const zone = await ensureCanSubmitToZone(service.client, submission.zoneId ?? null, auth.user.id);
  if (!zone.ok) {
    return zone.response;
  }

  let paperRow;
  let versionRow;
  let authorRows;
  let linkRows;
  try {
    paperRow = buildPaperInsertRow(submission);
    authorRows = buildPaperAuthorRows(submission, "pending-paper-id");
    linkRows = buildPaperLinkRows(submission, "pending-paper-id");
  } catch (error) {
    return problem(
      400,
      "invalid-research-submission",
      error instanceof Error ? error.message : "Research submission is invalid.",
    );
  }

  const paperInsert = await service.client.from("papers").insert(paperRow).select("*").single();
  if (paperInsert.error !== null) {
    return problem(400, "paper-create-failed", paperInsert.error.message);
  }

  try {
    versionRow = buildPaperVersionInsertRow(submission, {
      paperId: paperInsert.data.id,
      versionNumber: 1,
    });
  } catch (error) {
    return problem(
      400,
      "invalid-paper-version",
      error instanceof Error ? error.message : "Paper version is invalid.",
    );
  }

  const [versionInsert, authorsInsert, linksInsert] = await Promise.all([
    service.client.from("paper_versions").insert(versionRow).select("*").single(),
    service.client
      .from("paper_authors")
      .insert(authorRows.map((row) => ({ ...row, paper_id: paperInsert.data.id }))),
    linkRows.length > 0
      ? service.client
          .from("paper_links")
          .insert(linkRows.map((row) => ({ ...row, paper_id: paperInsert.data.id })))
      : Promise.resolve({ error: null }),
  ]);
  if (versionInsert.error !== null) {
    return problem(400, "paper-version-create-failed", versionInsert.error.message);
  }
  if (authorsInsert.error !== null) {
    return problem(400, "paper-authors-create-failed", authorsInsert.error.message);
  }
  if (linksInsert.error !== null) {
    return problem(400, "paper-links-create-failed", linksInsert.error.message);
  }

  const updated = await service.client
    .from("papers")
    .update({ current_version_number: 1 })
    .eq("id", paperInsert.data.id)
    .select("*")
    .single();
  if (updated.error !== null) {
    return problem(400, "paper-current-version-update-failed", updated.error.message);
  }

  return NextResponse.json(
    {
      ok: true,
      paper: updated.data,
      version: versionInsert.data,
      label: "Not peer reviewed / not platform endorsed",
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
