import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@ai-oss/auth";
import { classifyVoteAnomaly } from "@ai-oss/trust";
import {
  buildEmergencyGovernanceOverride,
  buildGovernanceBallotRow,
  buildGovernanceEvent,
  buildModeratorRemovalPetitionRow,
  buildModeratorRemovalVoteRow,
  buildModeratorSelectionPatch,
  buildPetitionSupportRow,
  certifyGovernanceVote,
  evaluateGovernanceEligibility,
  normalizeGovernanceSettings,
  readModeratorTier,
  shouldOpenModeratorRemovalVote,
  ZONE_GOVERNANCE_ACTIONS,
  type GovernanceEligibilityDecision,
  type GovernanceEmergencyOverrideAction,
  type GovernanceSettingsInput,
  type ModeratorSelectionSource,
  type ZoneGovernanceAction,
} from "@ai-oss/zones";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import {
  correlationIdFromRequest,
  insertAuditEvent,
  isRecord,
  readRequestBody,
  readString,
  requirePermissionForRequest,
} from "@/lib/permissions-server";
import { enforceSensitiveAction, readEmailVerified } from "@/lib/trust-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ zoneId: string }>;
};

type SupabaseServiceClient = SupabaseClient;

type PetitionRow = Record<string, unknown> & {
  id: string;
  target_user_id: string;
  support_threshold?: number | string | null;
  opened_vote_id?: string | null;
};

const GLOBAL_OVERRIDE_ROLES = new Set([
  "owner",
  "super_admin",
  "trust_safety_admin",
  "security_admin",
  "legal_admin",
]);

export async function POST(request: Request, context: RouteContext) {
  const { zoneId } = await context.params;
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-governance-action", "Expected a JSON object body.");
  }

  const action = readString(body.action) as ZoneGovernanceAction;
  if (!ZONE_GOVERNANCE_ACTIONS.includes(action)) {
    return problem(400, "unknown-governance-action", "Unknown governance action.");
  }

  if (
    action === "governance_vote_freeze" ||
    action === "governance_vote_certify" ||
    action === "governance_vote_invalidate" ||
    action === "moderator_emergency_suspension" ||
    action === "moderator_restore" ||
    action === "zone_ownership_transfer"
  ) {
    return handleEmergencyOverride(request, zoneId, body, action);
  }

  if (
    action === "moderator_appointment" ||
    action === "lead_moderator_invitation" ||
    action === "community_nomination"
  ) {
    return handleModeratorSelection(request, zoneId, body, action);
  }

  if (action === "community_removal_petition") {
    return handleRemovalPetition(request, zoneId, body);
  }
  if (action === "community_removal_support") {
    return handleRemovalSupport(request, zoneId, body);
  }
  if (action === "community_removal_ballot") {
    return handleRemovalBallot(request, zoneId, body);
  }
  if (action === "community_removal_vote_close") {
    return handleRemovalVoteClose(request, zoneId, body);
  }

  return recordFallbackGovernanceAction(request, zoneId, body, action);
}

