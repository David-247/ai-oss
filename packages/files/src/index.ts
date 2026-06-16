import { createHash, randomUUID } from "node:crypto";

export const PACKAGE_NAME = "@ai-oss/files" as const;

export const QUARANTINE_BUCKET = "file-quarantine" as const;
export const PUBLIC_BLOB_PROVIDER = "vercel_blob" as const;
export const QUARANTINE_PROVIDER = "supabase" as const;

export const FILE_VISIBILITIES = [
  "public",
  "authenticated",
  "zone",
  "private",
  "moderator",
  "admin",
] as const;

export type FileVisibility = (typeof FILE_VISIBILITIES)[number];

export const FILE_SCAN_STATUSES = [
  "pending",
  "scanning",
  "clean",
  "suspicious",
  "infected",
  "failed",
] as const;

export type FileScanStatus = (typeof FILE_SCAN_STATUSES)[number];

export const FILE_MODERATION_STATUSES = ["pending", "approved", "quarantined", "removed"] as const;

export type FileModerationStatus = (typeof FILE_MODERATION_STATUSES)[number];

export const UPLOAD_CONTEXTS = [
  "avatar",
  "paper_file",
  "post_attachment",
  "comment_attachment",
  "chat_attachment",
  "research_artifact",
] as const;

export type UploadContext = (typeof UPLOAD_CONTEXTS)[number];

export const PAPER_FILE_KINDS = [
  "pdf",
  "source",
  "supplement",
  "dataset",
  "model",
  "code",
  "other",
] as const;

export type PaperFileKind = (typeof PAPER_FILE_KINDS)[number];

export interface FileTypePolicy {
  label: string;
  mimeTypes: readonly string[];
  extensions: readonly string[];
  maxBytes: number;
  paperKind?: PaperFileKind;
}

export const FILE_TYPE_POLICIES = {
  pdf: {
    label: "PDF",
    mimeTypes: ["application/pdf"],
    extensions: [".pdf"],
    maxBytes: 100 * 1024 * 1024,
    paperKind: "pdf",
  },
  markdown: {
    label: "Markdown",
    mimeTypes: ["text/markdown", "text/x-markdown"],
    extensions: [".md", ".markdown"],
    maxBytes: 10 * 1024 * 1024,
    paperKind: "source",
  },
  text: {
    label: "Plain text",
    mimeTypes: ["text/plain"],
    extensions: [".txt"],
    maxBytes: 10 * 1024 * 1024,
    paperKind: "supplement",
  },
  latex: {
    label: "LaTeX",
    mimeTypes: ["application/x-tex", "text/x-tex", "text/plain"],
    extensions: [".tex", ".bib", ".sty"],
    maxBytes: 10 * 1024 * 1024,
    paperKind: "source",
  },
  image: {
    label: "Figure image",
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    extensions: [".png", ".jpg", ".jpeg", ".webp", ".svg"],
    maxBytes: 25 * 1024 * 1024,
    paperKind: "supplement",
  },
  archive: {
    label: "Source archive",
    mimeTypes: ["application/zip", "application/gzip", "application/x-tar"],
    extensions: [".zip", ".tar", ".gz", ".tgz"],
    maxBytes: 100 * 1024 * 1024,
    paperKind: "source",
  },
  data: {
    label: "Small data supplement",
    mimeTypes: ["application/json", "text/csv"],
    extensions: [".json", ".csv"],
    maxBytes: 25 * 1024 * 1024,
    paperKind: "dataset",
  },
} as const satisfies Record<string, FileTypePolicy>;

export type FileTypeKey = keyof typeof FILE_TYPE_POLICIES;

export interface UploadRequestInput {
  ownerId: string;
  uploaderId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  context: UploadContext;
  zoneId?: string | null;
  paperId?: string | null;
  paperVersionId?: string | null;
  fileKind?: PaperFileKind;
}

