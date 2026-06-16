import { describe, expect, it } from "vitest";
import {
  buildCitationExports,
  buildPaperAuthorRows,
  buildPaperInsertRow,
  buildPaperPageDescriptor,
  buildPaperVersionInsertRow,
  evaluatePublishingChecks,
  formatVersionIdentifier,
  generatePaperIdentifier,
  nextVersionNumber,
  rankPapers,
  validateResearchSubmission,
} from "@ai-oss/research";

const submission = {
  submitterId: "user-1",
  identifier: "AIOSS:202606.00042",
  title: "Reproducible Sparse Attention Evaluations",
  abstract:
    "A reproducible evaluation of sparse attention implementations with methodology, limitations, and safety notes.",
  authors: [
    {
      name: "Ada Researcher",
      profileId: "user-1",
      affiliation: "AI-OSS Lab",
      isSubmitter: true,
      isCorresponding: true,
    },
  ],
  submitterRelationship: "I am the corresponding author.",
  categories: ["cs.LG", "AI Safety"],
  tags: ["evals", "sparse attention"],
  license: "cc-by-4.0",
  fullText: "Full paper text with methods, results, limitations, and reproducibility details.",
  fileHashes: [{ file_id: "file-1", sha256: "a".repeat(64) }],
  safetyDisclosure: "No harmful capability increase identified.",
  modelDataDisclosure: "Uses public benchmark data and open model checkpoints.",
  reproducibilityChecklist: { code_available: true, seeds_reported: true },
  uploadRightsConfirmed: true,
  notPeerReviewedAcknowledged: true,
  contactPreference: "platform_messages" as const,
  links: [{ type: "code" as const, url: "https://example.com/code", label: "Code" }],
};

describe("Phase 09 research versioning and publishing", () => {
  it("generates stable identifiers and immutable version labels", () => {
    expect(
      generatePaperIdentifier({ sequence: 7, now: new Date("2026-06-12T00:00:00.000Z") }),
    ).toBe("AIOSS:202606.00007");
    expect(formatVersionIdentifier("AIOSS:202606.00007", 2)).toBe("AIOSS:202606.00007v2");
    expect(nextVersionNumber([{ version_number: 1 }, { version_number: 3 }])).toBe(4);
  });

  it("requires the Phase 09 submission fields", () => {
    expect(validateResearchSubmission({ ...submission, authors: [] }).reasons).toContain(
      "authors_required",
    );
    expect(
      validateResearchSubmission({ ...submission, uploadRightsConfirmed: false }).reasons,
    ).toContain("upload_rights_confirmation_required");
    expect(validateResearchSubmission(submission).allowed).toBe(true);
  });

  it("builds paper, author, and version rows without overwriting old versions", () => {
    expect(buildPaperInsertRow(submission)).toMatchObject({
      identifier: "AIOSS:202606.00042",
      status: "submitted",
      current_version_number: 0,
      not_peer_reviewed_label_acknowledged: true,
    });

    const version1 = buildPaperVersionInsertRow(submission, {
      paperId: "paper-1",
      versionNumber: 1,
    });
    const version2 = buildPaperVersionInsertRow(
      { ...submission, fullText: `${submission.fullText} Updated results.` },
      {
        paperId: "paper-1",
        versionNumber: 2,
        previousFullText: submission.fullText,
      },
    );

    expect(version1.version_number).toBe(1);
    expect(version2.version_number).toBe(2);
    expect(version2.text_diff_from_previous).toMatch(/changed from/i);
    expect(buildPaperAuthorRows(submission, "paper-1")[0]).toMatchObject({
      author_slug: "ada-researcher",
      is_submitter: true,
    });
  });

  it("publishes only after automated checks pass and quarantines blocked submissions", () => {
    expect(
      evaluatePublishingChecks({
        malwareScan: "pass",
        metadataValidation: "pass",
        licenseAttestation: "pass",
        safetyCheck: "pass",
        legalCheck: "pass",
      }),
    ).toMatchObject({
      status: "published",
      publishable: true,
      safetyStatus: "clear",
    });

    expect(
      evaluatePublishingChecks({
        malwareScan: "pass",
        metadataValidation: "pass",
        licenseAttestation: "pass",
        safetyCheck: "block",
        legalCheck: "pass",
      }),
    ).toMatchObject({
      status: "quarantined",
      publishable: false,
      moderationStatus: "quarantined",
    });
  });

  it("builds citation exports and the not-endorsed paper page descriptor", () => {
    const citation = buildCitationExports({
      identifier: submission.identifier,
      title: submission.title,
      authors: submission.authors,
      year: 2026,
      abstract: submission.abstract,
      license: submission.license,
    });
    expect(citation.bibtex).toContain("@misc{AIOSS20260600042");
    expect(citation.ris).toContain("TY  - GEN");
    expect(citation.cslJson).toMatchObject({ id: submission.identifier });

    expect(
      buildPaperPageDescriptor({
        paper: {
          identifier: submission.identifier,
          title: submission.title,
          status: "published",
          safety_status: "clear",
        },
        version: { version_number: 1, submitted_at: "2026-06-12T00:00:00.000Z" },
        authors: [{ author_name: "Ada Researcher" }],
        abstract: submission.abstract,
        license: submission.license,
      }),
    ).toMatchObject({
      versionLabel: "AIOSS:202606.00042v1",
      notPeerReviewedLabel: "Not peer reviewed / not platform endorsed",
    });
  });

  it("demotes papers with unresolved safety or legal flags", () => {
    expect(
      rankPapers([
        {
          id: "flagged",
          createdAt: "2026-06-12T00:00:00.000Z",
          voteScore: 100,
          safetyStatus: "flagged",
        },
        {
          id: "clean",
          createdAt: "2026-06-11T00:00:00.000Z",
          voteScore: 5,
          reviewScore: 4,
          replicationScore: 2,
        },
      ])[0]?.id,
    ).toBe("clean");
  });
});
