import { NextResponse } from "next/server";
import { buildReplicationReportInsertRow } from "@ai-oss/research";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { readRequestBody } from "@/lib/permissions-server";
import { isRecord, loadPaperAccess, readString } from "@/lib/research-server";

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
    .from("replication_reports")
    .select("*, profiles(username, display_name)")
    .eq("paper_id", readString(access.paper.id))
    .eq("status", "published")
    .neq("moderation_status", "removed")
    .order("created_at", { ascending: false });
  if (error !== null) {
    return problem(400, "replication-reports-read-failed", error.message);
  }

  return NextResponse.json(
    { replications: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
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
  if (!access.canRead) {
    return problem(403, "replication-report-denied", "Paper is not visible to this session.");
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-replication-request", "Expected a JSON object body.");
  }

  let row;
  try {
    row = buildReplicationReportInsertRow({
      paperId: readString(access.paper.id),
      paperVersionId: readString(body.paperVersionId ?? body.paper_version_id) || null,
      reporterId: auth.user.id,
      environment: readString(body.environment) || null,
      hardware: readString(body.hardware) || null,
      dataSnapshot: readString(body.dataSnapshot ?? body.data_snapshot) || null,
      commitHash: readString(body.commitHash ?? body.commit_hash) || null,
      resultStatus: readReplicationResult(body.resultStatus ?? body.result_status),
      notes: readString(body.notes),
    });
  } catch (error) {
    return problem(
      400,
      "invalid-replication-report",
      error instanceof Error ? error.message : "Replication report is invalid.",
    );
  }

  const { data, error } = await service.client
    .from("replication_reports")
    .insert(row)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "replication-report-create-failed", error.message);
  }

  return NextResponse.json(
    { ok: true, replication: data },
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

function readReplicationResult(
  value: unknown,
): "replicated" | "partially_replicated" | "not_replicated" | "inconclusive" {
  return value === "partially_replicated" || value === "not_replicated" || value === "inconclusive"
    ? value
    : "replicated";
}
