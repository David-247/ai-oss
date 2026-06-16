import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildConsentEvents,
  buildAccountDeletionPlan,
  serializePrivacyExport,
} from "@ai-oss/auth";
import {
  buildLegalRequestRow,
  buildPrivacyRequestRow,
  normalizeCookieConsent,
} from "@ai-oss/compliance";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("Phase 22 compliance QA flows", () => {
  it("tracks cookie consent, GPC, and privacy request due dates", () => {
    const consent = normalizeCookieConsent({
      categories: { analytics: true, marketing: true },
      gpcSignal: true,
      now: new Date("2026-06-12T00:00:00.000Z"),
    });
    expect(consent).toMatchObject({
      strictly_necessary: true,
      analytics: false,
      marketing: false,
      gpc_signal: true,
      do_not_sell_share: true,
      behavioral_advertising: false,
    });

    const privacy = buildPrivacyRequestRow({
      userId: "user-1",
      requestType: "export",
      jurisdiction: "gdpr",
      message: "Export my account archive.",
      now: new Date("2026-06-12T00:00:00.000Z"),
    });
    expect(privacy.request_type).toBe("export");
    expect(privacy.due_at).toBe("2026-07-12T00:00:00.000Z");
  });

  it("covers deletion/anonymization, consent versioning, and terms acceptance records", () => {
    const exportRecord = serializePrivacyExport({
      profile: { username: "ada" },
      settings: { visibility: { email: "private" } },
      zoneMemberships: [],
      posts: [{ id: "post-1" }],
      comments: [],
      papers: [],
      reviews: [],
      replicationReports: [],
      votes: [],
      moderationHistory: [],
      donations: [],
      consentEvents: [{ policy_key: "terms", policy_version: "phase-03" }],
    });
    expect(exportRecord.exportedAt).toBeDefined();
    expect(exportRecord.formatVersion).toBe("2026-06-12.phase03.v1");

    const deletion = buildAccountDeletionPlan({
      userId: "user-1",
      requestedAt: "2026-06-12T00:00:00.000Z",
      hasLegalHold: false,
      publicPosts: 3,
      publicComments: 4,
      publishedPapers: 2,
      privateChatMessages: 5,
    });
    expect(deletion.privateDataAction).toBe("delete_or_anonymize");
    expect(deletion.researchAction).toBe("withdraw_redact_or_pseudonymize_never_destroy_versions");

    const consents = buildConsentEvents("user-1", {
      email: "ada@example.test",
      password: "correct horse battery staple",
      username: "ada",
      ageAttested: true,
      consents: {
        terms: "phase-03",
        privacy: "phase-03",
        community_guidelines: "phase-03",
        research_publishing: "phase-03",
        cookie_policy: "phase-03",
      },
    });
    expect(consents.map((event) => event.policy_key)).toContain("terms");
    expect(read("apps/web/src/app/signup/page.tsx")).toContain("terms_version");
  });

  it("builds DMCA, DSA, and OSA intake rows with appeal/redress metadata", () => {
    const base = {
      requester: "Ada Lovelace",
      requesterEmail: "ada@example.test",
      targetUrl: "https://www.ai-oss.net/research/AI-OSS-2026-0001",
      description: "This report contains enough detail for intake review.",
      statement: "I certify the report is accurate.",
      signature: "Ada Lovelace",
      now: new Date("2026-06-12T00:00:00.000Z"),
    };

    const dmca = buildLegalRequestRow({ ...base, requestType: "dmca_takedown" });
    const dsa = buildLegalRequestRow({ ...base, requestType: "dsa_notice" });
    const osa = buildLegalRequestRow({ ...base, requestType: "osa_illegal_content" });

    expect(dmca.legal_hold).toBe(true);
    expect(dsa.details.statementOfReasonsRequired).toBe(true);
    expect(osa.details.statementOfReasonsRequired).toBe(true);
    expect(read("apps/web/src/app/api/legal/dmca/route.ts")).toContain("dmca");
    expect(read("apps/web/src/app/api/legal/dsa/route.ts")).toContain("dsa");
    expect(read("apps/web/src/app/api/legal/online-safety/route.ts")).toContain(
      "legalRequestTypeForOnlineSafety",
    );
  });
});
