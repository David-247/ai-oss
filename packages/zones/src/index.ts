export const PACKAGE_NAME = "@ai-oss/zones" as const;

export const ZONE_VISIBILITIES = ["public", "restricted", "private"] as const;
export type ZoneVisibility = (typeof ZONE_VISIBILITIES)[number];

export const DEFAULT_POST_VISIBILITIES = ["public", "zone", "private"] as const;
export type DefaultPostVisibility = (typeof DEFAULT_POST_VISIBILITIES)[number];

export const ZONE_MEMBER_STATUSES = ["invited", "active", "muted", "banned", "left"] as const;
export type ZoneMemberStatus = (typeof ZONE_MEMBER_STATUSES)[number];

export const ZONE_ROLES = [
  "zone_owner_founder",
  "lead_moderator",
  "content_moderator",
  "chat_moderator",
  "junior_moderator",
  "research_reviewer",
  "automod_editor",
  "wiki_editor",
  "member",
  "restricted_member",
  "banned_user",
] as const;

export type ZoneRole = (typeof ZONE_ROLES)[number];

export const ZONE_FEATURES = [
  "homepage",
  "posts",
  "comments",
  "voting",
  "rules",
  "wiki",
  "chat_rooms",
  "voice_rooms",
  "member_list",
  "moderator_list",
  "report_flow",
  "modmail",
  "in_zone_search",
  "sort_modes",
  "flairs",
  "pinned_posts",
  "announcements",
  "sidebar",
  "settings",
  "moderation_queue",
  "automod_rules",
  "governance",
] as const;

export const ZONE_SORT_MODES = ["hot", "new", "top", "active", "controversial"] as const;

export const ZONE_GOVERNANCE_ACTIONS = [
  "moderator_appointment",
  "lead_moderator_invitation",
  "community_nomination",
  "zone_election_open",
  "moderator_resignation",
  "global_admin_removal",
  "community_removal_petition",
  "community_removal_support",
  "community_removal_vote_open",
  "community_removal_ballot",
  "community_removal_vote_close",
  "governance_vote_freeze",
  "governance_vote_certify",
  "governance_vote_invalidate",
  "moderator_emergency_suspension",
  "moderator_restore",
  "zone_ownership_transfer",
  "appeal",
] as const;

export type ZoneGovernanceAction = (typeof ZONE_GOVERNANCE_ACTIONS)[number];

export const MODERATOR_TIERS = [
  "lead_moderator",
  "content_moderator",
  "chat_moderator",
  "junior_moderator",
  "research_reviewer",
  "automod_editor",
] as const;

export type ModeratorTier = (typeof MODERATOR_TIERS)[number];

export const MODERATOR_SELECTION_SOURCES = [
  "founder_appointment",
  "lead_invitation",
  "community_nomination",
  "zone_election",
  "admin_emergency_appointment",
  "moderator_resignation",
  "community_removal",
  "admin_emergency_removal",
] as const;

export type ModeratorSelectionSource = (typeof MODERATOR_SELECTION_SOURCES)[number];

export const GOVERNANCE_EMERGENCY_OVERRIDE_ACTIONS = [
  "suspend_moderator",
  "freeze_vote",
  "certify_vote",
  "invalidate_vote",
  "restore_moderator",
  "transfer_ownership",
] as const;

export type GovernanceEmergencyOverrideAction =
  (typeof GOVERNANCE_EMERGENCY_OVERRIDE_ACTIONS)[number];

export const GLOBAL_POLICY_DOMAINS = [
  "legal",
  "privacy",
  "security",
  "finance",
  "audit",
  "system",
  "feature_flags",
] as const;

