import { NextResponse } from "next/server";
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
  if (!access.submitterOwnsPaper) {
    return problem(403, "paper-withdraw-denied", "Only the submitter can withdraw a paper.");
  }
  if (access.paper.legal_hold === true) {
    return problem(409, "paper-legal-hold", "Papers under legal hold cannot be self-withdrawn.");
  }

  const body = await readRequestBody(request);
  if (!isRecord(body) || !readString(body.reason)) {
    return problem(400, "withdrawal-reason-required", "Withdrawal reason is required.");
  }

  const paperIdValue = readString(access.paper.id);
  const latest = await latestVersionForPaper(service.client, paperIdValue);
  if (!latest.ok) {
    return latest.response;
  }
  const withdrawnAt = new Date().toISOString();
  const [paperUpdate, versionUpdate] = await Promise.all([
    service.client
      .from("papers")
      .update({
        status: "withdrawn",
        withdrawn_at: withdrawnAt,
      })
      .eq("id", paperIdValue)
      .select("*")
      .single(),
    latest.version === null
      ? Promise.resolve({ error: null, data: null })
      : service.client
          .from("paper_versions")
          .update({
            status: "withdrawn",
            withdrawn_at: withdrawnAt,
          })
          .eq("id", latest.version.id)
          .select("*")
          .single(),
  ]);
  if (paperUpdate.error !== null) {
    return problem(400, "paper-withdraw-failed", paperUpdate.error.message);
  }
  if (versionUpdate.error !== null) {
    return problem(400, "paper-version-withdraw-failed", versionUpdate.error.message);
  }

  return NextResponse.json(
    {
      ok: true,
      paper: paperUpdate.data,
      version: versionUpdate.data,
      reason: readString(body.reason),
      preservedVersions: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
