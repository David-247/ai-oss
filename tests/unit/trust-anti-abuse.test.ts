import { describe, expect, it } from "vitest";
import {
  SENSITIVE_ACTIONS,
  buildPublicReputation,
  buildUserSecurityStatePatch,
  buildVoteCertificationPatch,
  classifyVoteAnomaly,
  computeTrustScore,
  evaluateSensitiveActionGuard,
} from "@ai-oss/trust";

describe("Phase 14 trust, reputation, and anti-abuse", () => {
  it("computes internal trust without allowing payments or donations to increase trust", () => {
    const base = computeTrustScore({
      accountCreatedAt: "2026-01-01T00:00:00.000Z",
      emailVerified: true,
      githubVerified: true,
      orcidVerified: true,
      mfaEnabled: true,
      positiveContributions: 12,
      acceptedReviews: 3,
      acceptedReplications: 2,
      reportAccuracy: 0.9,
      now: new Date("2026-06-12T00:00:00.000Z"),
    });
    const paid = computeTrustScore({
      accountCreatedAt: "2026-01-01T00:00:00.000Z",
      emailVerified: true,
      githubVerified: true,
      orcidVerified: true,
      mfaEnabled: true,
      positiveContributions: 12,
      acceptedReviews: 3,
      acceptedReplications: 2,
      reportAccuracy: 0.9,
      paymentStatus: "paid",
      donationTotalCents: 1_000_000,
      now: new Date("2026-06-12T00:00:00.000Z"),
    });

    expect(paid.trustScore).toBe(base.trustScore);
    expect(paid.excludedSignals).toEqual(["payment_status", "donation_total_cents"]);
    expect(buildUserSecurityStatePatch(base)).toMatchObject({
      trust_score: base.trustScore,
      risk_score: base.riskScore,
      risk_level: "normal",
    });
  });

  it("builds public reputation without leaking internal anti-abuse signals", () => {
    const reputation = buildPublicReputation({
      communityKarma: 50,
      researchContributionScore: 12,
      reviewHelpfulnessScore: 7,
      replicationContributionScore: 5,
      zoneReputation: { zoneA: 10 },
      internalTrustScore: 88,
      riskScore: 22,
      paymentStatus: "paid",
    });

    expect(reputation).toMatchObject({
      communityKarma: 50,
      researchContributionScore: 12,
      reviewHelpfulnessScore: 7,
      replicationContributionScore: 5,
      zoneReputation: { zoneA: 10 },
    });
    expect(JSON.stringify(reputation)).not.toContain("88");
    expect(JSON.stringify(reputation)).not.toContain("paid");
  });

  it("guards every sensitive action with rate, bot, csrf, and trust decisions", () => {
    expect(SENSITIVE_ACTIONS).toContain("account_delete_export");
    expect(SENSITIVE_ACTIONS).toContain("moderator_removal_vote");

    const decision = evaluateSensitiveActionGuard({
      action: "zone_create",
      accountAgeDays: 1,
      emailVerified: false,
      trustScore: 0,
      csrfVerified: false,
      botVerified: false,
      recentActionCount: 2,
      actionLimit: 2,
      windowSeconds: 3600,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(429);
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        "email_verification_required",
        "csrf_required",
        "bot_challenge_required",
        "action_rate_limited",
        "new_user_cooldown",
      ]),
    );
  });

  it("classifies brigading and emits certification plus mitigation patches", () => {
    const decision = classifyVoteAnomaly({
      targetType: "post",
      targetId: "post-1",
      value: -1,
      voterAccountAgeDays: 1,
      voterTrustScore: 5,
      voterZoneHistoryCount: 0,
      voterPriorVoteCount: 40,
      votesInWindow: 30,
      newAccountVoteRatio: 0.5,
      noZoneHistoryVoteRatio: 0.6,
      sharedIpVoteCount: 6,
      sharedDeviceVoteCount: 4,
      externalReferrerVoteCount: 12,
      abnormalTimingScore: 0.9,
      downvoteRatioShift: 0.6,
      moderatorRemovalVote: true,
    });

    expect(decision.certificationRequired).toBe(true);
    expect(decision.suspiciousScore).toBeGreaterThanOrEqual(0.75);
    expect(decision.mitigations.map((mitigation) => mitigation.type)).toEqual(
      expect.arrayContaining([
        "hide_scores_temporarily",
        "require_vote_certification",
        "freeze_governance_vote",
        "route_security_review",
      ]),
    );
    expect(buildVoteCertificationPatch(decision)).toMatchObject({
      is_certified: false,
      certification_status: "pending",
    });
  });
});