export const ZONE_ROLE_PERMISSIONS = {
  zone_owner_founder: [
    "zones.*",
    "content.*",
    "chat.*",
    "voice.*",
    "moderation.read",
    "moderation.update",
  ],
  lead_moderator: [
    "zones.members.read",
    "zones.members.update",
    "zones.settings_read",
    "zones.settings_update",
    "zones.governance_read",
    "zones.governance_update",
    "content.*",
    "chat.*",
    "voice.*",
    "moderation.read",
    "moderation.update",
    "moderation.automod_manage",
  ],
  content_moderator: ["content.read", "content.update", "content.remove", "moderation.read"],
  chat_moderator: ["chat.read", "chat.update", "chat.moderate", "voice.read", "voice.moderate"],
  junior_moderator: ["content.read", "moderation.read"],
  research_reviewer: ["research.read", "research.update", "content.read"],
  automod_editor: ["moderation.read", "moderation.automod_manage"],
  wiki_editor: ["zones.read", "zones.update"],
  member: ["zones.read", "content.read", "chat.read", "voice.read"],
  restricted_member: ["zones.read", "content.read"],
  banned_user: [],
} as const satisfies Record<ZoneRole, readonly string[]>;

export interface ZoneCreationCandidate {
  userId: string;
  emailVerified: boolean;
  accountCreatedAt: string | Date;
  trustScore: number;
  riskLevel?: "normal" | "elevated" | "restricted" | "suspended";
  slug: string;
  name: string;
  description?: string;
  rules?: readonly string[];
  topicTags?: readonly string[];
  visibility?: ZoneVisibility;
  defaultPostVisibility?: DefaultPostVisibility;
  creationPaused?: boolean;
  slugAvailable?: boolean;
  now?: Date;
}

export interface ZoneCreationDecision {
  allowed: boolean;
  reasons: string[];
  slug: string;
  normalizedName: string;
  requirements: {
    minimumAccountAgeDays: number;
    minimumTrustScore: number;
    emailVerified: true;
  };
}

export interface ZoneInsertRow {
  slug: string;
  name: string;
  description: string | null;
  visibility: ZoneVisibility;
  status: "active";
  created_by: string;
  default_post_visibility: DefaultPostVisibility;
  moderation_status: "clear";
}

export interface ZoneSettingsRows {
  settings: {
    zone_id: string;
    post_permissions: Record<string, unknown>;
    automod_config: Record<string, unknown>;
    ranking_config: Record<string, unknown>;
    chat_config: Record<string, unknown>;
    updated_by: string;
  };
  governance: {
    zone_id: string;
    petition_threshold: number;
    quorum_percent: number;
    removal_threshold_percent: number;
    certification_required: true;
    updated_by: string;
  };
}

export interface ZoneMemberRow {
  zone_id: string;
  user_id: string;
  member_role: "member" | "contributor" | "moderator" | "admin";
  status: ZoneMemberStatus;
}

export interface ZoneGovernanceEvent {
  zoneId: string;
  action: ZoneGovernanceAction;
  actorId: string;
  targetUserId?: string | null;
  reason: string;
  auditAction: string;
  requiresCertification: boolean;
  metadata: Record<string, unknown>;
}

export interface ModeratorTierCapabilities {
  manageZoneSettings: boolean;
  manageModerators: boolean;
  publishAutomodRules: boolean;
  draftAutomodRules: boolean;
  lockOrRestoreContent: boolean;
  moderatePostsComments: boolean;
  moderateChatVoice: boolean;
  triageReports: boolean;
  markSpam: boolean;
  recommendActions: boolean;
  permanentBan: boolean;
  removeModerators: boolean;
  handleAppeals: boolean;
  startRemovalCertification: boolean;
  addStructuredReviewMetadata: boolean;
}

