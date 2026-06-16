import { describe, expect, it } from "vitest";
import {
  assertDeclaredTypeMatchesDetected,
  assertPaperVersionFileImmutable,
  buildPublicBlobKey,
  detectMimeType,
  evaluateScanResult,
  sanitizeFilename,
  validateUploadRequest,
} from "@ai-oss/files";

describe("Phase 06 file upload security controls", () => {
  it("rejects MIME spoofing when server-detected bytes disagree with the declaration", () => {
    const detectedMime = detectMimeType(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00]),
      "application/pdf",
      "paper.pdf",
    );

    expect(detectedMime).toBe("image/png");
    expect(() =>
      assertDeclaredTypeMatchesDetected({
        filename: "paper.pdf",
        declaredContentType: "application/pdf",
        detectedMime,
      }),
    ).toThrow(/declared file type/i);
  });

  it("keeps unscanned files in private quarantine scope", () => {
    const decision = validateUploadRequest({
      ownerId: "user-1",
      uploaderId: "user-1",
      filename: "avatar.png",
      contentType: "image/png",
      sizeBytes: 2048,
      context: "avatar",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.storageKey).toMatch(/^quarantine\/user-1\//);
    expect(decision.storageKey).not.toContain("/public/");
  });

  it("does not host unsupported large raw datasets", () => {
    expect(
      validateUploadRequest({
        ownerId: "user-1",
        uploaderId: "user-1",
        filename: "raw-dataset.parquet",
        contentType: "application/octet-stream",
        sizeBytes: 500 * 1024 * 1024,
        context: "research_artifact",
      }),
    ).toMatchObject({
      allowed: false,
      reason: "unsupported_file_type",
    });
  });

  it("routes illegal or suspicious files away from public promotion", () => {
    expect(
      evaluateScanResult({
        fileId: "file-1",
        filename: "payload.zip",
        declaredContentType: "application/zip",
        detectedMime: "application/zip",
        sha256: "f".repeat(64),
        safetyFlags: ["illegal_content_signal"],
      }),
    ).toMatchObject({
      scanStatus: "infected",
      moderationStatus: "quarantined",
      publishable: false,
      route: "legal_queue",
    });

    expect(
      evaluateScanResult({
        fileId: "file-2",
        filename: "payload.zip",
        declaredContentType: "application/zip",
        detectedMime: "application/zip",
        sha256: "e".repeat(64),
        typeMismatch: true,
      }),
    ).toMatchObject({
      scanStatus: "suspicious",
      publishable: false,
      route: "moderation_queue",
    });
  });

  it("prevents overwriting a published paper version file in place", () => {
    expect(() =>
      assertPaperVersionFileImmutable(
        [{ paperVersionId: "version-1", fileKind: "source", immutable: true }],
        { paperVersionId: "version-1", fileKind: "source" },
      ),
    ).toThrow(/create a new version/i);

    expect(
      buildPublicBlobKey({
        context: "paper_file",
        paperVersionId: "version-2",
        sha256: "1".repeat(64),
        filename: sanitizeFilename("source archive.zip"),
      }),
    ).toContain("/version-2/");
  });
});
