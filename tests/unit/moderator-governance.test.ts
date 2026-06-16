import { describe, expect, it } from "vitest";
import {
  buildEmergencyGovernanceOverride,
  buildGovernanceBallotRow,
  buildModeratorRemovalPetitionRow,
  buildModeratorRemovalVoteRow,
  buildModeratorSelectionPatch,
  buildPetitionSupportRow,
  canModeratorTier,
  certifyGovernanceVote,
  evaluateGovernanceEligibility,
  MODERATOR_TIERS,
  normalizeGovernanceSettings,
} from "@ai-oss/zones";

describe("Phase 15 moderator tiers and governance", () => {
  it("defines all six moderator tiers with scoped capability boundaries", () => {
    expect(MODERATOR_TIERS).toEqual([
      "lead_moderator",
      "content_moderator",
      "chat_moderator",
      "junior_moderator",
      "research_reviewer",
      "automod_editor",
    ]);

    expect(canModeratorTier("lead_moderator", "publishAutomodRules")).toBe(true);
    expect(canModeratorTier("lead_moderator", "startRemovalCertification")).toBe(true);
    expect(canModeratorTier("junior_moderator", "triageReports")).toBe(true);
    expect(canModeratorTier("junior_moderator", "permanentBan")).toBe(false);
    expect(canModeratorTier("junior_moderator", "removeModerators")).toBe(false);
    expect(canModeratorTier("automod_editor", "draftAutomodRules")).toBe(true);
    expect(canModeratorTier("automod_editor", "publishAutomodRules")).toBe(false);
    expect(canModeratorTier("research_reviewer", "addStructuredReviewMetadata")).toBe(true);
    expect(canModeratorTier("research_reviewer", "lockOrRestoreContent")).toBe(false);
  });

  it("builds moderator selection rows for supported selection paths", () => {
    expect(
      buildModeratorSelectionPatch({
        tier: "lead_moderator",
        source: "zone_election",
        actorId: "admin-1",
        reason: "Won the zone election.",
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      member_role: "admin",
      moderator_tier: "lead_moderator",
      moderator_selection_source: "zone_election",
      moderator_status: "active",
      moderator_updated_by: "admin-1",
    });
  });

  it("evaluates governance eligibility without payment or donation weight", () => {
    const eligible = evaluateGovernanceEligibility({
      emailVerified: true,
      accountAgeDays: 90,
      zoneMembershipAgeDays: 30,
      meaningfulZoneParticipationCount: 6,
      trustScore: 72,
      botVerified: true,
      paymentStatus: "paid",
      donationTotalCents: 1_000_000,
    });
    expect(eligible.eligible).toBe(true);
    expect(eligible.snapshot).toMatchObject({
      paymentSignalsExcluded: true,
      donationSignalsExcluded: true,
    });

    const risky = evaluateGovernanceEligibility({
      emailVerified: false,
      accountAgeDays: 1,
      zoneMembershipAgeDays: 1,
      meaningfulZoneParticipationCount: 0,
      trustScore: 5,
      deviceRiskScore: 0.9,
      ipRiskScore: 0.8,
      botVerified: false,
      duplicateAccountClusterRisk: 0.9,
    });
    expect(risky.eligible).toBe(false);
    expect(risky.reasons).toEqual(
      expect.arrayContaining([
        "verified_email_required",
        "minimum_account_age_required",
        "minimum_zone_membership_age_required",
        "minimum_trust_required",
        "duplicate_account_cluster_risk",
      ]),
    );
  });

  it("builds petition, support, vote, and private ballot rows", () => {
    const eligibility = evaluateGovernanceEligibility({
      emailVerified: true,
      accountAgeDays: 90,
      zoneMembershipAgeDays: 30,
      meaningfulZoneParticipationCount: 4,
      trustScore: 70,
      botVerified: true,
    });
    const settings = normalizeGovernanceSettings({
      petitionThreshold: 2,
      quorumPercent: 10,
      removalThresholdPercent: 60,
      voteDurationSeconds: 86_400,
    });

    const petition = buildModeratorRemovalPetitionRow({
      zoneId: "zone-1",
      targetUserId: "mod-1",
      actorId: "member-1",
      reason: "Repeated misuse of moderator tools.",
      eligibility,
      settings,
    });
    expect(petition).toMatchObject({
      status: "open",
      support_threshold: 2,
      eligibility_snapshot: expect.objectContaining({ donationSignalsExcluded: true }),
    });

    expect(buildPetitionSupportRow({ petitionId: "petition-1", userId: "member-1", eligibility }))
      .toMatchObject({
        risk_snapshot: expect.objectContaining({ donationSignalsExcluded: true }),
      });

    const vote = buildModeratorRemovalVoteRow({
      zoneId: "zone-1",
      petitionId: "petition-1",
      targetUserId: "mod-1",
      createdBy: "member-1",
      settings,
      now: new Date("2026-06-12T00:00:00.000Z"),
    });
    expect(vote).toMatchObject({
      subject_type: "moderator_removal_petition",
      status: "open",
      aggregate_tally: expect.objectContaining({
        voterIdentitiesHidden: true,
        donationWeightExcluded: true,
      }),
    });

    const ballot = buildGovernanceBallotRow({
      voteId: "vote-1",
      userId: "member-1",
      choice: "yes",
      ballotHash: "hash-1",
      eligibility,
      suspiciousScore: 0.1,
    });
    expect(ballot).toMatchObject({
      weight: 1,
      ballot_hash: "hash-1",
      is_certified: true,
      eligibility_snapshot: expect.objectContaining({
        donationWeightExcluded: true,
      }),
    });
    expect(ballot).not.toHaveProperty("donation_weight");
  });

  it("certifies only aggregate governance outcomes and routes suspicious votes to review", () => {
    expect(
      certifyGovernanceVote({
        eligibleVoterCount: 10,
        certifiedBy: "lead-1",
        reason: "Threshold and quorum met.",
        ballots: [
          { choice: "yes", isCertified: true, suspiciousScore: 0.05 },
          { choice: "yes", isCertified: true, suspiciousScore: 0.05 },
          { choice: "no", isCertified: true, suspiciousScore: 0.05 },
        ],
        settings: { quorumPercent: 10, removalThresholdPercent: 60 },
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      status: "passed",
      certification_status: "certified",
      aggregate_tally: expect.objectContaining({
        yes: 2,
        no: 1,
        voterIdentitiesHidden: true,
        donationWeightExcluded: true,
      }),
      public_result: expect.objectContaining({ outcome: "passed" }),
    });

    expect(
      certifyGovernanceVote({
        eligibleVoterCount: 10,
        certifiedBy: "lead-1",
        reason: "Suspicious cluster.",
        ballots: [{ choice: "yes", isCertified: false, suspiciousScore: 0.9 }],
        brigadingMitigation: [{ type: "freeze_governance_vote" }],
      }),
    ).toMatchObject({
      status: "certifying",
      certification_status: "admin_review",
      admin_review_reason: expect.stringContaining("Suspicious"),
    });
  });

  it("builds audited emergency override patches with public reasons", () => {
    expect(
      buildEmergencyGovernanceOverride({
        action: "freeze_vote",
        actorId: "admin-1",
        reason: "Credible off-platform coercion report.",
        now: new Date("2026-06-12T00:00:00.000Z"),
      }),
    ).toMatchObject({
      auditAction: "zones.governance.emergency.freeze_vote",
      votePatch: expect.objectContaining({
        status: "certifying",
        certification_status: "admin_review",
      }),
    });
  });
});
