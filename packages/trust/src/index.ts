export const PACKAGE_NAME = "@ai-oss/trust" as const;

export const SENSITIVE_ACTIONS = [
  "vote",
  "downvote_scale",
  "zone_create",
  "post_create",
  "comment_create",
  "research_upload",
  "room_join",
  "voice_room_create",
  "mass_report",
  "governance_petition",
  "governance_vote",
  "moderator_removal_vote",
  "account_delete_export",
] as const;

export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];

export const PUBLIC_REPUTATION_FIELDS = [
  "communityKarma",
  "researchContributionScore",
  "reviewHelpfulnessScore",
  "replicationContributionScore",
  "zoneReputation",
] as const;

export type RiskLevel = "normal" | "elevated" | "restricted" | "suspended";

export interface TrustScoreInput {
  accountCreatedAt: string | Date;
  emailVerified: boolean;
  githubVerified?: boolean;
  orcidVerified?: boolean;
  mfaEnabled?: boolean;
  passkeyEnabled?: boolean;
  positiveContributions?: number;
  acceptedReviews?: number;
  acceptedReplications?: number;
  reportAccuracy?: number;
  moderatorActions?: number;
  spamRemovals?: number;
  voteAnomalyInvolvement?: number;
  deviceRiskScore?: number;
  ipRiskScore?: number;
  suspiciousLoginCount?: number;
  riskLevel?: RiskLevel;
  paymentStatus?: string | null;
  donationTotalCents?: number;
  now?: Date;
}

export interface TrustScoreResult {
  trustScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: Record<string, number>;
  excludedSignals: string[];
}

export interface PublicReputationInput {
  communityKarma?: number;
  researchContributionScore?: number;
  reviewHelpfulnessScore?: number;
  replicationContributionScore?: number;
  zoneReputation?: Record<string, number>;
  internalTrustScore?: number;
  riskScore?: number;
  deviceRiskScore?: number;
  ipRiskScore?: number;
  paymentStatus?: string | null;
}

export interface SensitiveActionGuardInput {
  action: SensitiveAction;
  accountAgeDays: number;
  emailVerified: boolean;
  trustScore: number;
  riskLevel?: RiskLevel;
  mfaEnabled?: boolean;
  passkeyEnabled?: boolean;
  csrfVerified?: boolean;
  botVerified?: boolean;
  botScore?: number;
  recentActionCount?: number;
  actionLimit?: number;
  windowSeconds?: number;
  similarityScore?: number;
  deviceRiskScore?: number;
  ipRiskScore?: number;
  highRiskZone?: boolean;
}

export interface SensitiveActionGuardDecision {
  allowed: boolean;
  status: 200 | 403 | 409 | 429;
  reasons: string[];
  requirements: string[];
  retryAfterSeconds: number;
  botChallengeRequired: boolean;
  rateLimited: boolean;
}

export interface VoteAnomalyInput {
  targetType: string;
  targetId: string;
  value: -1 | 1;
  voterAccountAgeDays: number;
  voterTrustScore: number;
  voterZoneHistoryCount?: number;
  voterPriorVoteCount?: number;
  votesInWindow?: number;
  newAccountVoteRatio?: number;
  noZoneHistoryVoteRatio?: number;
  sharedIpVoteCount?: number;
  sharedDeviceVoteCount?: number;
  externalReferrerVoteCount?: number;
  abnormalTimingScore?: number;
  upvoteRatioShift?: number;
  downvoteRatioShift?: number;
  moderatorRemovalVote?: boolean;
}

export interface VoteAnomalyDecision {
  suspiciousScore: number;
  certificationRequired: boolean;
  reasons: string[];
  mitigations: AntiBrigadingMitigation[];
}

