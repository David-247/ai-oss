import { describe, expect, it } from "vitest";
import {
  assertDeclaredTypeMatchesDetected,
  assertPaperVersionFileImmutable,
  buildFileScanJob,
  buildPaperFileLink,
  buildPublicBlobKey,
  computeFileIntegrity,
  createQuarantinedFileRow,
  evaluateScanResult,
  QUARANTINE_BUCKET,
  validateUploadRequest,
} from "@ai-oss/files";

describe("Phase 06 file upload pipeline", () => {
  it("validates allowed file types, size limits, quarantine keys, and permissions", () => {
    const decision = validateUploadRequest({
      ownerId: "user-1",
      uploaderId: "user-1",
      filename: "paper.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      context: "paper_file",
      paperId: "paper-1",
      paperVersionId: "version-1",
      fileKind: "pdf",
    });

    expect(decision).toMatchObject({
      allowed: true,
      fileType: "pdf",
      detectedMime: "application/pdf",
      quarantineBucket: QUARANTINE_BUCKET,
      requiredPermission: "research.create",
    });
    expect(decision.storageKey).toMatch(/^quarantine\/user-1\//);

    expect(
      validateUploadRequest({
        ownerId: "user-1",
        uploaderId: "user-1",
        filename: "dataset.parquet",
        contentType: "application/octet-stream",
        sizeBytes: 1024,
        context: "research_artifact",
      }),
    ).toMatchObject({
      allowed: false,
      reason: "unsupported_file_type",
    });

    expect(
      validateUploadRequest({
        ownerId: "user-1",
        uploaderId: "user-1",
        filename: "huge.pdf",
        contentType: "application/pdf",
        sizeBytes: 101 * 1024 * 1024,
        context: "paper_file",
        paperVersionId: "version-1",
      }),
    ).toMatchObject({
      allowed: false,
      reason: "file_too_large",
    });
  });

  it("computes integrity metadata and rejects declared/detected MIME mismatches", () => {
    const integrity = computeFileIntegrity({
      bytes: "%PDF-1.7\nhello",
      filename: "paper.pdf",
      declaredContentType: "application/pdf",
    });

    expect(integrity).toMatchObject({
      sizeBytes: 14,
      detectedMime: "application/pdf",
      fileType: "pdf",
    });
    expect(integrity.sha256).toMatch(/^[a-f0-9]{64}$/);

    expect(() =>
      assertDeclaredTypeMatchesDetected({
        filename: "paper.pdf",
        declaredContentType: "application/pdf",
        detectedMime: "image/png",
      }),
    ).toThrow(/does not match/i);
  });

  it("creates complete quarantine rows and file scan jobs", () => {
    const row = createQuarantinedFileRow({
      ownerId: "user-1",
      storageKey: "quarantine/user-1/2026-06-12/file.pdf",
      filename: "../file.pdf",
      declaredContentType: "application/pdf",
      detectedMime: "application/pdf",
      sizeBytes: 10,
      sha256: "a".repeat(64),
      context: "paper_file",
      paperId: "paper-1",
      paperVersionId: "version-1",
      fileKind: "pdf",
    });

    expect(row).toMatchObject({
      owner_id: "user-1",
      provider: "supabase",
      storage_key: "quarantine/user-1/2026-06-12/file.pdf",
      filename: "file.pdf",
      content_type: "application/pdf",
      size_bytes: 10,
      sha256: "a".repeat(64),
      visibility: "private",
      scan_status: "pending",
      moderation_status: "pending",
    });
    expect(row.metadata).toMatchObject({
      upload_context: "paper_file",
      publication_status: "quarantined",
      server_hash_verified: true,
    });

    expect(
      buildFileScanJob({
        fileId: "file-1",
        storageKey: row.storage_key,
        sha256: row.sha256,
      }),
    ).toMatchObject({
      name: "file_scan",
      idempotencyKey: "file-1",
      payload: {
        file_id: "file-1",
        storage_key: row.storage_key,
        sha256: row.sha256,
      },
    });
  });

  it("routes clean and suspicious scan results correctly", () => {
    expect(
      evaluateScanResult({
        fileId: "file-1",
        filename: "paper.pdf",
        declaredContentType: "application/pdf",
        detectedMime: "application/pdf",
        sha256: "a".repeat(64),
      }),
    ).toMatchObject({
      scanStatus: "clean",
      moderationStatus: "approved",
      publishable: true,
      route: "promote_public",
    });

    expect(
      evaluateScanResult({
        fileId: "file-2",
        filename: "paper.pdf",
        declaredContentType: "application/pdf",
        detectedMime: "application/pdf",
        sha256: "b".repeat(64),
        malwareDetected: true,
      }),
    ).toMatchObject({
      scanStatus: "suspicious",
      moderationStatus: "quarantined",
      publishable: false,
      route: "moderation_queue",
    });
  });

  it("builds immutable paper links and public blob keys without overwriting versions", () => {
    expect(
      buildPaperFileLink({
        paperId: "paper-1",
        paperVersionId: "version-1",
        fileId: "file-1",
        fileKind: "pdf",
      }),
    ).toEqual({
      paper_id: "paper-1",
      paper_version_id: "version-1",
      file_id: "file-1",
      file_kind: "pdf",
      immutable: true,
    });

    expect(
      buildPublicBlobKey({
        context: "paper_file",
        paperVersionId: "version-1",
        sha256: "a".repeat(64),
        filename: "Paper Final.pdf",
      }),
    ).toBe(`public/paper_file/version-1/${"a".repeat(64)}/Paper-Final.pdf`);

    expect(() =>
      assertPaperVersionFileImmutable(
        [{ paperVersionId: "version-1", fileKind: "pdf", immutable: true }],
        { paperVersionId: "version-1", fileKind: "pdf" },
      ),
    ).toThrow(/immutable/i);

    expect(() =>
      assertPaperVersionFileImmutable(
        [{ paperVersionId: "version-1", fileKind: "pdf", immutable: true }],
        { paperVersionId: "version-2", fileKind: "pdf" },
      ),
    ).not.toThrow();
  });
});
