import { NextResponse } from "next/server";
import { createDefaultJobRegistry } from "@ai-oss/jobs";
import {
  buildFileScanJob,
  createQuarantinedFileRow,
  detectMimeType,
  QUARANTINE_BUCKET,
  validateUploadRequest,
  type PaperFileKind,
  type UploadContext,
} from "@ai-oss/files";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { correlationIdFromRequest, readRequestBody, readString } from "@/lib/permissions-server";

export const runtime = "nodejs";

const registry = createDefaultJobRegistry();

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
    return problem(400, "invalid-file-complete-request", "Expected a JSON object body.");
  }

  const filename = readString(body.filename);
  const declaredContentType = readString(body.contentType) || readString(body.content_type);
  const sizeBytes = readNumber(body.sizeBytes ?? body.size_bytes);
  const storageKey = readString(body.storageKey ?? body.storage_key);
  const sha256 = readString(body.sha256).toLowerCase();
  const context = readString(body.context) as UploadContext;
  const zoneId = readString(body.zoneId ?? body.zone_id) || null;
  const paperId = readString(body.paperId ?? body.paper_id) || null;
  const paperVersionId = readString(body.paperVersionId ?? body.paper_version_id) || null;
  const fileKind = (readString(body.fileKind ?? body.file_kind) || undefined) as
    | PaperFileKind
    | undefined;

  if (!storageKey.startsWith(`quarantine/${auth.user.id}/`)) {
    return problem(
      403,
      "upload-scope-mismatch",
      "Storage key is outside the user quarantine scope.",
    );
  }
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    return problem(
      400,
      "invalid-sha256",
      "A lowercase 64-character SHA256 hex digest is required.",
    );
  }

  const policy = validateUploadRequest({
    ownerId: auth.user.id,
    uploaderId: auth.user.id,
    filename,
    contentType: declaredContentType,
    sizeBytes,
    context,
    zoneId,
    paperId,
    paperVersionId,
    fileKind,
  });
  if (!policy.allowed) {
    return problem(400, "upload-rejected", policy.reason ?? "Upload completion rejected.");
  }

  const detectedMime = detectMimeType(Buffer.alloc(0), declaredContentType, filename);
  const row = createQuarantinedFileRow({
    ownerId: auth.user.id,
    storageKey,
    filename,
    declaredContentType,
    detectedMime,
    sizeBytes,
    sha256,
    visibility: "private",
    zoneId,
    context,
    paperId,
    paperVersionId,
    fileKind,
    metadata: {
      server_hash_verified: false,
      server_mime_verified: false,
      upload_completion_source: "client_reported_integrity",
    },
  });

  const { data, error } = await service.client.from("files").insert(row).select("*").single();
  if (error !== null) {
    return problem(400, "file-record-create-failed", error.message);
  }

  const scanJob = buildFileScanJob({
    fileId: data.id,
    storageKey,
    sha256,
    correlationId: correlationIdFromRequest(request),
  });
  const run = await registry.run(scanJob);

  return NextResponse.json(
    {
      ok: true,
      file: data,
      quarantineBucket: QUARANTINE_BUCKET,
      scanJob: run,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

function readNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