export interface UploadPolicyDecision {
  allowed: boolean;
  reason?: string;
  fileType?: FileTypeKey;
  detectedMime: string;
  maxBytes?: number;
  quarantineBucket: typeof QUARANTINE_BUCKET;
  storageKey?: string;
  requiredPermission?: string | null;
}

export interface FileIntegrityInput {
  bytes: Uint8Array | Buffer | string;
  filename: string;
  declaredContentType: string;
}

export interface FileIntegrityMetadata {
  sha256: string;
  sizeBytes: number;
  detectedMime: string;
  fileType: FileTypeKey;
}

export interface FileInsertInput {
  ownerId: string;
  storageKey: string;
  filename: string;
  declaredContentType: string;
  detectedMime: string;
  sizeBytes: number;
  sha256: string;
  visibility?: FileVisibility;
  zoneId?: string | null;
  context: UploadContext;
  paperId?: string | null;
  paperVersionId?: string | null;
  fileKind?: PaperFileKind;
  metadata?: Record<string, unknown>;
}

export interface FileInsertRow {
  owner_id: string;
  provider: "supabase" | "vercel_blob" | "external";
  storage_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  visibility: FileVisibility;
  zone_id: string | null;
  scan_status: FileScanStatus;
  moderation_status: FileModerationStatus;
  metadata: Record<string, unknown>;
}

export interface ScanWorkflowInput {
  fileId: string;
  filename: string;
  declaredContentType: string;
  detectedMime: string;
  sha256: string;
  malwareDetected?: boolean;
  typeMismatch?: boolean;
  safetyFlags?: readonly string[];
  extractionText?: string | null;
}

export interface ScanWorkflowDecision {
  scanStatus: FileScanStatus;
  moderationStatus: FileModerationStatus;
  publishable: boolean;
  route: "promote_public" | "remain_private" | "moderation_queue" | "legal_queue";
  reasons: readonly string[];
  metadata: Record<string, unknown>;
}

export interface PaperFileLinkInput {
  paperId: string;
  paperVersionId: string;
  fileId: string;
  fileKind: PaperFileKind;
}

export interface PaperFileLinkRow {
  paper_id: string;
  paper_version_id: string;
  file_id: string;
  file_kind: PaperFileKind;
  immutable: true;
}

export interface ExistingPaperFileLink {
  paperVersionId: string;
  fileKind: PaperFileKind;
  immutable: boolean;
}

export function validateUploadRequest(input: UploadRequestInput): UploadPolicyDecision {
  if (input.ownerId.trim().length === 0 || input.uploaderId.trim().length === 0) {
    return denyUpload("owner_and_uploader_required", input.contentType);
  }
  if (input.ownerId !== input.uploaderId && input.context === "avatar") {
    return denyUpload("avatar_upload_requires_owner", input.contentType);
  }
  if (!UPLOAD_CONTEXTS.includes(input.context)) {
    return denyUpload("unknown_upload_context", input.contentType);
  }
  if (input.sizeBytes <= 0) {
    return denyUpload("file_empty", input.contentType);
  }

  const fileType = resolveFileType(input.filename, input.contentType);
  if (fileType === null) {
    return denyUpload("unsupported_file_type", input.contentType);
  }

  const policy = FILE_TYPE_POLICIES[fileType];
  if (input.sizeBytes > policy.maxBytes) {
    return {
      allowed: false,
      reason: "file_too_large",
      fileType,
      detectedMime: normalizeContentType(input.contentType),
      maxBytes: policy.maxBytes,
      quarantineBucket: QUARANTINE_BUCKET,
      requiredPermission: requiredPermissionForContext(input.context),
    };
  }

  if (input.context === "paper_file" && input.paperVersionId === undefined) {
    return {
      allowed: false,
      reason: "paper_version_required",
      fileType,
      detectedMime: normalizeContentType(input.contentType),
      maxBytes: policy.maxBytes,
      quarantineBucket: QUARANTINE_BUCKET,
      requiredPermission: requiredPermissionForContext(input.context),
    };
  }

  return {
    allowed: true,
    fileType,
    detectedMime: normalizeContentType(input.contentType),
    maxBytes: policy.maxBytes,
    quarantineBucket: QUARANTINE_BUCKET,
    storageKey: buildQuarantineStorageKey({
      ownerId: input.ownerId,
      filename: input.filename,
    }),
    requiredPermission: requiredPermissionForContext(input.context),
  };
}