export const MODERATOR_TIER_CAPABILITIES = {
  lead_moderator: {
    manageZoneSettings: true,
    manageModerators: true,
    publishAutomodRules: true,
    draftAutomodRules: true,
    lockOrRestoreContent: true,
    moderatePostsComments: true,
    moderateChatVoice: true,
    triageReports: true,
    markSpam: true,
    recommendActions: true,
    permanentBan: true,
    removeModerators: false,
    handleAppeals: true,
    startRemovalCertification: true,
    addStructuredReviewMetadata: true,
  },
  content_moderator: {
    manageZoneSettings: false,
    manageModerators: false,
    publishAutomodRules: false,
    draftAutomodRules: false,
    lockOrRestoreContent: true,
    moderatePostsComments: true,
    moderateChatVoice: false,
    triageReports: true,
    markSpam: true,
    recommendActions: true,
    permanentBan: false,
    removeModerators: false,
    handleAppeals: false,
    startRemovalCertification: false,
    addStructuredReviewMetadata: false,
  },
  chat_moderator: {
    manageZoneSettings: false,
    manageModerators: false,
    publishAutomodRules: false,
    draftAutomodRules: false,
    lockOrRestoreContent: false,
    moderatePostsComments: false,
    moderateChatVoice: true,
    triageReports: true,
    markSpam: false,
    recommendActions: true,
    permanentBan: false,
    removeModerators: false,
    handleAppeals: false,
    startRemovalCertification: false,
    addStructuredReviewMetadata: false,
  },
  junior_moderator: {
    manageZoneSettings: false,
    manageModerators: false,
    publishAutomodRules: false,
    draftAutomodRules: false,
    lockOrRestoreContent: false,
    moderatePostsComments: false,
    moderateChatVoice: false,
    triageReports: true,
    markSpam: true,
    recommendActions: true,
    permanentBan: false,
    removeModerators: false,
    handleAppeals: false,
    startRemovalCertification: false,
    addStructuredReviewMetadata: false,
  },
  research_reviewer: {
    manageZoneSettings: false,
    manageModerators: false,
    publishAutomodRules: false,
    draftAutomodRules: false,
    lockOrRestoreContent: false,
    moderatePostsComments: false,
    moderateChatVoice: false,
    triageReports: false,
    markSpam: false,
    recommendActions: false,
    permanentBan: false,
    removeModerators: false,
    handleAppeals: false,
    startRemovalCertification: false,
    addStructuredReviewMetadata: true,
  },
  automod_editor: {
    manageZoneSettings: false,
    manageModerators: false,
    publishAutomodRules: false,
    draftAutomodRules: true,
    lockOrRestoreContent: false,
    moderatePostsComments: false,
    moderateChatVoice: false,
    triageReports: false,
    markSpam: false,
    recommendActions: false,
    permanentBan: false,
    removeModerators: false,
    handleAppeals: false,
    startRemovalCertification: false,
    addStructuredReviewMetadata: false,
  },
} as const satisfies Record<ModeratorTier, ModeratorTierCapabilities>;

export interface GovernanceSettingsInput {
  petitionThreshold?: number;
  quorumPercent?: number;
  removalThresholdPercent?: number;
  certificationRequired?: boolean;
  voteDurationSeconds?: number;
}

export interface GovernanceEligibilityInput {
  emailVerified: boolean;
  accountAgeDays: number;
  zoneMembershipAgeDays: number;
  meaningfulZoneParticipationCount: number;
  bannedOrSuspended?: boolean;
  recentSevereModerationActions?: number;
  deviceRiskScore?: number;
  ipRiskScore?: number;
  botVerified?: boolean;
  rateLimited?: boolean;
  trustScore: number;
  duplicateAccountClusterRisk?: number;
  paymentStatus?: string | null;
  donationTotalCents?: number;
}

export interface GovernanceEligibilityDecision {
  eligible: boolean;
  reasons: string[];
  snapshot: Record<string, unknown>;
}

export interface GovernanceVoteCertificationInput {
  ballots: readonly {
    choice: string;
    isCertified: boolean;
    suspiciousScore?: number;
  }[];
  eligibleVoterCount: number;
  settings?: GovernanceSettingsInput;
  brigadingMitigation?: readonly unknown[];
  certifiedBy: string;
  reason: string;
  now?: Date;
}

const MIN_ACCOUNT_AGE_DAYS = 7;
const MIN_TRUST_SCORE = 25;