export interface AntiBrigadingMitigation {
  type:
    | "hide_scores_temporarily"
    | "delay_ranking_effects"
    | "require_vote_certification"
    | "raise_quorum_threshold"
    | "freeze_governance_vote"
    | "route_security_review"
    | "cluster_rate_limit";
  severity: "low" | "medium" | "high" | "critical";
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export function computeTrustScore(input: TrustScoreInput): TrustScoreResult {
  const now = input.now ?? new Date();
  const ageDays = accountAgeDays(input.accountCreatedAt, now);
  const factors: Record<string, number> = {
    account_age: Math.min(18, Math.floor(ageDays / 14) * 2),
    verified_email: input.emailVerified ? 10 : -15,
    verified_github: input.githubVerified === true ? 5 : 0,
    verified_orcid: input.orcidVerified === true ? 5 : 0,
    mfa_or_passkey: input.mfaEnabled === true || input.passkeyEnabled === true ? 10 : 0,
    positive_contributions: Math.min(18, Math.max(0, input.positiveContributions ?? 0) * 1.5),
    accepted_reviews: Math.min(10, Math.max(0, input.acceptedReviews ?? 0) * 2),
    accepted_replications: Math.min(10, Math.max(0, input.acceptedReplications ?? 0) * 2.5),
    report_accuracy: clamp01(input.reportAccuracy ?? 0.5) * 8,
    moderator_actions: -Math.min(20, Math.max(0, input.moderatorActions ?? 0) * 4),
    spam_removals: -Math.min(25, Math.max(0, input.spamRemovals ?? 0) * 6),
    vote_anomaly_involvement: -Math.min(20, Math.max(0, input.voteAnomalyInvolvement ?? 0) * 5),
    device_ip_risk: -Math.min(
      20,
      Math.max(0, input.deviceRiskScore ?? 0) * 10 + Math.max(0, input.ipRiskScore ?? 0) * 10,
    ),
    suspicious_logins: -Math.min(12, Math.max(0, input.suspiciousLoginCount ?? 0) * 3),
  };
  const riskScore = clampScore(
    Math.max(0, input.deviceRiskScore ?? 0) * 35 +
      Math.max(0, input.ipRiskScore ?? 0) * 35 +
      Math.max(0, input.suspiciousLoginCount ?? 0) * 5 +
      Math.max(0, input.spamRemovals ?? 0) * 8 +
      Math.max(0, input.voteAnomalyInvolvement ?? 0) * 7,
  );
  const base = 40 + Object.values(factors).reduce((sum, factor) => sum + factor, 0);
  const riskLevel = input.riskLevel ?? riskLevelFromScore(riskScore);
  const riskPenalty = riskLevel === "suspended" ? 100 : riskLevel === "restricted" ? 40 : 0;

  return {
    trustScore: clampScore(base - riskPenalty),
    riskScore,
    riskLevel,
    factors,
    excludedSignals: [
      ...(input.paymentStatus ? ["payment_status"] : []),
      ...(Number(input.donationTotalCents ?? 0) > 0 ? ["donation_total_cents"] : []),
    ],
  };
}

export function buildUserSecurityStatePatch(result: TrustScoreResult, now: Date = new Date()) {
  return {
    trust_score: result.trustScore,
    risk_score: result.riskScore,
    risk_level: result.riskLevel,
    risk_factors: result.factors,
    updated_at: now.toISOString(),
  };
}

export function buildProfileTrustPatch(result: TrustScoreResult) {
  return {
    trust_score: result.trustScore,
  };
}

export function buildPublicReputation(input: PublicReputationInput) {
  return {
    communityKarma: Math.trunc(input.communityKarma ?? 0),
    researchContributionScore: Math.trunc(input.researchContributionScore ?? 0),
    reviewHelpfulnessScore: Math.trunc(input.reviewHelpfulnessScore ?? 0),
    replicationContributionScore: Math.trunc(input.replicationContributionScore ?? 0),
    zoneReputation: sanitizeZoneReputation(input.zoneReputation ?? {}),
    hiddenSignals: [
      "internalTrustScore",
      "riskScore",
      "deviceRiskScore",
      "ipRiskScore",
      "paymentStatus",
    ],
  };
}

export function evaluateSensitiveActionGuard(
  input: SensitiveActionGuardInput,
): SensitiveActionGuardDecision {
  const reasons: string[] = [];
  const requirements: string[] = [];
  const limit = input.actionLimit ?? defaultActionLimit(input.action);
  const recentActionCount = input.recentActionCount ?? 0;
  const newUserCooldownDays = newUserCooldownForAction(input.action);

  if (input.riskLevel === "suspended") {
    reasons.push("account_suspended");
  }
  if (input.riskLevel === "restricted" && input.action !== "account_delete_export") {
    reasons.push("account_restricted");
  }
  if (!input.emailVerified) {
    reasons.push("email_verification_required");
    requirements.push("verified_email");
  }
  if (input.csrfVerified === false) {
    reasons.push("csrf_required");
    requirements.push("csrf_token");
  }
  if (input.botVerified === false || (input.botScore !== undefined && input.botScore >= 0.75)) {
    reasons.push("bot_challenge_required");
    requirements.push("bot_challenge");
  }
  if (recentActionCount >= limit) {
    reasons.push("action_rate_limited");
  }
  if (input.accountAgeDays < newUserCooldownDays && input.trustScore < trustFloor(input.action)) {
    reasons.push("new_user_cooldown");
    requirements.push("account_age_or_trust");
  }
  if (input.highRiskZone === true && input.trustScore < trustFloor(input.action) + 10) {
    reasons.push("high_risk_zone_requires_higher_trust");
  }
  if (input.similarityScore !== undefined && input.similarityScore >= 0.92) {
    reasons.push("content_similarity_limit");
  }
  if (input.deviceRiskScore !== undefined && input.deviceRiskScore >= 0.85) {
    reasons.push("device_risk_challenge");
    requirements.push("step_up_verification");
  }
  if (input.ipRiskScore !== undefined && input.ipRiskScore >= 0.85) {
    reasons.push("ip_risk_challenge");
    requirements.push("step_up_verification");
  }

  const rateLimited = reasons.includes("action_rate_limited");
  const botChallengeRequired = reasons.includes("bot_challenge_required");
  const allowed =
    reasons.length === 0 ||
    (reasons.length === 1 && botChallengeRequired && input.action === "account_delete_export");

  return {
    allowed,
    status: allowed ? 200 : rateLimited ? 429 : botChallengeRequired ? 409 : 403,
    reasons,
    requirements: Array.from(new Set(requirements)),
    retryAfterSeconds: rateLimited
      ? (input.windowSeconds ?? defaultWindowSeconds(input.action))
      : 0,
    botChallengeRequired,
    rateLimited,
  };
}

export function classifyVoteAnomaly(input: VoteAnomalyInput): VoteAnomalyDecision {
  const reasons: string[] = [];
  let score = 0;
  if (input.voterAccountAgeDays < 7) {
    score += 0.18;
    reasons.push("new_account_vote");
  }
  if ((input.voterZoneHistoryCount ?? 0) === 0) {
    score += 0.14;
    reasons.push("no_zone_history");
  }
  if (input.voterTrustScore < 20) {
    score += 0.16;
    reasons.push("low_trust_voter");
  }
  if ((input.votesInWindow ?? 0) >= 20) {
    score += 0.14;
    reasons.push("abnormal_vote_timing");
  }
  if ((input.newAccountVoteRatio ?? 0) >= 0.35) {
    score += 0.16;
    reasons.push("new_account_vote_flood");
  }
  if ((input.noZoneHistoryVoteRatio ?? 0) >= 0.4) {
    score += 0.14;
    reasons.push("no_zone_history_vote_flood");
  }
  if ((input.sharedIpVoteCount ?? 0) >= 4) {
    score += 0.14;
    reasons.push("shared_ip_cluster");
  }
  if ((input.sharedDeviceVoteCount ?? 0) >= 3) {
    score += 0.16;
    reasons.push("shared_device_cluster");
  }
  if ((input.externalReferrerVoteCount ?? 0) >= 10) {
    score += 0.18;
    reasons.push("external_coordination_indicator");
  }
  score += clamp01(input.abnormalTimingScore ?? 0) * 0.16;
  if ((input.upvoteRatioShift ?? 0) >= 0.45 || (input.downvoteRatioShift ?? 0) >= 0.45) {
    score += 0.15;
    reasons.push("abnormal_vote_ratio_shift");
  }
  if (input.value === -1 && (input.voterPriorVoteCount ?? 0) >= 25) {
    score += 0.12;
    reasons.push("downvoting_at_scale");
  }
  if (input.moderatorRemovalVote === true) {
    score += 0.2;
    reasons.push("moderator_removal_brigade_risk");
  }

  const suspiciousScore = clamp01(score);
  return {
    suspiciousScore,
    certificationRequired: suspiciousScore >= 0.35,
    reasons,
    mitigations: buildAntiBrigadingMitigations(suspiciousScore, reasons, input),
  };
}

export function buildVoteCertificationPatch(decision: VoteAnomalyDecision, now: Date = new Date()) {
  const certified = !decision.certificationRequired;
  return {
    is_certified: certified,
    certified_at: certified ? now.toISOString() : null,
    certification_reason: certified
      ? "auto_certified_low_risk"
      : `pending_anti_abuse_review:${decision.reasons.join("|")}`,
    certification_status: certified ? "certified" : "pending",
    suspicious_score: Number(decision.suspiciousScore.toFixed(4)),
    anomaly_reasons: decision.reasons,
  };
}

export function buildAbuseRateLimitEventRow(input: {
  actorId?: string | null;
  action: SensitiveAction;
  bucket: string;
  allowed: boolean;
  reason?: string | null;
  ipHash?: string | null;
  deviceHash?: string | null;
  botScore?: number | null;
  metadata?: Record<string, unknown>;
}) {
  return {
    actor_id: input.actorId ?? null,
    action: input.action,
    bucket: input.bucket,
    allowed: input.allowed,
    reason: input.reason ?? null,
    ip_hash: input.ipHash ?? null,
    device_hash: input.deviceHash ?? null,
    bot_score: input.botScore ?? null,
    metadata: input.metadata ?? {},
  };
}

export function sensitiveActionWindow(input: { action: SensitiveAction; now?: Date }) {
  const now = input.now ?? new Date();
  const windowSeconds = defaultWindowSeconds(input.action);
  const bucketStartMs = Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000;
  return {
    windowSeconds,
    bucket: `${input.action}:${new Date(bucketStartMs).toISOString()}`,
    since: new Date(now.getTime() - windowSeconds * 1000).toISOString(),
    limit: defaultActionLimit(input.action),
  };
}

export function buildAntiBrigadingMitigations(
  suspiciousScore: number,
  reasons: readonly string[],
  input: Pick<VoteAnomalyInput, "targetType" | "targetId" | "moderatorRemovalVote">,
): AntiBrigadingMitigation[] {
  if (suspiciousScore < 0.35) {
    return [];
  }
  const severity =
    suspiciousScore >= 0.75 ? "critical" : suspiciousScore >= 0.55 ? "high" : "medium";
  const mitigations: AntiBrigadingMitigation[] = [
    {
      type: "require_vote_certification",
      severity,
      metadata: { reasons: [...reasons], targetType: input.targetType, targetId: input.targetId },
    },
    {
      type: "delay_ranking_effects",
      severity,
      durationSeconds: 6 * 60 * 60,
    },
  ];
  if (suspiciousScore >= 0.55) {
    mitigations.push({ type: "hide_scores_temporarily", severity, durationSeconds: 24 * 60 * 60 });
    mitigations.push({ type: "cluster_rate_limit", severity, durationSeconds: 60 * 60 });
  }
  if (suspiciousScore >= 0.75) {
    mitigations.push({ type: "route_security_review", severity });
  }
  if (input.moderatorRemovalVote === true) {
    mitigations.push({ type: "freeze_governance_vote", severity });
    mitigations.push({ type: "raise_quorum_threshold", severity, metadata: { deltaPercent: 10 } });
  }
  return mitigations;
}

function defaultActionLimit(action: SensitiveAction): number {
  switch (action) {
    case "vote":
      return 60;
    case "downvote_scale":
      return 25;
    case "zone_create":
      return 2;
    case "post_create":
      return 20;
    case "comment_create":
      return 60;
    case "research_upload":
      return 8;
    case "room_join":
      return 30;
    case "voice_room_create":
      return 5;
    case "mass_report":
      return 20;
    case "governance_petition":
      return 3;
    case "governance_vote":
      return 20;
    case "moderator_removal_vote":
      return 5;
    case "account_delete_export":
      return 4;
  }
}

function defaultWindowSeconds(action: SensitiveAction): number {
  switch (action) {
    case "vote":
    case "comment_create":
    case "room_join":
      return 10 * 60;
    case "downvote_scale":
    case "post_create":
    case "mass_report":
      return 60 * 60;
    default:
      return 24 * 60 * 60;
  }
}

function trustFloor(action: SensitiveAction): number {
  switch (action) {
    case "zone_create":
      return 25;
    case "research_upload":
      return 20;
    case "voice_room_create":
      return 20;
    case "governance_petition":
    case "governance_vote":
    case "moderator_removal_vote":
      return 30;
    default:
      return 10;
  }
}

function newUserCooldownForAction(action: SensitiveAction): number {
  switch (action) {
    case "vote":
    case "comment_create":
      return 1;
    case "post_create":
    case "mass_report":
    case "room_join":
      return 2;
    case "zone_create":
    case "research_upload":
    case "voice_room_create":
      return 7;
    case "governance_petition":
    case "governance_vote":
    case "moderator_removal_vote":
      return 14;
    case "downvote_scale":
      return 7;
    case "account_delete_export":
      return 0;
  }
}

function riskLevelFromScore(riskScore: number): RiskLevel {
  if (riskScore >= 85) {
    return "suspended";
  }
  if (riskScore >= 65) {
    return "restricted";
  }
  if (riskScore >= 35) {
    return "elevated";
  }
  return "normal";
}

function sanitizeZoneReputation(input: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([zoneId]) => zoneId.trim().length > 0)
      .map(([zoneId, score]) => [zoneId, Math.trunc(score)])
      .slice(0, 100),
  );
}

function accountAgeDays(createdAt: string | Date, now: Date): number {
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) {
    return 0;
  }
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(value.toFixed(4))));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
