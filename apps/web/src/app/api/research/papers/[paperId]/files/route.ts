import { NextResponse } from "next/server";
import { checkPermission } from "@ai-oss/permissions";
import {
  assertPaperVersionFileImmutable,
  buildPaperFileLink,
  type PaperFileKind,
} from "@ai-oss/files";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { loadActorContext, readRequestBody, readString } from "@/lib/permissions-server";
import { loadPaperAccess } from "@/lib/research-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ paperId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const { paperId } = await context.params;
  const user = await maybeAuthenticatedUser(request);
  if (!user.ok) {
    return user.response;
  }
  const access = await loadPaperAccess(service.client, paperId, user.userId);
  if (!access.ok) {
    return access.response;
  }
  if (!access.canRead) {
    return problem(403, "paper-files-read-denied", "Paper files are not visible to this session.");
  }

  const { data, error } = await service.client
    .from("paper_files")
    .select("*, files(*)")
    .eq("paper_id", readString(access.paper.id))
    .order("created_at", { ascending: true });

  if (error !== null) {
    return problem(400, "paper-files-read-failed", error.message);
  }

  return NextResponse.json({ paperId, files: data }, { headers: { "Cache-Control": "no-store" } });
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
  if (!access.submitterOwnsPaper) {
    const actor = await loadActorContext(service.client, auth.user.id);
    const permission = checkPermission({
      actor,
      scope: "research.update",
      resource: { ownerId: readString(access.paper.submitter_id) },
    });
    if (!permission.allowed) {
      return problem(403, "paper-file-permission-denied", permission.reasons.join(", "));
    }
  }
  if (access.paper.legal_hold === true) {
    return problem(
      409,
      "paper-legal-hold",
      "Paper files cannot change while a legal hold is active.",
    );
  }

  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-paper-file-request", "Expected a JSON object body.");
  }

  const fileId = readString(body.fileId ?? body.file_id);
  const paperVersionId = readString(body.paperVersionId ?? body.paper_version_id);
  const fileKind = readString(body.fileKind ?? body.file_kind) as PaperFileKind;
  if (!fileId || !paperVersionId || !fileKind) {
    return problem(
      400,
      "paper-file-fields-required",
      "fileId, paperVersionId, and fileKind are required.",
    );
  }

  const [file, version, existing] = await Promise.all([
    service.client.from("files").select("*").eq("id", fileId).single(),
    service.client
      .from("paper_versions")
      .select("id, paper_id, status, file_hashes")
      .eq("id", paperVersionId)
      .eq("paper_id", readString(access.paper.id))
      .single(),
    service.client
      .from("paper_files")
      .select("paper_version_id, file_kind, immutable")
      .eq("paper_version_id", paperVersionId),
  ]);

  if (file.error !== null) {
    return problem(404, "file-not-found", file.error.message);
  }
  if (version.error !== null) {
    return problem(404, "paper-version-not-found", version.error.message);
  }
  if (existing.error !== null) {
    return problem(400, "paper-files-existing-read-failed", existing.error.message);
  }
  if (file.data.scan_status !== "clean" || file.data.moderation_status !== "approved") {
    return problem(
      409,
      "file-not-clean",
      "Only clean and approved files can attach to paper versions.",
    );
  }

  try {
    assertPaperVersionFileImmutable(
      (existing.data ?? []).map((link) => ({
        paperVersionId: link.paper_version_id,
        fileKind: link.file_kind,
        immutable: link.immutable,
      })),
      { paperVersionId, fileKind },
    );
  } catch (error) {
    return problem(
      409,
      "paper-version-file-immutable",
      error instanceof Error ? error.message : String(error),
    );
  }

  const linkRow = buildPaperFileLink({
    paperId: readString(access.paper.id),
    paperVersionId,
    fileId,
    fileKind,
  });
  const { data, error } = await service.client
    .from("paper_files")
    .insert(linkRow)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "paper-file-link-failed", error.message);
  }

  const fileHashes = Array.isArray(version.data.file_hashes) ? version.data.file_hashes : [];
  await service.client
    .from("paper_versions")
    .update({
      file_hashes: [
        ...fileHashes,
        {
          file_id: fileId,
          file_kind: fileKind,
          sha256: file.data.sha256,
          size_bytes: file.data.size_bytes,
          content_type: file.data.content_type,
        },
      ],
    })
    .eq("id", paperVersionId);

  return NextResponse.json(
    { ok: true, paperId, fileLink: data },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