export function evaluateZoneCreation(input: ZoneCreationCandidate): ZoneCreationDecision {
  const now = input.now ?? new Date();
  const slug = normalizeZoneSlug(input.slug);
  const normalizedName = input.name.trim().replace(/\s+/g, " ");
  const reasons: string[] = [];

  if (input.creationPaused === true) {
    reasons.push("zone_creation_paused");
  }
  if (!input.emailVerified) {
    reasons.push("email_verification_required");
  }
  if (input.riskLevel === "restricted" || input.riskLevel === "suspended") {
    reasons.push("account_risk_level_blocks_zone_creation");
  }
  if (!isValidZoneSlug(slug)) {
    reasons.push("invalid_zone_slug");
  }
  if (input.slugAvailable === false) {
    reasons.push("zone_slug_unavailable");
  }
  if (normalizedName.length < 3 || normalizedName.length > 80) {
    reasons.push("zone_name_length_invalid");
  }
  if (
    accountAgeDays(input.accountCreatedAt, now) < MIN_ACCOUNT_AGE_DAYS &&
    input.trustScore < MIN_TRUST_SCORE
  ) {
    reasons.push("account_age_or_trust_threshold_required");
  }
  if ((input.rules ?? []).filter((rule) => rule.trim().length > 0).length === 0) {
    reasons.push("zone_rules_required");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    slug,
    normalizedName,
    requirements: {
      minimumAccountAgeDays: MIN_ACCOUNT_AGE_DAYS,
      minimumTrustScore: MIN_TRUST_SCORE,
      emailVerified: true,
    },
  };
}

export function buildZoneInsertRow(input: ZoneCreationCandidate): ZoneInsertRow {
  const decision = evaluateZoneCreation(input);
  if (!decision.allowed) {
    throw new Error(`Zone creation is not allowed: ${decision.reasons.join(", ")}`);
  }

  return {
    slug: decision.slug,
    name: decision.normalizedName,
    description: normalizeOptionalText(input.description),
    visibility: input.visibility ?? "public",
    status: "active",
    created_by: input.userId,
    default_post_visibility: input.defaultPostVisibility ?? "public",
    moderation_status: "clear",
  };
}

export function buildDefaultZoneSettings(input: {
  zoneId: string;
  actorId: string;
  visibility?: ZoneVisibility;
  topicTags?: readonly string[];
}): ZoneSettingsRows {
  return {
    settings: {
      zone_id: input.zoneId,
      post_permissions: {
        default_sort: "hot",
        allowed_sorts: [...ZONE_SORT_MODES],
        posting: input.visibility === "private" ? "members" : "authenticated",
      },
      automod_config: {
        enabled: true,
        baseline: "community_default",
        link_reputation_floor: 0,
        new_account_review: true,
      },
      ranking_config: {
        hot_decay_hours: 36,
        certified_votes_boost: true,
      },
      chat_config: {
        enabled: true,
        default_permission: input.visibility === "private" ? "members" : "authenticated",
      },
      updated_by: input.actorId,
    },
    governance: {
      zone_id: input.zoneId,
      petition_threshold: 10,
      quorum_percent: 10,
      removal_threshold_percent: 60,
      certification_required: true,
      updated_by: input.actorId,
    },
  };
}

export function buildFounderMembership(input: { zoneId: string; userId: string }): ZoneMemberRow {
  return {
    zone_id: input.zoneId,
    user_id: input.userId,
    member_role: "admin",
    status: "active",
  };
}

