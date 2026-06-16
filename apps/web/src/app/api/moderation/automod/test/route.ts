import { NextResponse } from "next/server";
import {
  buildAutomodRunRow,
  evaluateAutomodRules,
  parseAutomodRuleSource,
  parseReportTargetType,
  type AutomodFacts,
  type AutomodRuleDefinition,
} from "@ai-oss/moderation";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { isRecord, readRequestBody } from "@/lib/permissions-server";
import { readString } from "@/lib/discussions-server";
import {
  auditModerationEvent,
  requireAutomodManage,
  requireModerationSession,
} from "@/lib/moderation-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }
  const session = await requireModerationSession(request, service.client);
  if (!session.ok) {
    return session.response;
  }
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-automod-test-request", "Expected a JSON object body.");
  }

  const facts = readFacts(body.facts);
  const zoneId = readString(body.zoneId ?? body.zone_id ?? facts.zoneId) || null;
  const access = requireAutomodManage(session.viewer, zoneId);
  if (!access.ok) {
    return access.response;
  }

  let rules: AutomodRuleDefinition[];
  try {
    const inputRules = Array.isArray(body.rules)
      ? body.rules
      : [body.rule ?? body.source ?? body.yaml ?? body.json];
    rules = inputRules.map((rule) => {
      if (typeof rule === "string" || isRecord(rule)) {
        return parseAutomodRuleSource(rule);
      }
      throw new Error("Each AutoMod test rule must be a JSON/YAML string or object.");
    });
  } catch (error) {
    return problem(
      400,
      "invalid-automod-rule",
      error instanceof Error ? error.message : "AutoMod rule is invalid.",
    );
  }

  const result = evaluateAutomodRules(rules, facts);
  let loggedRun = null;
  if (body.logRun === true || body.log_run === true) {
    const targetType = parseReportTargetType(facts.targetType) ?? "post";
    const targetId = readString(facts.targetId) || "00000000-0000-0000-0000-000000000000";
    const row = buildAutomodRunRow({
      zoneId,
      targetType,
      targetId,
      facts,
      result,
    });
    const inserted = await service.client.from("automod_runs").insert(row).select("*").single();
    if (inserted.error !== null) {
      return problem(400, "automod-run-log-failed", inserted.error.message);
    }
    loggedRun = inserted.data;
  }

  await auditModerationEvent({
    client: service.client,
    request,
    viewer: session.viewer,
    action: "moderation.automod_test",
    resourceType: "automod_rule",
    resourceId: rules.map((rule) => rule.id).join(","),
    zoneId,
    newState: { facts, result, loggedRunId: readString(loggedRun?.id) || null },
    reason: "automod dry-run simulator",
    automated: true,
  });

  return NextResponse.json(
    {
      ok: true,
      dryRun: true,
      result,
      loggedRun,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function readFacts(value: unknown): AutomodFacts {
  if (!isRecord(value)) {
    return {};
  }
  return {
    ...value,
    targetType: readString(value.targetType ?? value.target_type),
    targetId: readString(value.targetId ?? value.target_id),
    zoneId: readString(value.zoneId ?? value.zone_id) || null,
    accountAgeDays: readNumber(value.accountAgeDays ?? value.account_age_days),
    emailVerified: readBoolean(value.emailVerified ?? value.email_verified),
    mfaEnabled: readBoolean(value.mfaEnabled ?? value.mfa_enabled),
    zoneReputation: readNumber(value.zoneReputation ?? value.zone_reputation),
    globalReputation: readNumber(value.globalReputation ?? value.global_reputation),
    priorRemovals: readNumber(value.priorRemovals ?? value.prior_removals),
    priorReports: readNumber(value.priorReports ?? value.prior_reports),
    mentionCount: readNumber(value.mentionCount ?? value.mention_count),
    spamSimilarityScore: readNumber(value.spamSimilarityScore ?? value.spam_similarity_score),
    fileSizeBytes: readNumber(value.fileSizeBytes ?? value.file_size_bytes),
    reportCount: readNumber(value.reportCount ?? value.report_count),
    voteVelocity: readNumber(value.voteVelocity ?? value.vote_velocity),
    toxicityAbuseClassifierScore: readNumber(
      value.toxicityAbuseClassifierScore ?? value.toxicity_abuse_classifier_score,
    ),
    safetyClassifierScore: readNumber(value.safetyClassifierScore ?? value.safety_classifier_score),
    chatMessageFrequencyPerMinute: readNumber(
      value.chatMessageFrequencyPerMinute ?? value.chat_message_frequency_per_minute,
    ),
    voiceRoomJoinFrequencyPerMinute: readNumber(
      value.voiceRoomJoinFrequencyPerMinute ?? value.voice_room_join_frequency_per_minute,
    ),
    governanceVoteAnomalyScore: readNumber(
      value.governanceVoteAnomalyScore ?? value.governance_vote_anomaly_score,
    ),
  };
}

function readNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}