async function handleModeratorSelection(
  request: Request,
  zoneId: string,
  body: Record<string, unknown>,
  action: "moderator_appointment" | "lead_moderator_invitation" | "community_nomination",
) {
  const guard = await requirePermissionForRequest(request, "zones.members.update", { zoneId });
  if (!guard.ok) {
    return guard.response;
  }

  const targetUserId = readString(body.targetUserId ?? body.target_user_id ?? body.userId);
  if (!targetUserId) {
    return problem(400, "moderator-target-required", "targetUserId is required.");
  }

  const tier = readModeratorTier(body.tier ?? body.moderatorTier ?? body.moderator_tier);
  const source = readSelectionSource(body.source, action);
  const reason = readString(body.reason) || "Moderator selection recorded.";
  let patch;
  try {
    patch = buildModeratorSelectionPatch({
      tier,
      source,
      actorId: guard.actor.id,
      reason,
    });
  } catch (error) {
    return problem(400, "moderator-selection-rejected", errorMessage(error));
  }

  const event = buildGovernanceEvent({
    zoneId,
    action,
    actorId: guard.actor.id,
    targetUserId,
    reason,
    metadata: { tier, source },
  });

  const { data, error } = await guard.service
    .from("zone_members")
    .upsert({
      zone_id: zoneId,
      user_id: targetUserId,
      ...patch,
    })
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "moderator-selection-failed", error.message);
  }

  await auditGovernance(request, guard.service, {
    actorId: guard.actor.id,
    actorRole: guard.decision.actorRoles[0] ?? "zone_admin",
    action: event.auditAction,
    resourceType: "zone_moderator",
    resourceId: targetUserId,
    zoneId,
    newState: data,
    reason,
  });

  return NextResponse.json(
    { ok: true, event, moderator: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function handleRemovalPetition(
  request: Request,
  zoneId: string,
  body: Record<string, unknown>,
) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const guard = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "governance_petition",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!guard.ok) {
    return guard.response;
  }

  const targetUserId = readString(body.targetUserId ?? body.target_user_id);
  if (!targetUserId) {
    return problem(400, "moderator-target-required", "targetUserId is required.");
  }

  const target = await service.client
    .from("zone_members")
    .select("user_id, member_role, moderator_tier, moderator_status")
    .eq("zone_id", zoneId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (target.error !== null) {
    return problem(400, "moderator-target-read-failed", target.error.message);
  }
  if (
    target.data === null ||
    !["moderator", "admin"].includes(String(target.data.member_role)) ||
    target.data.moderator_status === "suspended"
  ) {
    return problem(400, "moderator-target-invalid", "Target must be an active zone moderator.");
  }
  if (await hasProtectedGlobalRole(service.client, targetUserId)) {
    return problem(
      403,
      "global-admin-removal-denied",
      "Global admins acting in global capacity cannot be removed by zone vote.",
    );
  }

  const [settings, eligibility] = await Promise.all([
    loadGovernanceSettings(service.client, zoneId),
    loadGovernanceEligibility(service.client, zoneId, auth.user.id, body, readEmailVerified(auth.user)),
  ]);
  if (!eligibility.eligible) {
    return problem(403, "governance-eligibility-failed", eligibility.reasons.join(", "));
  }

  let petitionRow;
  try {
    petitionRow = buildModeratorRemovalPetitionRow({
      zoneId,
      targetUserId,
      actorId: auth.user.id,
      reason: readString(body.reason),
      eligibility,
      settings,
    });
  } catch (error) {
    return problem(400, "moderator-removal-petition-rejected", errorMessage(error));
  }

  const { data: petition, error } = await service.client
    .from("mod_removal_petitions")
    .insert(petitionRow)
    .select("*")
    .single();
  if (error !== null) {
    return problem(400, "moderator-removal-petition-failed", error.message);
  }

  const support = buildPetitionSupportRow({
    petitionId: petition.id,
    userId: auth.user.id,
    eligibility,
    riskSnapshot: { initiator: true },
  });
  await service.client.from("mod_removal_petition_support").insert(support);
  const updated = await updatePetitionSupportAndMaybeOpenVote(
    request,
    service.client,
    zoneId,
    petition,
    1,
    settings,
    auth.user.id,
  );

  await auditGovernance(request, service.client, {
    actorId: auth.user.id,
    actorRole: "member",
    action: "zones.governance.community_removal_petition",
    resourceType: "mod_removal_petition",
    resourceId: petition.id,
    zoneId,
    newState: updated,
    reason: petition.reason,
  });

  return NextResponse.json(
    { ok: true, petition: updated },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function handleRemovalSupport(
  request: Request,
  zoneId: string,
  body: Record<string, unknown>,
) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const guard = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "governance_petition",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!guard.ok) {
    return guard.response;
  }

  const petitionId = readString(body.petitionId ?? body.petition_id);
  const petition = await readPetition(service.client, zoneId, petitionId);
  if (!petition.ok) {
    return petition.response;
  }
  if (petition.data.status !== "open" && petition.data.status !== "qualified") {
    return problem(409, "petition-not-open", "Petition is no longer collecting support.");
  }

  const eligibility = await loadGovernanceEligibility(
    service.client,
    zoneId,
    auth.user.id,
    body,
    readEmailVerified(auth.user),
  );
  if (!eligibility.eligible) {
    return problem(403, "governance-eligibility-failed", eligibility.reasons.join(", "));
  }
  const support = buildPetitionSupportRow({
    petitionId,
    userId: auth.user.id,
    eligibility,
    riskSnapshot: { supporter: true },
  });
  const inserted = await service.client.from("mod_removal_petition_support").insert(support);
  if (inserted.error !== null) {
    return problem(400, "petition-support-failed", inserted.error.message);
  }

  const counted = await service.client
    .from("mod_removal_petition_support")
    .select("user_id", { count: "exact", head: true })
    .eq("petition_id", petitionId);
  if (counted.error !== null) {
    return problem(400, "petition-support-count-failed", counted.error.message);
  }
  const settings = await loadGovernanceSettings(service.client, zoneId, petition.data);
  const updated = await updatePetitionSupportAndMaybeOpenVote(
    request,
    service.client,
    zoneId,
    petition.data,
    counted.count ?? 0,
    settings,
    auth.user.id,
  );

  await auditGovernance(request, service.client, {
    actorId: auth.user.id,
    actorRole: "member",
    action: "zones.governance.community_removal_support",
    resourceType: "mod_removal_petition",
    resourceId: petitionId,
    zoneId,
    newState: updated,
    reason: readString(body.reason) || "Petition support added.",
  });

  return NextResponse.json({ ok: true, petition: updated }, { headers: { "Cache-Control": "no-store" } });
}

async function handleRemovalBallot(
  request: Request,
  zoneId: string,
  body: Record<string, unknown>,
) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const guard = await enforceSensitiveAction({
    client: service.client,
    request,
    userId: auth.user.id,
    action: "moderator_removal_vote",
    emailVerified: readEmailVerified(auth.user),
  });
  if (!guard.ok) {
    return guard.response;
  }

  const voteId = readString(body.voteId ?? body.vote_id);
  const vote = await readGovernanceVote(service.client, zoneId, voteId);
  if (!vote.ok) {
    return vote.response;
  }
  if (vote.data.status !== "open") {
    return problem(409, "governance-vote-not-open", "Governance vote is not open.");
  }

  const choice = readChoice(body.choice);
  if (!choice) {
    return problem(400, "invalid-ballot-choice", "choice must be yes, no, or abstain.");
  }

  const eligibility = await loadGovernanceEligibility(
    service.client,
    zoneId,
    auth.user.id,
    body,
    readEmailVerified(auth.user),
  );
  if (!eligibility.eligible) {
    return problem(403, "governance-eligibility-failed", eligibility.reasons.join(", "));
  }

  const anomaly = classifyVoteAnomaly({
    targetType: "governance_vote",
    targetId: voteId,
    value: choice === "no" ? -1 : 1,
    voterAccountAgeDays: readSnapshotNumber(eligibility.snapshot.accountAgeDays),
    voterTrustScore: readSnapshotNumber(eligibility.snapshot.trustScore),
    voterZoneHistoryCount: readSnapshotNumber(eligibility.snapshot.zoneMembershipAgeDays) > 0 ? 1 : 0,
    moderatorRemovalVote: true,
    votesInWindow: readNumber(body.votesInWindow ?? body.votes_in_window),
    newAccountVoteRatio: readNumber(body.newAccountVoteRatio ?? body.new_account_vote_ratio),
    noZoneHistoryVoteRatio: readNumber(
      body.noZoneHistoryVoteRatio ?? body.no_zone_history_vote_ratio,
    ),
    sharedIpVoteCount: readNumber(body.sharedIpVoteCount ?? body.shared_ip_vote_count),
    sharedDeviceVoteCount: readNumber(
      body.sharedDeviceVoteCount ?? body.shared_device_vote_count,
    ),
    externalReferrerVoteCount: readNumber(
      body.externalReferrerVoteCount ?? body.external_referrer_vote_count,
    ),
    abnormalTimingScore: readNumber(body.abnormalTimingScore ?? body.abnormal_timing_score),
  });

  const ballot = buildGovernanceBallotRow({
    voteId,
    userId: auth.user.id,
    choice,
    ballotHash: ballotHash(voteId, auth.user.id, choice),
    eligibility,
    riskSnapshot: {
      mitigations: anomaly.mitigations,
      voterIdentitiesHiddenDuringVoting: true,
      donationWeightExcluded: true,
    },
    suspiciousScore: anomaly.suspiciousScore,
    certificationRequired: Boolean(vote.data.certification_required),
    anomalyReasons: anomaly.reasons,
  });
  const inserted = await service.client
    .from("governance_ballots")
    .upsert(ballot, { onConflict: "governance_vote_id,user_id" })
    .select("choice, is_certified, suspicious_score, certification_reason, anomaly_reasons")
    .single();
  if (inserted.error !== null) {
    return problem(400, "governance-ballot-failed", inserted.error.message);
  }

  if (anomaly.mitigations.some((mitigation) => mitigation.type === "freeze_governance_vote")) {
    await service.client
      .from("governance_votes")
      .update({
        status: "certifying",
        certification_status: "admin_review",
        brigading_mitigation: anomaly.mitigations,
        quorum_adjustment_percent: 10,
        admin_review_reason: "Moderator-removal ballot anomaly requires review.",
      })
      .eq("id", voteId);
  }

  await auditGovernance(request, service.client, {
    actorId: auth.user.id,
    actorRole: "member",
    action: "zones.governance.community_removal_ballot",
    resourceType: "governance_vote",
    resourceId: voteId,
    zoneId,
    newState: {
      choice,
      certificationRequired: anomaly.certificationRequired,
      suspiciousScore: anomaly.suspiciousScore,
      voterIdentityHidden: true,
    },
    reason: "Governance ballot submitted.",
  });

  return NextResponse.json(
    { ok: true, ballot: inserted.data, anomaly },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function handleRemovalVoteClose(
  request: Request,
  zoneId: string,
  body: Record<string, unknown>,
) {
  const guard = await requirePermissionForRequest(request, "zones.governance_update", { zoneId });
  if (!guard.ok) {
    return guard.response;
  }
  const voteId = readString(body.voteId ?? body.vote_id);
  const vote = await readGovernanceVote(guard.service, zoneId, voteId);
  if (!vote.ok) {
    return vote.response;
  }
  const ballots = await guard.service
    .from("governance_ballots")
    .select("choice, is_certified, suspicious_score")
    .eq("governance_vote_id", voteId);
  if (ballots.error !== null) {
    return problem(400, "governance-ballots-read-failed", ballots.error.message);
  }
  const eligibleMembers = await guard.service
    .from("zone_members")
    .select("user_id", { count: "exact", head: true })
    .eq("zone_id", zoneId)
    .eq("status", "active");
  if (eligibleMembers.error !== null) {
    return problem(400, "governance-eligible-members-read-failed", eligibleMembers.error.message);
  }

  const patch = certifyGovernanceVote({
    ballots: (ballots.data ?? []).map((ballot) => ({
      choice: String(ballot.choice ?? ""),
      isCertified: ballot.is_certified === true,
      suspiciousScore: Number(ballot.suspicious_score ?? 0),
    })),
    eligibleVoterCount: eligibleMembers.count ?? 1,
    settings: {
      quorumPercent: Number(vote.data.quorum_percent ?? 10),
      removalThresholdPercent: Number(vote.data.removal_threshold_percent ?? 60),
      certificationRequired: Boolean(vote.data.certification_required),
    },
    brigadingMitigation: Array.isArray(vote.data.brigading_mitigation)
      ? vote.data.brigading_mitigation
      : [],
    certifiedBy: guard.actor.id,
    reason: readString(body.reason) || "Governance vote certified.",
  });
  const updated = await guard.service
    .from("governance_votes")
    .update(patch)
    .eq("id", voteId)
    .select("*")
    .single();
  if (updated.error !== null) {
    return problem(400, "governance-vote-close-failed", updated.error.message);
  }

  const petition = await maybeReadPetitionForVote(guard.service, zoneId, vote.data.subject_id);
  if (petition && patch.status === "passed") {
    await guard.service
      .from("zone_members")
      .update({
        member_role: "member",
        moderator_tier: null,
        moderator_status: "removed",
        moderator_selection_source: "community_removal",
        moderator_status_reason: patch.certification_reason,
        moderator_updated_by: guard.actor.id,
      })
      .eq("zone_id", zoneId)
      .eq("user_id", petition.target_user_id);
    await guard.service
      .from("mod_removal_petitions")
      .update({ status: "passed", outcome_reason: patch.certification_reason })
      .eq("id", petition.id);
  } else if (petition && patch.status === "failed") {
    await guard.service
      .from("mod_removal_petitions")
      .update({ status: "failed", outcome_reason: patch.certification_reason })
      .eq("id", petition.id);
  }

  await auditGovernance(request, guard.service, {
    actorId: guard.actor.id,
    actorRole: guard.decision.actorRoles[0] ?? "zone_admin",
    action: "zones.governance.community_removal_vote_close",
    resourceType: "governance_vote",
    resourceId: voteId,
    zoneId,
    previousState: vote.data,
    newState: updated.data,
    reason: patch.certification_reason,
  });

  return NextResponse.json(
    { ok: true, vote: updated.data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function handleEmergencyOverride(
  request: Request,
  zoneId: string,
  body: Record<string, unknown>,
  action: ZoneGovernanceAction,
) {
  const guard = await requirePermissionForRequest(request, "zones.governance_update", { zoneId });
  if (!guard.ok) {
    return guard.response;
  }
  if (!guard.decision.actorRoles.some((role) => GLOBAL_OVERRIDE_ROLES.has(role))) {
    return problem(403, "global-admin-required", "Emergency overrides require a global admin role.");
  }

  const overrideAction = mapEmergencyAction(action);
  const targetUserId = readString(body.targetUserId ?? body.target_user_id) || null;
  const voteId = readString(body.voteId ?? body.vote_id);
  let override;
  try {
    override = buildEmergencyGovernanceOverride({
      action: overrideAction,
      actorId: guard.actor.id,
      targetUserId,
      reason: readString(body.reason),
      outcome: readString(body.outcome) === "failed" ? "failed" : "passed",
    });
  } catch (error) {
    return problem(400, "governance-override-rejected", errorMessage(error));
  }

  const results: Record<string, unknown> = {};
  if ("votePatch" in override) {
    if (!voteId) {
      return problem(400, "governance-vote-required", "voteId is required.");
    }
    const vote = await guard.service
      .from("governance_votes")
      .update(override.votePatch)
      .eq("zone_id", zoneId)
      .eq("id", voteId)
      .select("*")
      .single();
    if (vote.error !== null) {
      return problem(400, "governance-override-vote-failed", vote.error.message);
    }
    results.vote = vote.data;
  }
  if ("memberPatch" in override) {
    if (!targetUserId) {
      return problem(400, "moderator-target-required", "targetUserId is required.");
    }
    const member = await guard.service
      .from("zone_members")
      .upsert({
        zone_id: zoneId,
        user_id: targetUserId,
        ...override.memberPatch,
      })
      .select("*")
      .single();
    if (member.error !== null) {
      return problem(400, "governance-override-member-failed", member.error.message);
    }
    results.member = member.data;
  }
  if ("zonePatch" in override) {
    const zone = await guard.service
      .from("zones")
      .update(override.zonePatch)
      .eq("id", zoneId)
      .select("*")
      .single();
    if (zone.error !== null) {
      return problem(400, "governance-override-zone-failed", zone.error.message);
    }
    results.zone = zone.data;
  }

  await auditGovernance(request, guard.service, {
    actorId: guard.actor.id,
    actorRole: guard.decision.actorRoles[0] ?? "global_admin",
    action: override.auditAction,
    resourceType: voteId ? "governance_vote" : "zone_moderator",
    resourceId: voteId || targetUserId,
    zoneId,
    newState: results,
    reason: readString(body.reason),
  });

  return NextResponse.json({ ok: true, override: results }, { headers: { "Cache-Control": "no-store" } });
}

async function recordFallbackGovernanceAction(
  request: Request,
  zoneId: string,
  body: Record<string, unknown>,
  action: ZoneGovernanceAction,
) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  let event;
  try {
    event = buildGovernanceEvent({
      zoneId,
      action,
      actorId: auth.user.id,
      targetUserId: readString(body.targetUserId ?? body.target_user_id) || null,
      reason: readString(body.reason),
      metadata: {
        source: "api",
        payload: body.metadata,
      },
    });
  } catch (error) {
    return problem(400, "governance-action-rejected", errorMessage(error));
  }

  await auditGovernance(request, service.client, {
    actorId: auth.user.id,
    actorRole: "member",
    action: event.auditAction,
    resourceType: "zone_governance_action",
    resourceId: event.targetUserId,
    zoneId,
    newState: event,
    reason: event.reason,
  });

  return NextResponse.json(
    { ok: true, event },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function updatePetitionSupportAndMaybeOpenVote(
  request: Request,
  service: SupabaseServiceClient,
  zoneId: string,
  petition: PetitionRow,
  supportCount: number,
  settings: GovernanceSettingsInput,
  actorId: string,
) {
  const threshold = Number(petition.support_threshold ?? settings.petitionThreshold ?? 10);
  if (!shouldOpenModeratorRemovalVote({ supportCount, threshold })) {
    const updated = await service
      .from("mod_removal_petitions")
      .update({ support_count: supportCount })
      .eq("id", petition.id)
      .select("*")
      .single();
    return updated.data ?? petition;
  }

  if (petition.opened_vote_id) {
    const updated = await service
      .from("mod_removal_petitions")
      .update({ support_count: supportCount, status: "vote_open" })
      .eq("id", petition.id)
      .select("*")
      .single();
    return updated.data ?? petition;
  }

  const voteRow = buildModeratorRemovalVoteRow({
    zoneId,
    petitionId: petition.id,
    targetUserId: petition.target_user_id,
    createdBy: actorId,
    settings,
  });
  const vote = await service.from("governance_votes").insert(voteRow).select("*").single();
  if (vote.error !== null) {
    return petition;
  }
  const updated = await service
    .from("mod_removal_petitions")
    .update({
      support_count: supportCount,
      status: "vote_open",
      qualified_at: new Date().toISOString(),
      opened_vote_id: vote.data.id,
    })
    .eq("id", petition.id)
    .select("*")
    .single();

  await auditGovernance(request, service, {
    actorId,
    actorRole: "member",
    action: "zones.governance.community_removal_vote_open",
    resourceType: "governance_vote",
    resourceId: vote.data.id,
    zoneId,
    newState: vote.data,
    reason: "Petition threshold met; removal vote opened.",
  });

  return updated.data ?? { ...petition, opened_vote_id: vote.data.id, status: "vote_open" };
}

async function loadGovernanceEligibility(
  service: SupabaseServiceClient,
  zoneId: string,
  userId: string,
  body: Record<string, unknown>,
  emailVerified: boolean,
): Promise<GovernanceEligibilityDecision> {
  const [member, profile, security] = await Promise.all([
    service
      .from("zone_members")
      .select("status, joined_at")
      .eq("zone_id", zoneId)
      .eq("user_id", userId)
      .maybeSingle(),
    service.from("profiles").select("created_at, trust_score, suspended_at").eq("id", userId).single(),
    service
      .from("user_security_state")
      .select("risk_score, device_risk, risk_level")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return evaluateGovernanceEligibility({
    emailVerified,
    accountAgeDays: daysSince(profile.data?.created_at),
    zoneMembershipAgeDays: daysSince(member.data?.joined_at),
    meaningfulZoneParticipationCount: readNumber(
      body.meaningfulZoneParticipationCount ?? body.meaningful_zone_participation_count,
    ),
    bannedOrSuspended:
      member.data?.status === "banned" ||
      profile.data?.suspended_at !== null ||
      security.data?.risk_level === "suspended",
    recentSevereModerationActions: readNumber(
      body.recentSevereModerationActions ?? body.recent_severe_moderation_actions,
    ),
    deviceRiskScore: readDeviceRisk(security.data?.device_risk),
    ipRiskScore: Number(security.data?.risk_score ?? 0) / 100,
    botVerified:
      requestBotStatus(body) !== "failed" && readString(body.botIdStatus ?? body.botid_status) !== "failed",
    rateLimited: false,
    trustScore: Number(profile.data?.trust_score ?? 0),
    duplicateAccountClusterRisk: readNumber(
      body.duplicateAccountClusterRisk ?? body.duplicate_account_cluster_risk,
    ),
    paymentStatus: readString(body.paymentStatus ?? body.payment_status) || null,
    donationTotalCents: readNumber(body.donationTotalCents ?? body.donation_total_cents),
  });
}

async function loadGovernanceSettings(
  service: SupabaseServiceClient,
  zoneId: string,
  petition?: Record<string, unknown>,
): Promise<GovernanceSettingsInput> {
  const settings = await service
    .from("zone_governance_settings")
    .select("petition_threshold, vote_duration, quorum_percent, removal_threshold_percent, certification_required")
    .eq("zone_id", zoneId)
    .maybeSingle();
  const normalized = normalizeGovernanceSettings({
    petitionThreshold: Number(
      petition?.support_threshold ?? settings.data?.petition_threshold ?? undefined,
    ),
    quorumPercent: Number(settings.data?.quorum_percent ?? undefined),
    removalThresholdPercent: Number(settings.data?.removal_threshold_percent ?? undefined),
    certificationRequired: settings.data?.certification_required !== false,
    voteDurationSeconds: durationSeconds(settings.data?.vote_duration),
  });
  return normalized;
}

async function readPetition(service: SupabaseServiceClient, zoneId: string, petitionId: string) {
  if (!petitionId) {
    return { ok: false as const, response: problem(400, "petition-required", "petitionId is required.") };
  }
  const { data, error } = await service
    .from("mod_removal_petitions")
    .select("*")
    .eq("zone_id", zoneId)
    .eq("id", petitionId)
    .single();
  if (error !== null) {
    return { ok: false as const, response: problem(404, "petition-not-found", error.message) };
  }
  return { ok: true as const, data };
}

async function readGovernanceVote(service: SupabaseServiceClient, zoneId: string, voteId: string) {
  if (!voteId) {
    return { ok: false as const, response: problem(400, "governance-vote-required", "voteId is required.") };
  }
  const { data, error } = await service
    .from("governance_votes")
    .select("*")
    .eq("zone_id", zoneId)
    .eq("id", voteId)
    .single();
  if (error !== null) {
    return { ok: false as const, response: problem(404, "governance-vote-not-found", error.message) };
  }
  return { ok: true as const, data };
}

async function maybeReadPetitionForVote(
  service: SupabaseServiceClient,
  zoneId: string,
  petitionId: string,
) {
  const { data } = await service
    .from("mod_removal_petitions")
    .select("*")
    .eq("zone_id", zoneId)
    .eq("id", petitionId)
    .maybeSingle();
  return data;
}

async function hasProtectedGlobalRole(service: SupabaseServiceClient, userId: string): Promise<boolean> {
  const bindings = await service
    .from("role_bindings")
    .select("roles(role_key)")
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (bindings.error !== null) {
    return false;
  }
  return (bindings.data ?? []).some((binding) => {
    const role = Array.isArray(binding.roles) ? binding.roles[0] : binding.roles;
    return GLOBAL_OVERRIDE_ROLES.has(String(role?.role_key ?? ""));
  });
}

async function auditGovernance(
  request: Request,
  service: SupabaseServiceClient,
  input: {
    actorId: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    zoneId: string;
    previousState?: unknown;
    newState?: unknown;
    reason: string;
  },
) {
  await insertAuditEvent(service, {
    actor: { id: input.actorId, roleBindings: [] },
    actorRole: input.actorRole,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    zoneId: input.zoneId,
    previousState: input.previousState,
    newState: input.newState,
    reason: input.reason,
    request,
    correlationId: correlationIdFromRequest(request),
  });
}

function readSelectionSource(
  value: unknown,
  action: "moderator_appointment" | "lead_moderator_invitation" | "community_nomination",
): ModeratorSelectionSource {
  const source = readString(value) as ModeratorSelectionSource;
  if (
    source === "founder_appointment" ||
    source === "lead_invitation" ||
    source === "community_nomination" ||
    source === "zone_election" ||
    source === "admin_emergency_appointment"
  ) {
    return source;
  }
  if (action === "lead_moderator_invitation") {
    return "lead_invitation";
  }
  if (action === "community_nomination") {
    return "community_nomination";
  }
  return "lead_invitation";
}

function mapEmergencyAction(action: ZoneGovernanceAction): GovernanceEmergencyOverrideAction {
  switch (action) {
    case "governance_vote_freeze":
      return "freeze_vote";
    case "governance_vote_certify":
      return "certify_vote";
    case "governance_vote_invalidate":
      return "invalidate_vote";
    case "moderator_emergency_suspension":
      return "suspend_moderator";
    case "moderator_restore":
      return "restore_moderator";
    case "zone_ownership_transfer":
      return "transfer_ownership";
    default:
      return "freeze_vote";
  }
}

function ballotHash(voteId: string, userId: string, choice: string): string {
  return createHash("sha256")
    .update(`${process.env.GOVERNANCE_BALLOT_HASH_SECRET ?? "dev"}:${voteId}:${userId}:${choice}`)
    .digest("hex");
}

function readChoice(value: unknown): "yes" | "no" | "abstain" | null {
  const choice = readString(value).toLowerCase();
  return choice === "yes" || choice === "no" || choice === "abstain" ? choice : null;
}

function readNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readSnapshotNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0);
}

function daysSince(value: unknown): number {
  if (typeof value !== "string") {
    return 0;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function readDeviceRisk(value: unknown): number {
  if (typeof value === "object" && value !== null && "score" in value) {
    return readNumber(value.score);
  }
  return 0;
}

function durationSeconds(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const days = value.match(/(\d+)\s+days?/i);
  if (days) {
    return Number(days[1]) * 86_400;
  }
  const hours = value.match(/(\d+)\s+hours?/i);
  if (hours) {
    return Number(hours[1]) * 3_600;
  }
  return undefined;
}

function requestBotStatus(body: Record<string, unknown>): string {
  return readString(body.botIdStatus ?? body.botid_status ?? body.bot_status).toLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