export function assertZoneRoleWithinGlobalPolicy(
  role: ZoneRole,
  permissions: readonly string[],
): void {
  const invalid = permissions.filter((permission) =>
    GLOBAL_POLICY_DOMAINS.some(
      (domain) => permission === `${domain}.*` || permission.startsWith(`${domain}.`),
    ),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Zone role ${role} cannot grant global policy permission(s): ${invalid.join(", ")}`,
    );
  }
}

export function buildZoneRoleDefinition(role: ZoneRole) {
  const permissions = ZONE_ROLE_PERMISSIONS[role];
  assertZoneRoleWithinGlobalPolicy(role, permissions);
  return {
    key: `zone:${role}`,
    name: humanizeRole(role),
    description: `${humanizeRole(role)} zone role`,
    permissions,
    zoneScoped: true,
  };
}

export function moderatorTierCapabilities(tier: ModeratorTier): ModeratorTierCapabilities {
  return MODERATOR_TIER_CAPABILITIES[tier];
}

export function canModeratorTier(
  tier: ModeratorTier,
  capability: keyof ModeratorTierCapabilities,
): boolean {
  return MODERATOR_TIER_CAPABILITIES[tier][capability];
}

export function readModeratorTier(value: unknown): ModeratorTier {
  return MODERATOR_TIERS.includes(value as ModeratorTier)
    ? (value as ModeratorTier)
    : "content_moderator";
}

export function buildModeratorSelectionPatch(input: {
  tier: ModeratorTier;
  source: ModeratorSelectionSource;
  actorId: string;
  reason: string;
  now?: Date;
}) {
  if (input.reason.trim().length < 8) {
    throw new Error("Moderator selection reason is required.");
  }
  return {
    member_role: input.tier === "lead_moderator" ? "admin" : "moderator",
    status: "active",
    moderator_tier: input.tier,
    moderator_selection_source: input.source,
    moderator_status: "active",
    moderator_status_reason: input.reason.trim(),
    moderator_since: (input.now ?? new Date()).toISOString(),
    moderator_updated_by: input.actorId,
  };
}

export function evaluateGovernanceEligibility(
  input: GovernanceEligibilityInput,
): GovernanceEligibilityDecision {
  const reasons: string[] = [];
  if (!input.emailVerified) {
    reasons.push("verified_email_required");
  }
  if (input.accountAgeDays < 14) {
    reasons.push("minimum_account_age_required");
  }
  if (input.zoneMembershipAgeDays < 7) {
    reasons.push("minimum_zone_membership_age_required");
  }
  if (input.meaningfulZoneParticipationCount < 2) {
    reasons.push("recent_meaningful_zone_participation_required");
  }
  if (input.bannedOrSuspended === true) {
    reasons.push("banned_or_suspended_accounts_ineligible");
  }
  if ((input.recentSevereModerationActions ?? 0) > 0) {
    reasons.push("recent_severe_moderation_action");
  }
  if ((input.deviceRiskScore ?? 0) >= 0.75) {
    reasons.push("device_risk_too_high");
  }
  if ((input.ipRiskScore ?? 0) >= 0.75) {
    reasons.push("ip_risk_too_high");
  }
  if (input.botVerified === false) {
    reasons.push("botid_verification_required");
  }
  if (input.rateLimited === true) {
    reasons.push("governance_rate_limited");
  }
  if (input.trustScore < 30) {
    reasons.push("minimum_trust_required");
  }
  if ((input.duplicateAccountClusterRisk ?? 0) >= 0.7) {
    reasons.push("duplicate_account_cluster_risk");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    snapshot: {
      emailVerified: input.emailVerified,
      accountAgeDays: Math.max(0, Math.floor(input.accountAgeDays)),
      zoneMembershipAgeDays: Math.max(0, Math.floor(input.zoneMembershipAgeDays)),
      meaningfulZoneParticipationCount: Math.max(
        0,
        Math.floor(input.meaningfulZoneParticipationCount),
      ),
      bannedOrSuspended: input.bannedOrSuspended === true,
      recentSevereModerationActions: Math.max(
        0,
        Math.floor(input.recentSevereModerationActions ?? 0),
      ),
      deviceRiskScore: clamp01(input.deviceRiskScore ?? 0),
      ipRiskScore: clamp01(input.ipRiskScore ?? 0),
      botVerified: input.botVerified !== false,
      rateLimited: input.rateLimited === true,
      trustScore: Math.max(0, Math.min(100, Math.floor(input.trustScore))),
      duplicateAccountClusterRisk: clamp01(input.duplicateAccountClusterRisk ?? 0),
      paymentSignalsExcluded: input.paymentStatus !== undefined,
      donationSignalsExcluded: Number(input.donationTotalCents ?? 0) >= 0,
      reasons,
    },
  };
}

export function normalizeGovernanceSettings(
  input: GovernanceSettingsInput = {},
): Required<GovernanceSettingsInput> {
  return {
    petitionThreshold: clampInteger(input.petitionThreshold, 1, 1_000, 10),
    quorumPercent: clampNumber(input.quorumPercent, 0, 100, 10),
    removalThresholdPercent: clampNumber(input.removalThresholdPercent, 0, 100, 60),
    certificationRequired: input.certificationRequired !== false,
    voteDurationSeconds: clampInteger(input.voteDurationSeconds, 60 * 60, 60 * 60 * 24 * 30, 604_800),
  };
}

export function buildModeratorRemovalPetitionRow(input: {
  zoneId: string;
  targetUserId: string;
  actorId: string;
  reason: string;
  eligibility: GovernanceEligibilityDecision;
  settings?: GovernanceSettingsInput;
}) {
  const settings = normalizeGovernanceSettings(input.settings);
  const reason = input.reason.trim();
  if (reason.length < 12) {
    throw new Error("Moderator-removal petition reason is too short.");
  }
  if (!input.eligibility.eligible) {
    throw new Error(`Governance eligibility failed: ${input.eligibility.reasons.join(", ")}`);
  }
  return {
    zone_id: input.zoneId,
    target_user_id: input.targetUserId,
    created_by: input.actorId,
    reason,
    status: "open",
    support_count: 0,
    support_threshold: settings.petitionThreshold,
    eligibility_snapshot: input.eligibility.snapshot,
    public_reason: summarizePublicReason(reason),
  };
}

export function buildPetitionSupportRow(input: {
  petitionId: string;
  userId: string;
  eligibility: GovernanceEligibilityDecision;
  riskSnapshot?: Record<string, unknown>;
  suspiciousScore?: number;
}) {
  if (!input.eligibility.eligible) {
    throw new Error(`Governance eligibility failed: ${input.eligibility.reasons.join(", ")}`);
  }
  return {
    petition_id: input.petitionId,
    user_id: input.userId,
    eligibility_snapshot: input.eligibility.snapshot,
    risk_snapshot: {
      donationSignalsExcluded: true,
      paymentSignalsExcluded: true,
      ...(input.riskSnapshot ?? {}),
    },
    suspicious_score: Number(clamp01(input.suspiciousScore ?? 0).toFixed(4)),
  };
}

export function shouldOpenModeratorRemovalVote(input: {
  supportCount: number;
  threshold: number;
}): boolean {
  return input.supportCount >= Math.max(1, input.threshold);
}

export function buildModeratorRemovalVoteRow(input: {
  zoneId: string;
  petitionId: string;
  targetUserId: string;
  createdBy: string;
  settings?: GovernanceSettingsInput;
  now?: Date;
}) {
  const settings = normalizeGovernanceSettings(input.settings);
  const opensAt = input.now ?? new Date();
  const closesAt = new Date(opensAt.getTime() + settings.voteDurationSeconds * 1000);
  return {
    zone_id: input.zoneId,
    subject_type: "moderator_removal_petition",
    subject_id: input.petitionId,
    title: "Moderator removal vote",
    description: `Community vote on whether to remove moderator ${input.targetUserId}.`,
    status: "open",
    opens_at: opensAt.toISOString(),
    closes_at: closesAt.toISOString(),
    created_by: input.createdBy,
    certification_status: settings.certificationRequired ? "pending" : "not_required",
    certification_required: settings.certificationRequired,
    quorum_percent: settings.quorumPercent,
    removal_threshold_percent: settings.removalThresholdPercent,
    aggregate_tally: {
      yes: 0,
      no: 0,
      abstain: 0,
      voterIdentitiesHidden: true,
      donationWeightExcluded: true,
    },
    public_result: null,
    brigading_mitigation: [],
    quorum_adjustment_percent: 0,
  };
}

export function buildGovernanceBallotRow(input: {
  voteId: string;
  userId: string;
  choice: "yes" | "no" | "abstain";
  ballotHash: string;
  eligibility: GovernanceEligibilityDecision;
  riskSnapshot?: Record<string, unknown>;
  suspiciousScore?: number;
  certificationRequired?: boolean;
  anomalyReasons?: readonly string[];
}) {
  if (!input.ballotHash.trim()) {
    throw new Error("A privacy-preserving ballot hash is required.");
  }
  if (!input.eligibility.eligible) {
    throw new Error(`Governance eligibility failed: ${input.eligibility.reasons.join(", ")}`);
  }
  const suspiciousScore = clamp01(input.suspiciousScore ?? 0);
  const certificationRequired = input.certificationRequired === true || suspiciousScore >= 0.35;
  return {
    governance_vote_id: input.voteId,
    user_id: input.userId,
    choice: input.choice,
    weight: 1,
    ballot_hash: input.ballotHash,
    eligibility_snapshot: {
      ...input.eligibility.snapshot,
      donationWeightExcluded: true,
    },
    risk_snapshot: {
      donationSignalsExcluded: true,
      paymentSignalsExcluded: true,
      ...(input.riskSnapshot ?? {}),
    },
    is_certified: !certificationRequired,
    suspicious_score: Number(suspiciousScore.toFixed(4)),
    certification_reason: certificationRequired
      ? "pending_anti_abuse_certification"
      : "auto_certified_low_risk",
    anomaly_reasons: [...(input.anomalyReasons ?? [])],
    certified_at: certificationRequired ? null : new Date().toISOString(),
  };
}

export function certifyGovernanceVote(input: GovernanceVoteCertificationInput) {
  const settings = normalizeGovernanceSettings(input.settings);
  const certifiedBallots = input.ballots.filter((ballot) => ballot.isCertified);
  const yes = certifiedBallots.filter((ballot) => ballot.choice === "yes").length;
  const no = certifiedBallots.filter((ballot) => ballot.choice === "no").length;
  const abstain = certifiedBallots.filter((ballot) => ballot.choice === "abstain").length;
  const yesNoTotal = yes + no;
  const eligibleVoterCount = Math.max(1, input.eligibleVoterCount);
  const quorumPercent = (certifiedBallots.length / eligibleVoterCount) * 100;
  const removalPercent = yesNoTotal === 0 ? 0 : (yes / yesNoTotal) * 100;
  const maxSuspiciousScore = input.ballots.reduce(
    (max, ballot) => Math.max(max, ballot.suspiciousScore ?? 0),
    0,
  );
  const needsAdminReview =
    maxSuspiciousScore >= 0.75 || (input.brigadingMitigation ?? []).length > 0;
  const quorumMet = quorumPercent >= settings.quorumPercent;
  const removalThresholdMet = removalPercent >= settings.removalThresholdPercent;
  const passed = quorumMet && removalThresholdMet && !needsAdminReview;
  const failed = (!quorumMet || !removalThresholdMet) && !needsAdminReview;
  const now = input.now ?? new Date();
  const aggregate = {
    yes,
    no,
    abstain,
    certifiedBallots: certifiedBallots.length,
    totalBallots: input.ballots.length,
    eligibleVoterCount,
    quorumPercent: Number(quorumPercent.toFixed(4)),
    removalPercent: Number(removalPercent.toFixed(4)),
    voterIdentitiesHidden: true,
    donationWeightExcluded: true,
  };

  return {
    status: needsAdminReview ? "certifying" : passed ? "passed" : failed ? "failed" : "certifying",
    certified_by: needsAdminReview ? null : input.certifiedBy,
    certified_at: needsAdminReview ? null : now.toISOString(),
    certification_status: needsAdminReview ? "admin_review" : "certified",
    certification_reason: input.reason,
    aggregate_tally: aggregate,
    public_result: {
      outcome: needsAdminReview ? "admin_review" : passed ? "passed" : "failed",
      reason: input.reason,
      quorumMet,
      removalThresholdMet,
      voterIdentitiesHidden: true,
      donationWeightExcluded: true,
    },
    admin_review_reason: needsAdminReview
      ? "Suspicious governance ballot pattern requires authorized admin review."
      : null,
  };
}

export function buildEmergencyGovernanceOverride(input: {
  action: GovernanceEmergencyOverrideAction;
  actorId: string;
  targetUserId?: string | null;
  reason: string;
  outcome?: "passed" | "failed";
  now?: Date;
}) {
  const reason = input.reason.trim();
  if (reason.length < 12) {
    throw new Error("Emergency governance override reason is required.");
  }
  const now = input.now ?? new Date();
  const base = {
    auditAction: `zones.governance.emergency.${input.action}`,
    publicReason: summarizePublicReason(reason),
  };
  switch (input.action) {
    case "suspend_moderator":
      return {
        ...base,
        memberPatch: {
          moderator_status: "suspended",
          moderator_status_reason: reason,
          moderator_updated_by: input.actorId,
        },
      };
    case "freeze_vote":
      return {
        ...base,
        votePatch: {
          status: "certifying",
          certification_status: "admin_review",
          certification_reason: reason,
          frozen_at: now.toISOString(),
          frozen_by: input.actorId,
          public_result: { outcome: "frozen", reason: summarizePublicReason(reason) },
        },
      };
    case "certify_vote":
      return {
        ...base,
        votePatch: {
          status: input.outcome ?? "passed",
          certification_status: "certified",
          certification_reason: reason,
          certified_at: now.toISOString(),
          certified_by: input.actorId,
          public_result: {
            outcome: input.outcome ?? "passed",
            reason: summarizePublicReason(reason),
            donationWeightExcluded: true,
          },
        },
      };
    case "invalidate_vote":
      return {
        ...base,
        votePatch: {
          status: "void",
          certification_status: "invalidated",
          certification_reason: reason,
          invalidated_at: now.toISOString(),
          invalidated_by: input.actorId,
          public_result: { outcome: "invalidated", reason: summarizePublicReason(reason) },
        },
      };
    case "restore_moderator":
      return {
        ...base,
        memberPatch: {
          member_role: "moderator",
          moderator_status: "active",
          moderator_status_reason: reason,
          moderator_updated_by: input.actorId,
        },
      };
    case "transfer_ownership":
      return {
        ...base,
        zonePatch: {
          created_by: input.targetUserId ?? null,
        },
        memberPatch: {
          member_role: "admin",
          moderator_tier: "lead_moderator",
          moderator_selection_source: "admin_emergency_appointment",
          moderator_status: "active",
          moderator_status_reason: reason,
          moderator_updated_by: input.actorId,
        },
      };
  }
}

export function buildGovernanceEvent(input: {
  zoneId: string;
  action: ZoneGovernanceAction;
  actorId: string;
  targetUserId?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
}): ZoneGovernanceEvent {
  if (!ZONE_GOVERNANCE_ACTIONS.includes(input.action)) {
    throw new Error("Unknown zone governance action.");
  }
  if (input.reason.trim().length === 0) {
    throw new Error("Zone governance action reason is required.");
  }

  return {
    zoneId: input.zoneId,
    action: input.action,
    actorId: input.actorId,
    targetUserId: input.targetUserId ?? null,
    reason: input.reason,
    auditAction: `zones.governance.${input.action}`,
    requiresCertification: input.action === "community_removal_petition",
    metadata: {
      public_summary_allowed: input.action !== "appeal",
      ...input.metadata,
    },
  };
}

export function normalizeZoneSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, "-")
    .replaceAll(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidZoneSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,47}$/.test(slug);
}

export function zoneFeatureSurface() {
  return {
    features: [...ZONE_FEATURES],
    roles: [...ZONE_ROLES],
    sortModes: [...ZONE_SORT_MODES],
    governanceActions: [...ZONE_GOVERNANCE_ACTIONS],
  };
}

function accountAgeDays(createdAt: string | Date, now: Date): number {
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) {
    return 0;
  }
  return Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeOptionalText(value: string | undefined): string | null {
  const text = value?.trim().replace(/\s+/g, " ") ?? "";
  return text.length > 0 ? text : null;
}

function summarizePublicReason(reason: string): string {
  const normalized = reason.trim().replace(/\s+/g, " ");
  return normalized.length <= 280 ? normalized : `${normalized.slice(0, 277)}...`;
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  const number = Math.floor(value ?? fallback);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  const number = value ?? fallback;
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function humanizeRole(role: ZoneRole): string {
  return role
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
