import { describe, expect, it } from "vitest";
import {
  buildAccountDeletionPlan,
  buildConsentEvents,
  sanitizeProfileUpdate,
  serializePrivacyExport,
  validateSignupInput,
} from "../../packages/auth/src/index";

const validSignup = {
  email: "researcher@example.com",
  password: "correct-horse-battery",
  username: "researcher_1",
  displayName: "Researcher One",
  ageAttested: true,
  consents: {
    terms: "2026-06-12",
    privacy: "2026-06-12",
    community_guidelines: "2026-06-12",
    research_publishing: "2026-06-12",
    cookie_policy: "2026-06-12",
  },
};

describe("Phase 03 signup and privacy helpers", () => {
  it("requires age attestation and every policy consent at signup", () => {
    const parsed = validateSignupInput({
      ...validSignup,
      ageAttested: false,
      consents: { terms: "2026-06-12" },
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.issues).toContain("Age attestation is required.");
      expect(parsed.issues).toContain("Missing consent for privacy.");
      expect(parsed.issues).toContain("Missing consent for community_guidelines.");
      expect(parsed.issues).toContain("Missing consent for research_publishing.");
      expect(parsed.issues).toContain("Missing consent for cookie_policy.");
    }
  });

  it("builds consent event rows with policy versions", () => {
    const parsed = validateSignupInput(validSignup);
    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      const events = buildConsentEvents("user-1", parsed.data);
      expect(events).toHaveLength(5);
      expect(events.map((event) => event.policy_key).sort()).toEqual([
        "community_guidelines",
        "cookie_policy",
        "privacy",
        "research_publishing",
        "terms",
      ]);
      expect(events.every((event) => event.accepted)).toBe(true);
      expect(events.every((event) => event.age_attested)).toBe(true);
    }
  });

  it("sanitizes profile updates without protected trust or role fields", () => {
    expect(
      sanitizeProfileUpdate({
        username: "next_name",
        trustScore: 999,
        adminBadgeVisible: true,
        researchInterests: ["evals", "", "safety"],
      }),
    ).toEqual({
      username: "next_name",
      researchInterests: ["evals", "safety"],
    });
  });

  it("serializes a machine-readable privacy export with all required categories", () => {
    const exported = serializePrivacyExport(
      {
        profile: { id: "user-1" },
        settings: { emailDigestFrequency: "weekly" },
        zoneMemberships: [{ zone_id: "zone-1" }],
        posts: [{ id: "post-1" }],
        comments: [{ id: "comment-1" }],
        papers: [{ id: "paper-1" }],
        reviews: [{ id: "review-1" }],
        replicationReports: [{ id: "rep-1" }],
        votes: [{ target_id: "post-1" }],
        moderationHistory: [{ id: "appeal-1" }],
        donations: [{ id: "donation-1" }],
        consentEvents: [{ policy_key: "terms" }],
      },
      "2026-06-12T00:00:00.000Z",
    );

    expect(exported.formatVersion).toBe("2026-06-12.phase03.v1");
    expect(exported.exportedAt).toBe("2026-06-12T00:00:00.000Z");
    expect(exported.zoneMemberships).toHaveLength(1);
    expect(exported.donations).toHaveLength(1);
  });

  it("plans account deletion without destroying published research versions", () => {
    const plan = buildAccountDeletionPlan({
      userId: "user-1",
      requestedAt: "2026-06-12T00:00:00.000Z",
      hasLegalHold: false,
      publicPosts: 2,
      publicComments: 3,
      publishedPapers: 1,
      privateChatMessages: 4,
    });

    expect(plan.revokeSessions).toBe(true);
    expect(plan.queueWorkflow).toBe("account_deletion_anonymization");
    expect(plan.researchAction).toBe("withdraw_redact_or_pseudonymize_never_destroy_versions");
    expect(plan.auditEventRequired).toBe(true);
    expect(plan.affectedCounts.publishedPapers).toBe(1);
  });
});