export function computeFileIntegrity(input: FileIntegrityInput): FileIntegrityMetadata {
  const bytes = toBuffer(input.bytes);
  const detectedMime = detectMimeType(bytes, input.declaredContentType, input.filename);
  const fileType = resolveFileType(input.filename, detectedMime);
  if (fileType === null) {
    throw new Error(`Unsupported file type: ${input.filename}`);
  }

  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.byteLength,
    detectedMime,
    fileType,
  };
}

export function detectMimeType(
  bytes: Uint8Array | Buffer,
  declaredContentType: string,
  filename: string,
): string {
  const buffer = toBuffer(bytes);
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf";
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47])) {
    return "image/png";
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    return "application/zip";
  }

  const normalized = normalizeContentType(declaredContentType);
  const extension = extensionOf(filename);
  if (extension === ".json") {
    return "application/json";
  }
  if (extension === ".csv") {
    return "text/csv";
  }
  if (extension === ".md" || extension === ".markdown") {
    return "text/markdown";
  }
  if (extension === ".tex" || extension === ".bib" || extension === ".sty") {
    return "text/x-tex";
  }
  if (extension === ".svg") {
    return "image/svg+xml";
  }
  return normalized || "application/octet-stream";
}

export function resolveFileType(filename: string, contentType: string): FileTypeKey | null {
  const normalized = normalizeContentType(contentType);
  const extension = extensionOf(filename);
  for (const [key, policy] of Object.entries(FILE_TYPE_POLICIES)) {
    if (
      (policy.mimeTypes as readonly string[]).includes(normalized) &&
      policy.extensions.some((candidate) => candidate === extension)
    ) {
      return key as FileTypeKey;
    }
  }
  return null;
}

export function assertDeclaredTypeMatchesDetected(input: {
  filename: string;
  declaredContentType: string;
  detectedMime: string;
}): void {
  const declaredType = resolveFileType(input.filename, input.declaredContentType);
  const detectedType = resolveFileType(input.filename, input.detectedMime);
  if (declaredType === null || detectedType === null || declaredType !== detectedType) {
    throw new Error("Declared file type does not match server-detected MIME type.");
  }
}

export function createQuarantinedFileRow(input: FileInsertInput): FileInsertRow {
  return {
    owner_id: input.ownerId,
    provider: QUARANTINE_PROVIDER,
    storage_key: input.storageKey,
    filename: sanitizeFilename(input.filename),
    content_type: input.detectedMime,
    size_bytes: input.sizeBytes,
    sha256: input.sha256,
    visibility: input.visibility ?? "private",
    zone_id: input.zoneId ?? null,
    scan_status: "pending",
    moderation_status: "pending",
    metadata: {
      upload_context: input.context,
      declared_content_type: input.declaredContentType,
      detected_mime: input.detectedMime,
      paper_id: input.paperId ?? undefined,
      paper_version_id: input.paperVersionId ?? undefined,
      file_kind: input.fileKind ?? undefined,
      storage_bucket: QUARANTINE_BUCKET,
      publication_status: "quarantined",
      server_hash_verified: true,
      ...input.metadata,
    },
  };
}

export function evaluateScanResult(input: ScanWorkflowInput): ScanWorkflowDecision {
  const reasons: string[] = [];

  if (input.malwareDetected === true) {
    reasons.push("malware_detected");
  }
  if (input.typeMismatch === true) {
    reasons.push("mime_type_mismatch");
  }
  if ((input.safetyFlags ?? []).length > 0) {
    reasons.push(...(input.safetyFlags ?? []));
  }

  if (reasons.some((reason) => reason.includes("illegal") || reason.includes("csam"))) {
    return scanDecision("infected", "quarantined", false, "legal_queue", reasons, input);
  }

  if (reasons.length > 0) {
    return scanDecision("suspicious", "quarantined", false, "moderation_queue", reasons, input);
  }

  return scanDecision("clean", "approved", true, "promote_public", ["clean"], input);
}

