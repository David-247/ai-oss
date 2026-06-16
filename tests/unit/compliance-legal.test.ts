import { describe, expect, it } from "vitest";
import {
  BEHAVIORAL_ADVERTISING_AT_LAUNCH,
  DO_NOT_SELL_OR_SHARE_DEFAULT,
  LEGAL_POLICY_SLUGS,
  buildAiMetadata,
  buildLegalRequestRow,
  buildPrivacyRequestRow,
  buildTransparencyEventRow,
  legalPolicyForSlug,
  legalPolicySummaries,
  normalizeCookieConsent,
  privacyRequestDueAt,
  validateAiMetadata,
} from "@ai-oss/compliance";

describe("Phase 18 compliance and legal architecture", () => {
  it("defines all required policy pages and launch privacy defaults", () => {
    expect(legalPolicySummaries().map((page) => page.slug)).toEqual([...LEGAL_POLICY_SLUGS]);
    expect(legalPolicyForSlug("privacy")).toMatchObject({
      title: "Privacy Policy",
      version: "2026-06-12.phase18",
    });
    expect(legalPolicyForSlug("dsa")?.sections[0]?.body.join(" ")).toContain(
      "statement of reasons",
    );
    expect(DO_NOT_SELL_OR_SHARE_DEFAULT).toBe(true);
    expect(BEHAVIORAL_ADVERTISING_AT_LAUNCH).toBe(false);
  });

  it("builds privacy request rows with rights metadata, GPC, and SLA due dates", () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const row = buildPrivacyRequestRow({
      userId: "user-1",
      requestType: "do_not_sell_share",
      jurisdiction: "ccpa_cpra",
      message: "Honor my GPC signal.",
      gpcSignal: true,
      now,
    });

    expect(row).toMatchObject({
      user_id: "user-1",
      request_type: "opt_out_sale_share",
      jurisdiction: "ccpa_cpra",
      verification_status: "authenticated",
      gpc_signal: true,
      do_not_sell_share: true,
    });
    expect(row.due_at).toBe("2026-06-27T00:00:00.000Z");
    expect(
      privacyRequestDueAt({
        requestType: "export",
        jurisdiction: "gdpr",
        now,
      }),
    ).toBe("2026-07-12T00:00:00.000Z");
  });

  it("builds DMCA, DSA, OSA, underage, and transparency records", () => {
    expect(
      buildLegalRequestRow({
        requestType: "dmca_takedown",
        requester: "Copyright Owner",
        requesterEmail: "owner@example.com",
        targetType: "paper",
        targetId: "11111111-1111-4111-8111-111111111111",
        targetUrl: "https://example.test/research/1",
        jurisdiction: "dmca",
        description: "This notice identifies an allegedly infringing work.",
        signature: "Owner",
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      request_type: "dmca_takedown",
      legal_hold: true,
      priority: "normal",
      due_at: "2026-06-26T00:00:00.000Z",
    });
    expect(
      buildLegalRequestRow({
        requestType: "child_safety_escalation",
        requester: "Reporter",
        requesterEmail: "reporter@example.com",
        description: "Urgent report involving child safety escalation.",
      }),
    ).toMatchObject({
      priority: "critical",
      child_safety_escalation: true,
    });
    expect(
      buildTransparencyEventRow({
        eventType: "legal.dsa_notice",
        subjectType: "legal_request",
        publicBucket: "dsa_notice",
      }),
    ).toMatchObject({
      public_bucket: "dsa_notice",
      metadata: { privacyPreservingAggregate: true },
    });
  });

  it("normalizes cookie consent with GPC and no behavioral advertising", () => {
    expect(
      normalizeCookieConsent({
        categories: { analytics: true, marketing: true },
        gpcSignal: true,
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      strictly_necessary: true,
      analytics: false,
      marketing: false,
      gpc_signal: true,
      do_not_sell_share: true,
      behavioral_advertising: false,
    });
  });

  it("captures AI-specific research metadata", () => {
    const metadata = buildAiMetadata({
      modelProvider: "Open model lab",
      modelName: "Example-7B",
      modelLicense: "apache-2.0",
      trainingDataSummary: "Curated public and licensed corpus.",
      intendedUse: "Research replication.",
      limitations: "Not for medical use.",
      evaluationResults: "Held-out evals attached.",
      knownRisks: "Dual-use risk documented.",
      responsibleDisclosureStatus: "No active vulnerability.",
      exportControlNoticeAccepted: true,
    });

    expect(validateAiMetadata(metadata)).toEqual({ ok: true, missing: [] });
    expect(validateAiMetadata({ ...metadata, knownRisks: "" })).toMatchObject({
      ok: false,
      missing: ["knownRisks"],
    });
  });
});
