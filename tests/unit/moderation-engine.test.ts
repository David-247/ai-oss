import { describe, expect, it } from "vitest";
import {
  AUTOMOD_ACTION_TYPES,
  AUTOMOD_CONDITION_KEYS,
  MODERATION_RULE_LAYERS,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  buildAppealDecisionPatch,
  buildAppealInsertRow,
  buildAutomodRunRow,
  buildModerationActionRow,
  buildReportInsertRow,
  evaluateAutomodRules,
  parseAutomodRuleSource,
  prioritizeModerationQueue,
} from "@ai-oss/moderation";

describe("Phase 13 AutoMod and moderation engine", () => {
  it("exposes every required rule layer, condition, action, report target, and reason", () => {
    expect(MODERATION_RULE_LAYERS).toEqual([
      "platform_global",
      "research_archive",
      "zone",
      "chat_voice",
    ]);
    expect(AUTOMOD_CONDITION_KEYS).toEqual([
      "account_age",
      "email_verified",
      "mfa_enabled",
      "zone_reputation",
      "global_reputation",
      "prior_removals",
      "prior_reports",
      "new_user",
      "contains_link",
      "domain_allow_list",
      "domain_block_list",
      "regex",
      "keyword_list",
      "language_detection",
      "mention_count",
      "duplicate_content_hash",
      "similarity_to_known_spam",
      "file_type",
      "file_size",
      "missing_flair_tags",
      "research_metadata_missing",
      "report_count",
      "vote_velocity",
      "toxicity_abuse_classifier_score",
      "safety_classifier_score",
      "external_url_reputation",
      "chat_message_frequency",
      "voice_room_join_frequency",
      "governance_vote_anomaly_score",
    ]);
    expect(AUTOMOD_ACTION_TYPES).toContain("require_manual_certification");
    expect(REPORT_TARGET_TYPES).toContain("moderator_action");
    expect(REPORT_REASONS).toContain("dangerous_dual_use");
  });

  it("parses YAML rules and evaluates layered conditions", () => {
    const rule = parseAutomodRuleSource(`
id: new-user-link-review
name: New user link review
enabled: true
scope:
  - zone
severity: high
appealable: true
conditions:
  account_age: { max_days: 7 }
  contains_link: true
  domain_block_list: ["spam.example"]
actions:
  - type: filter_to_queue
  - type: notify_moderators
`);

    const result = evaluateAutomodRules([rule], {
      accountAgeDays: 2,
      text: "look at https://spam.example/model",
      links: ["https://spam.example/model"],
    });

    expect(result.matched).toBe(true);
    expect(result.severity).toBe("high");
    expect(result.finalAction.type).toBe("filter_to_queue");
    expect(result.matchedRules[0]?.matchedConditions).toEqual([
      "account_age",
      "contains_link",
      "domain_block_list",
    ]);
  });

  it("prevents lower layers from weakening matched global enforcement", () => {
    const global = parseAutomodRuleSource({
      id: "global-malware",
      name: "Global malware block",
      enabled: true,
      scope: ["platform_global"],
      severity: "critical",
      appealable: false,
      conditions: { keyword_list: ["malware"] },
      actions: [{ type: "remove" }, { type: "escalate_trust_safety" }],
    });
    const zoneAllow = parseAutomodRuleSource({
      id: "zone-allow",
      name: "Zone allow rule",
      enabled: true,
      scope: ["zone"],
      severity: "low",
      appealable: true,
      conditions: { keyword_list: ["malware"] },
      actions: ["allow"],
    });

    const result = evaluateAutomodRules([zoneAllow, global], {
      text: "malware download mirror",
    });

    expect(result.globalRuleMatched).toBe(true);
    expect(result.finalAction.type).toBe("escalate_trust_safety");
    expect(result.blockedWeakeningActions).toEqual([{ type: "allow" }]);
  });

  it("builds report, action, run, and appeal rows with audit-ready fields", () => {
    const report = buildReportInsertRow({
      reporterId: "00000000-0000-4000-8000-000000000001",
      targetType: "profile",
      targetId: "00000000-0000-4000-8000-000000000002",
      reason: "child_safety",
      details: "Urgent report",
    });
    expect(report.target_type).toBe("user_profile");
    expect(report.severity).toBe("critical");

    const action = buildModerationActionRow({
      actorId: "00000000-0000-4000-8000-000000000003",
      targetType: "post",
      targetId: "00000000-0000-4000-8000-000000000004",
      action: "remove",
      reason: "Policy violation",
      correlationId: "corr-1",
    });
    expect(action.action_type).toBe("remove");
    expect(action.statement_of_reasons).toMatchObject({ appealable: true });

    const appeal = buildAppealInsertRow({
      moderationActionId: "00000000-0000-4000-8000-000000000005",
      appellantId: "00000000-0000-4000-8000-000000000006",
      appealText: "This removal was made in error.",
      evidence: { url: "https://example.com/evidence" },
      originalAction: action,
      now: new Date("2026-06-12T00:00:00.000Z"),
    });
    expect(appeal.audit_trail[0]).toMatchObject({ event: "created" });

    const decision = buildAppealDecisionPatch({
      reviewerId: "00000000-0000-4000-8000-000000000007",
      status: "accepted",
      decisionReason: "Context verified",
      previousAuditTrail: appeal.audit_trail,
      now: new Date("2026-06-12T01:00:00.000Z"),
    });
    expect(decision.audit_trail).toHaveLength(2);

    const run = buildAutomodRunRow({
      targetType: "post",
      targetId: "00000000-0000-4000-8000-000000000008",
      result: evaluateAutomodRules([], {}),
    });
    expect(run.status).toBe("not_matched");
    expect(run.details).toHaveProperty("result");
  });

  it("prioritizes critical queue entries before lower-severity items", () => {
    const low = {
      id: "low",
      source: "report" as const,
      targetType: "post",
      targetId: "post-1",
      zoneId: null,
      severity: "low" as const,
      priorityScore: 100,
      reason: "spam",
      status: "open",
      createdAt: "2026-06-12T00:00:00.000Z",
      payload: {},
      appealable: true,
    };
    const critical = { ...low, id: "critical", severity: "critical" as const, priorityScore: 400 };
    expect(prioritizeModerationQueue([low, critical])[0]?.id).toBe("critical");
  });
});