export function buildPublicBlobKey(input: {
  context: UploadContext;
  sha256: string;
  filename: string;
  paperVersionId?: string | null;
}): string {
  const segments = ["public", input.context];
  if (input.paperVersionId) {
    segments.push(input.paperVersionId);
  }
  segments.push(input.sha256, sanitizeFilename(input.filename));
  return segments.join("/");
}

export function buildPaperFileLink(input: PaperFileLinkInput): PaperFileLinkRow {
  return {
    paper_id: input.paperId,
    paper_version_id: input.paperVersionId,
    file_id: input.fileId,
    file_kind: input.fileKind,
    immutable: true,
  };
}

export function assertPaperVersionFileImmutable(
  existing: readonly ExistingPaperFileLink[],
  next: { paperVersionId: string; fileKind: PaperFileKind },
): void {
  const collision = existing.find(
    (link) =>
      link.immutable &&
      link.paperVersionId === next.paperVersionId &&
      link.fileKind === next.fileKind,
  );
  if (collision !== undefined) {
    throw new Error("Published paper version files are immutable; create a new version instead.");
  }
}

export function buildFileScanJob(input: {
  fileId: string;
  storageKey: string;
  sha256: string;
  correlationId?: string;
}) {
  return {
    name: "file_scan" as const,
    payload: {
      file_id: input.fileId,
      storage_key: input.storageKey,
      sha256: input.sha256,
    },
    idempotencyKey: input.fileId,
    correlationId: input.correlationId,
  };
}

export function requiredPermissionForContext(context: UploadContext): string | null {
  if (context === "paper_file" || context === "research_artifact") {
    return "research.create";
  }
  if (
    context === "post_attachment" ||
    context === "comment_attachment" ||
    context === "chat_attachment"
  ) {
    return "content.create";
  }
  return null;
}

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop()?.trim() ?? "upload.bin";
  return (
    base
      .replaceAll(/\s+/g, "-")
      .replaceAll(/[^a-zA-Z0-9._-]/g, "")
      .replaceAll(/-{2,}/g, "-")
      .slice(0, 160)
      .replace(/^\.+/, "") || "upload.bin"
  );
}

function buildQuarantineStorageKey(input: { ownerId: string; filename: string }): string {
  const date = new Date().toISOString().slice(0, 10);
  return ["quarantine", input.ownerId, date, `${randomUUID()}-${sanitizeFilename(input.filename)}`]
    .join("/")
    .toLowerCase();
}

function denyUpload(reason: string, contentType: string): UploadPolicyDecision {
  return {
    allowed: false,
    reason,
    detectedMime: normalizeContentType(contentType),
    quarantineBucket: QUARANTINE_BUCKET,
    requiredPermission: null,
  };
}

function scanDecision(
  scanStatus: FileScanStatus,
  moderationStatus: FileModerationStatus,
  publishable: boolean,
  route: ScanWorkflowDecision["route"],
  reasons: readonly string[],
  input: ScanWorkflowInput,
): ScanWorkflowDecision {
  return {
    scanStatus,
    moderationStatus,
    publishable,
    route,
    reasons,
    metadata: {
      scan_completed_at: new Date().toISOString(),
      declared_content_type: input.declaredContentType,
      detected_mime: input.detectedMime,
      sha256: input.sha256,
      extraction_text_present: Boolean(input.extractionText),
      safety_flags: input.safetyFlags ?? [],
    },
  };
}

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function extensionOf(filename: string): string {
  const clean = sanitizeFilename(filename).toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot);
}

function toBuffer(input: Uint8Array | Buffer | string): Buffer {
  if (typeof input === "string") {
    return Buffer.from(input);
  }
  return Buffer.from(input);
}

function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
  return signature.every((value, index) => buffer[index] === value);
}
