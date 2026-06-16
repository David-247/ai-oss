export const PACKAGE_NAME = "@ai-oss/moderation" as const;

export const MODERATION_RULE_LAYERS = [
  "platform_global",
  "research_archive",
  "zone",
  "chat_voice",
] as const;

export type ModerationRuleLayer = (typeof MODERATION_RULE_LAYERS)[number];

export const MODERATION_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type ModerationSeverity = (typeof MODERATION_SEVERITIES)[number];

export const AUTOMOD_CONDITION_KEYS = [
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
] as const;

export type AutomodConditionKey = (typeof AUTOMOD_CONDITION_KEYS)[number];

export const AUTOMOD_ACTION_TYPES = [
  "allow",
  "filter_to_queue",
  "remove",
  "lock",
  "flair_tag",
  "add_warning",
  "notify_moderators",
  "notify_author",
  "require_edit",
  "slow_mode",
  "temporary_mute",
  "temporary_ban",
  "escalate_trust_safety",
  "escalate_legal",
  "quarantine_paper_file",
  "hide_score",
  "freeze_vote_count",
  "require_manual_certification",
] as const;

export type AutomodActionType = (typeof AUTOMOD_ACTION_TYPES)[number];

export const REPORT_TARGET_TYPES = [
  "post",
  "comment",
  "chat_message",
  "voice_participant",
  "voice_room",
  "paper",
  "paper_file",
  "paper_review",
  "replication_report",
  "user_profile",
  "zone",
  "moderator_action",
] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate_illegal_content",
  "malware",
  "copyright_infringement",
  "privacy_doxxing",
  "impersonation",
  "research_fraud",
  "safety_concern",
  "dangerous_dual_use",
  "child_safety",
  "terrorism_extremism",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "triaged", "actioned", "dismissed", "duplicate"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const APPEAL_STATUSES = ["open", "accepted", "rejected", "closed"] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export const AUTOMOD_RULE_STATUSES = [
  "draft",
  "valid",
  "dry_run",
  "published",
  "disabled",
  "archived",
] as const;
export type AutomodRuleStatus = (typeof AUTOMOD_RULE_STATUSES)[number];

export interface AutomodAction {
  type: AutomodActionType;
  reason?: string;
  durationSeconds?: number;
  value?: string;
  metadata?: Record<string, unknown>;
}

export type AutomodConditions = Partial<Record<AutomodConditionKey, unknown>>;

export interface AutomodRuleDefinition {
  id: string;
  name: string;
  enabled: boolean;
  scope: ModerationRuleLayer[];
  conditions: AutomodConditions;
  actions: AutomodAction[];
  severity: ModerationSeverity;
  appealable: boolean;
  description?: string;
  version?: number;
}

export interface AutomodFacts {
  targetType?: ReportTargetType | string;
  targetId?: string;
  zoneId?: string | null;
  text?: string;
  title?: string;
  url?: string | null;
  links?: readonly string[];
  domains?: readonly string[];
  allowedDomains?: readonly string[];
  blockedDomains?: readonly string[];
  language?: string | null;
  accountAgeDays?: number;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  zoneReputation?: number;
  globalReputation?: number;
  priorRemovals?: number;
  priorReports?: number;
  newUser?: boolean;
  mentionCount?: number;
  contentHash?: string | null;
  duplicateContentHash?: boolean;
  knownDuplicateHashes?: readonly string[];
  spamSimilarityScore?: number;
  fileType?: string | null;
  fileSizeBytes?: number;
  flair?: string | null;
  tags?: readonly string[];
  requiredTags?: readonly string[];
  missingResearchMetadata?: readonly string[];
  metadata?: Record<string, unknown>;
  reportCount?: number;
  voteVelocity?: number;
  toxicityAbuseClassifierScore?: number;
  safetyClassifierScore?: number;
  externalUrlReputation?: number | "unknown" | "trusted" | "suspicious" | "malicious";
  chatMessageFrequencyPerMinute?: number;
  voiceRoomJoinFrequencyPerMinute?: number;
  governanceVoteAnomalyScore?: number;
  now?: Date;
}

export interface AutomodRuleValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rule?: AutomodRuleDefinition;
}

export interface AutomodRuleEvaluation {
  rule: AutomodRuleDefinition;
  matched: boolean;
  matchedConditions: AutomodConditionKey[];
  failedConditions: AutomodConditionKey[];
  actions: AutomodAction[];
  severity: ModerationSeverity;
  score: number;
  layer: ModerationRuleLayer;
  appealable: boolean;
}

export interface AutomodEvaluationResult {
  matched: boolean;
  matchedRules: AutomodRuleEvaluation[];
  actions: AutomodAction[];
  finalAction: AutomodAction;
  severity: ModerationSeverity;
  score: number;
  globalRuleMatched: boolean;
  blockedWeakeningActions: AutomodAction[];
}

export interface ModerationQueueItem {
  id: string;
  source: "report" | "automod_run" | "appeal" | "moderation_action";
  targetType: string;
  targetId: string;
  zoneId: string | null;
  severity: ModerationSeverity;
  priorityScore: number;
  reason: string;
  status: string;
  createdAt: string;
  payload: Record<string, unknown>;
  appealable: boolean;
}

const SEVERITY_SCORE = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const satisfies Record<ModerationSeverity, number>;

const ACTION_PRIORITY = {
  allow: 0,
  add_warning: 10,
  notify_author: 10,
  notify_moderators: 12,
  flair_tag: 15,
  filter_to_queue: 20,
  require_edit: 24,
  hide_score: 25,
  slow_mode: 30,
  freeze_vote_count: 34,
  lock: 36,
  require_manual_certification: 38,
  temporary_mute: 40,
  quarantine_paper_file: 45,
  remove: 50,
  temporary_ban: 55,
  escalate_trust_safety: 60,
  escalate_legal: 65,
} as const satisfies Record<AutomodActionType, number>;

const NON_APPEALABLE_DEFAULT_ACTIONS = new Set<AutomodActionType>([
  "escalate_legal",
  "escalate_trust_safety",
]);

const REPORT_TARGET_ALIASES: Record<string, ReportTargetType> = {
  profile: "user_profile",
  user: "user_profile",
  review: "paper_review",
  replication: "replication_report",
  file: "paper_file",
  moderation_action: "moderator_action",
};

const REPORT_REASON_ALIASES: Record<string, ReportReason> = {
  hate: "hate_illegal_content",
  illegal: "hate_illegal_content",
  copyright: "copyright_infringement",
  privacy: "privacy_doxxing",
  doxxing: "privacy_doxxing",
  safety: "safety_concern",
  dual_use: "dangerous_dual_use",
  terrorism: "terrorism_extremism",
  child_abuse: "child_safety",
};

const ACTION_ALIASES: Record<string, AutomodActionType> = {
  filter: "filter_to_queue",
  queue: "filter_to_queue",
  flair: "flair_tag",
  tag: "flair_tag",
  warning: "add_warning",
  notify_mods: "notify_moderators",
  notify_user: "notify_author",
  mute: "temporary_mute",
  ban: "temporary_ban",
  escalate_ts: "escalate_trust_safety",
  escalate_t_and_s: "escalate_trust_safety",
  quarantine: "quarantine_paper_file",
  manual_certification: "require_manual_certification",
};

const LAYER_ALIASES: Record<string, ModerationRuleLayer> = {
  global: "platform_global",
  platform: "platform_global",
  research: "research_archive",
  archive: "research_archive",
  community: "zone",
  chat: "chat_voice",
  voice: "chat_voice",
  realtime: "chat_voice",
};

export function parseAutomodRuleSource(
  source: string | Record<string, unknown>,
): AutomodRuleDefinition {
  const value = typeof source === "string" ? parseRuleText(source) : source;
  const validation = validateAutomodRule(value);
  if (!validation.valid || validation.rule === undefined) {
    throw new Error(`AutoMod rule is invalid: ${validation.errors.join(", ")}`);
  }
  return validation.rule;
}

export function validateAutomodRule(input: unknown): AutomodRuleValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ["rule_must_be_object"], warnings };
  }

  const id = normalizeKey(readString(input.id ?? input.rule_key ?? input.key));
  const name = readString(input.name);
  const enabled = input.enabled === undefined ? true : readBoolean(input.enabled);
  const scope = readRuleLayers(input.scope ?? input.scopes ?? input.rule_type);
  const conditions = readConditions(input.conditions ?? input.config);
  const actions = readActions(input.actions ?? input.action);
  const severity = parseSeverity(input.severity);
  const appealable = input.appealable === undefined ? true : readBoolean(input.appealable);
  const version = readPositiveInteger(input.version);
  const description = readString(input.description);

  if (!id) {
    errors.push("id_required");
  }
  if (name.length < 3 || name.length > 160) {
    errors.push("name_length_invalid");
  }
  if (enabled === undefined) {
    errors.push("enabled_must_be_boolean");
  }
  if (scope.length === 0) {
    errors.push("scope_required");
  }
  if (Object.keys(conditions).length === 0) {
    errors.push("conditions_required");
  }
  if (actions.length === 0) {
    errors.push("actions_required");
  }
  if (appealable === undefined) {
    errors.push("appealable_must_be_boolean");
  }
  const invalidConditionKeys = Object.keys(conditions).filter(
    (key) => !AUTOMOD_CONDITION_KEYS.includes(key as AutomodConditionKey),
  );
  if (invalidConditionKeys.length > 0) {
    errors.push(`unknown_conditions:${invalidConditionKeys.join("|")}`);
  }
  if (actions.some((action) => action.type === "allow") && actions.length > 1) {
    warnings.push("allow_action_ignored_when_combined_with_enforcement_actions");
  }
  if (scope.includes("platform_global") && actions.some((action) => action.type === "allow")) {
    warnings.push("global_allow_rules_do_not_weaken_lower_layer_enforcement");
  }

  if (errors.length > 0 || enabled === undefined || appealable === undefined) {
    return { valid: false, errors, warnings };
  }

  return {
    valid: true,
    errors,
    warnings,
    rule: {
      id,
      name,
      enabled,
      scope,
      conditions,
      actions,
      severity,
      appealable,
      ...(description ? { description } : {}),
      ...(version ? { version } : {}),
    },
  };
}

export function evaluateAutomodRule(
  rule: AutomodRuleDefinition,
  facts: AutomodFacts,
): AutomodRuleEvaluation {
  const matchedConditions: AutomodConditionKey[] = [];
  const failedConditions: AutomodConditionKey[] = [];
  const entries = Object.entries(rule.conditions) as [AutomodConditionKey, unknown][];

  for (const [key, config] of entries) {
    if (conditionMatches(key, config, facts)) {
      matchedConditions.push(key);
    } else {
      failedConditions.push(key);
    }
  }

  const matched = rule.enabled && entries.length > 0 && failedConditions.length === 0;
  return {
    rule,
    matched,
    matchedConditions,
    failedConditions,
    actions: matched ? enforcementActions(rule.actions) : [],
    severity: rule.severity,
    score: matched ? ruleScore(rule, matchedConditions.length) : 0,
    layer: rule.scope[0] ?? "zone",
    appealable: rule.appealable && rule.actions.every((action) => isActionAppealable(action, rule)),
  };
}

export function evaluateAutomodRules(
  rules: readonly AutomodRuleDefinition[],
  facts: AutomodFacts,
): AutomodEvaluationResult {
  const evaluations = [...rules]
    .sort(ruleLayerSort)
    .map((rule) => evaluateAutomodRule(rule, facts));
  const matchedRules = evaluations.filter((evaluation) => evaluation.matched);
  const globalRuleMatched = matchedRules.some(
    (evaluation) =>
      evaluation.rule.scope.includes("platform_global") && evaluation.actions.length > 0,
  );
  const blockedWeakeningActions = globalRuleMatched
    ? matchedRules
        .filter((evaluation) => !evaluation.rule.scope.includes("platform_global"))
        .flatMap((evaluation) => evaluation.rule.actions)
        .filter((action) => action.type === "allow")
    : [];
  const actions = matchedRules.flatMap((evaluation) => evaluation.actions);
  const finalAction = selectHighestPriorityAction(actions);
  const severity = selectHighestSeverity(matchedRules.map((evaluation) => evaluation.severity));

  return {
    matched: matchedRules.length > 0,
    matchedRules,
    actions,
    finalAction,
    severity,
    score: matchedRules.reduce((total, evaluation) => total + evaluation.score, 0),
    globalRuleMatched,
    blockedWeakeningActions,
  };
}

export function buildAutomodRuleInsertRow(input: {
  rule: AutomodRuleDefinition;
  zoneId?: string | null;
  createdBy?: string | null;
  source?: string | null;
  status?: AutomodRuleStatus;
  now?: Date;
}) {
  const primaryAction = selectHighestPriorityAction(input.rule.actions);
  const now = input.now ?? new Date();
  const status = input.status ?? "draft";
  return {
    zone_id: input.zoneId ?? null,
    name: input.rule.name,
    rule_type: input.rule.scope[0] ?? "zone",
    config: input.rule,
    action: primaryAction.type,
    enabled: input.rule.enabled && status !== "disabled" && status !== "archived",
    severity: input.rule.severity,
    created_by: input.createdBy ?? null,
    rule_key: input.rule.id,
    description: input.rule.description ?? null,
    yaml: input.source ?? JSON.stringify(input.rule, null, 2),
    version: input.rule.version ?? 1,
    status,
    published_at: status === "published" ? now.toISOString() : null,
    last_validated_at: now.toISOString(),
  };
}

export function buildAutomodRuleUpdatePatch(input: {
  rule: AutomodRuleDefinition;
  source?: string | null;
  status?: AutomodRuleStatus;
  now?: Date;
}) {
  const row = buildAutomodRuleInsertRow({
    rule: input.rule,
    source: input.source,
    status: input.status ?? "draft",
    now: input.now,
  });
  const patch: Record<string, unknown> = { ...row };
  delete patch.zone_id;
  delete patch.created_by;
  return patch;
}

export function buildAutomodRuleLifecyclePatch(input: {
  action: "publish" | "dry_run" | "disable" | "rollback" | "archive";
  version?: number;
  rollbackOf?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.action === "publish") {
    return {
      enabled: true,
      status: "published" satisfies AutomodRuleStatus,
      published_at: now.toISOString(),
      ...(input.version ? { version: input.version } : {}),
    };
  }
  if (input.action === "dry_run") {
    return { enabled: true, status: "dry_run" satisfies AutomodRuleStatus };
  }
  if (input.action === "disable") {
    return { enabled: false, status: "disabled" satisfies AutomodRuleStatus };
  }
  if (input.action === "archive") {
    return { enabled: false, status: "archived" satisfies AutomodRuleStatus };
  }
  return {
    enabled: false,
    status: "draft" satisfies AutomodRuleStatus,
    published_at: null,
    rollback_of: input.rollbackOf ?? null,
    ...(input.version ? { version: input.version } : {}),
  };
}

export function normalizeStoredAutomodRule(row: Record<string, unknown>): AutomodRuleDefinition {
  if (isRecord(row.config)) {
    const validation = validateAutomodRule(row.config);
    if (validation.valid && validation.rule !== undefined) {
      return validation.rule;
    }
  }
  const yaml = readString(row.yaml);
  if (yaml) {
    return parseAutomodRuleSource(yaml);
  }
  return parseAutomodRuleSource({
    id: row.rule_key ?? row.id,
    name: row.name,
    enabled: row.enabled,
    scope: row.rule_type,
    conditions: row.config,
    actions: [row.action],
    severity: row.severity,
    appealable: row.appealable,
    version: row.version,
  });
}

export function buildAutomodRunRow(input: {
  ruleId?: string | null;
  zoneId?: string | null;
  targetType: ReportTargetType | string;
  targetId: string;
  facts?: AutomodFacts;
  result: AutomodEvaluationResult | AutomodRuleEvaluation;
  error?: string | null;
}) {
  const errored = Boolean(input.error);
  const matched = "matchedRules" in input.result ? input.result.matched : input.result.matched;
  const action =
    "finalAction" in input.result
      ? input.result.finalAction.type
      : selectHighestPriorityAction(input.result.actions).type;
  const score = "score" in input.result ? input.result.score : 0;
  const result = serializeResult(input.result);
  return {
    rule_id: input.ruleId ?? null,
    zone_id: input.zoneId ?? null,
    target_type: input.targetType,
    target_id: input.targetId,
    status: errored ? "errored" : matched ? "matched" : "not_matched",
    action_taken: matched ? action : null,
    score,
    details: {
      error: input.error ?? null,
      input_snapshot: input.facts ?? {},
      result,
    },
    input_snapshot: input.facts ?? {},
    result,
  };
}

export function buildReportInsertRow(input: {
  reporterId: string;
  targetType: unknown;
  targetId: string;
  zoneId?: string | null;
  reason: unknown;
  details?: string | null;
  severity?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const targetType = parseReportTargetType(input.targetType);
  const reason = parseReportReason(input.reason);
  const targetId = readString(input.targetId);
  if (!targetType) {
    throw new Error("Report target type is invalid.");
  }
  if (!reason) {
    throw new Error("Report reason is invalid.");
  }
  if (!targetId) {
    throw new Error("Report target id is required.");
  }
  const severity = parseSeverity(input.severity ?? severityForReportReason(reason));
  return {
    reporter_id: input.reporterId,
    target_type: targetType,
    target_id: targetId,
    zone_id: normalizeNullable(input.zoneId),
    reason,
    details: normalizeNullable(input.details),
    status: "open" satisfies ReportStatus,
    severity,
    source: "user_report",
    metadata: input.metadata ?? {},
  };
}

export function buildModerationActionRow(input: {
  actorId?: string | null;
  targetType: unknown;
  targetId: string;
  zoneId?: string | null;
  action: unknown;
  reason: string;
  previousState?: unknown;
  newState?: unknown;
  expiresAt?: string | null;
  automated?: boolean;
  correlationId?: string | null;
  appealable?: boolean;
}) {
  const action = parseAutomodActionType(input.action);
  const targetType = parseReportTargetType(input.targetType) ?? readString(input.targetType);
  if (!action) {
    throw new Error("Moderation action is invalid.");
  }
  if (!targetType || !readString(input.targetId)) {
    throw new Error("Moderation target is required.");
  }
  const reason = readString(input.reason);
  if (reason.length < 3) {
    throw new Error("Moderation action reason is required.");
  }
  const appealable = input.appealable ?? !NON_APPEALABLE_DEFAULT_ACTIONS.has(action);
  return {
    actor_id: input.actorId ?? null,
    target_type: targetType,
    target_id: input.targetId,
    zone_id: normalizeNullable(input.zoneId),
    action_type: action,
    reason,
    previous_state: input.previousState ?? null,
    new_state: {
      ...(isRecord(input.newState) ? input.newState : { value: input.newState ?? null }),
      appealable,
      statement_of_reasons_ready: true,
    },
    expires_at: normalizeNullable(input.expiresAt),
    automated: input.automated === true,
    correlation_id: normalizeNullable(input.correlationId),
    appealable,
    statement_of_reasons: {
      reason,
      action,
      target_type: targetType,
      appealable,
    },
  };
}

export function buildAppealInsertRow(input: {
  moderationActionId: string;
  appellantId: string;
  appealText: string;
  evidence?: Record<string, unknown>;
  originalAction?: Record<string, unknown> | null;
  now?: Date;
}) {
  const body = readString(input.appealText);
  if (!readString(input.moderationActionId) || !readString(input.appellantId)) {
    throw new Error("Appeal action and appellant are required.");
  }
  if (body.length < 10) {
    throw new Error("Appeal text must explain the request.");
  }
  const now = input.now ?? new Date();
  return {
    moderation_action_id: input.moderationActionId,
    appellant_id: input.appellantId,
    body,
    evidence: input.evidence ?? {},
    status: "open" satisfies AppealStatus,
    audit_trail: [
      {
        event: "created",
        actor_id: input.appellantId,
        at: now.toISOString(),
        original_action: input.originalAction ?? null,
      },
    ],
  };
}

export function buildAppealDecisionPatch(input: {
  reviewerId: string;
  status: unknown;
  decisionReason: string;
  previousAuditTrail?: unknown;
  now?: Date;
}) {
  const status = parseAppealStatus(input.status);
  if (status !== "accepted" && status !== "rejected" && status !== "closed") {
    throw new Error("Appeal decision must be accepted, rejected, or closed.");
  }
  const decisionReason = readString(input.decisionReason);
  if (decisionReason.length < 3) {
    throw new Error("Appeal decision reason is required.");
  }
  const now = input.now ?? new Date();
  return {
    status,
    reviewed_by: input.reviewerId,
    reviewed_at: now.toISOString(),
    decision: status,
    decision_reason: decisionReason,
    audit_trail: [
      ...readAuditTrail(input.previousAuditTrail),
      {
        event: "decided",
        actor_id: input.reviewerId,
        status,
        reason: decisionReason,
        at: now.toISOString(),
      },
    ],
  };
}

export function isModerationActionAppealable(action: Record<string, unknown>): boolean {
  if (action.appealable === false) {
    return false;
  }
  if (isRecord(action.new_state) && action.new_state.appealable === false) {
    return false;
  }
  const actionType = parseAutomodActionType(action.action_type ?? action.action);
  return actionType === null || !NON_APPEALABLE_DEFAULT_ACTIONS.has(actionType);
}

export function buildQueueItemFromReport(report: Record<string, unknown>): ModerationQueueItem {
  const severity = parseSeverity(report.severity);
  const createdAt = readString(report.created_at) || new Date().toISOString();
  const reason = readString(report.reason) || "other";
  return {
    id:
      readString(report.id) || `${readString(report.target_type)}:${readString(report.target_id)}`,
    source: "report",
    targetType: readString(report.target_type),
    targetId: readString(report.target_id),
    zoneId: normalizeNullable(report.zone_id),
    severity,
    priorityScore: queuePriorityScore(severity, createdAt, report.reason),
    reason,
    status: readString(report.status) || "open",
    createdAt,
    payload: report,
    appealable: true,
  };
}

export function buildQueueItemFromAutomodRun(run: Record<string, unknown>): ModerationQueueItem {
  const result = isRecord(run.result)
    ? run.result
    : isRecord(run.details) && isRecord(run.details.result)
      ? run.details.result
      : {};
  const severity = parseSeverity(result.severity);
  const createdAt = readString(run.created_at) || new Date().toISOString();
  const finalAction = isRecord(result.finalAction) ? readString(result.finalAction.type) : "";
  return {
    id: readString(run.id) || `${readString(run.target_type)}:${readString(run.target_id)}`,
    source: "automod_run",
    targetType: readString(run.target_type),
    targetId: readString(run.target_id),
    zoneId: normalizeNullable(run.zone_id ?? (isRecord(run.details) ? run.details.zone_id : null)),
    severity,
    priorityScore: queuePriorityScore(severity, createdAt, finalAction),
    reason: finalAction || readString(run.status) || "automod",
    status: readString(run.status) || "matched",
    createdAt,
    payload: run,
    appealable: result.appealable !== false,
  };
}

export function buildQueueItemFromAppeal(appeal: Record<string, unknown>): ModerationQueueItem {
  const action = isRecord(appeal.moderation_actions) ? appeal.moderation_actions : {};
  const createdAt = readString(appeal.created_at) || new Date().toISOString();
  return {
    id: readString(appeal.id),
    source: "appeal",
    targetType: readString(action.target_type) || "moderator_action",
    targetId: readString(action.target_id) || readString(appeal.moderation_action_id),
    zoneId: normalizeNullable(action.zone_id),
    severity: "medium",
    priorityScore: queuePriorityScore("medium", createdAt, "appeal"),
    reason: "appeal",
    status: readString(appeal.status) || "open",
    createdAt,
    payload: appeal,
    appealable: false,
  };
}

export function prioritizeModerationQueue<TItem extends ModerationQueueItem>(
  items: readonly TItem[],
): TItem[] {
  return [...items].sort((left, right) => {
    const scoreDelta = right.priorityScore - left.priorityScore;
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

export function parseReportTargetType(value: unknown): ReportTargetType | null {
  const key = normalizeKey(readString(value));
  if (!key) {
    return null;
  }
  const aliased = REPORT_TARGET_ALIASES[key];
  if (aliased !== undefined) {
    return aliased;
  }
  return REPORT_TARGET_TYPES.includes(key as ReportTargetType) ? (key as ReportTargetType) : null;
}

export function parseReportReason(value: unknown): ReportReason | null {
  const key = normalizeKey(readString(value));
  if (!key) {
    return null;
  }
  const aliased = REPORT_REASON_ALIASES[key];
  if (aliased !== undefined) {
    return aliased;
  }
  return REPORT_REASONS.includes(key as ReportReason) ? (key as ReportReason) : null;
}

export function parseAutomodActionType(value: unknown): AutomodActionType | null {
  const key = normalizeKey(readString(value));
  if (!key) {
    return null;
  }
  const aliased = ACTION_ALIASES[key];
  if (aliased !== undefined) {
    return aliased;
  }
  return AUTOMOD_ACTION_TYPES.includes(key as AutomodActionType)
    ? (key as AutomodActionType)
    : null;
}

export function parseAppealStatus(value: unknown): AppealStatus | null {
  const key = normalizeKey(readString(value));
  return APPEAL_STATUSES.includes(key as AppealStatus) ? (key as AppealStatus) : null;
}

export function parseSeverity(value: unknown): ModerationSeverity {
  const key = normalizeKey(readString(value));
  return MODERATION_SEVERITIES.includes(key as ModerationSeverity)
    ? (key as ModerationSeverity)
    : "medium";
}

function conditionMatches(key: AutomodConditionKey, config: unknown, facts: AutomodFacts): boolean {
  switch (key) {
    case "account_age":
      return compareNumber(facts.accountAgeDays, config, {
        maxAlias: "max_days",
        minAlias: "min_days",
      });
    case "email_verified":
      return compareBoolean(facts.emailVerified, config);
    case "mfa_enabled":
      return compareBoolean(facts.mfaEnabled, config);
    case "zone_reputation":
      return compareNumber(facts.zoneReputation, config);
    case "global_reputation":
      return compareNumber(facts.globalReputation, config);
    case "prior_removals":
      return compareNumber(facts.priorRemovals, config);
    case "prior_reports":
      return compareNumber(facts.priorReports, config);
    case "new_user":
      return compareBoolean(
        facts.newUser ?? (facts.accountAgeDays !== undefined && facts.accountAgeDays < 7),
        config,
      );
    case "contains_link":
      return compareBoolean(extractLinks(facts).length > 0, config);
    case "domain_allow_list":
      return domainAllowListMatches(config, facts);
    case "domain_block_list":
      return domainBlockListMatches(config, facts);
    case "regex":
      return regexMatches(config, fullText(facts));
    case "keyword_list":
      return keywordMatches(config, fullText(facts));
    case "language_detection":
      return languageMatches(config, facts.language);
    case "mention_count":
      return compareNumber(facts.mentionCount ?? countMentions(fullText(facts)), config);
    case "duplicate_content_hash":
      return duplicateHashMatches(config, facts);
    case "similarity_to_known_spam":
      return compareNumber(facts.spamSimilarityScore, config);
    case "file_type":
      return fileTypeMatches(config, facts.fileType);
    case "file_size":
      return compareNumber(facts.fileSizeBytes, config, {
        maxAlias: "max_bytes",
        minAlias: "min_bytes",
      });
    case "missing_flair_tags":
      return missingFlairTagsMatches(config, facts);
    case "research_metadata_missing":
      return researchMetadataMissingMatches(config, facts);
    case "report_count":
      return compareNumber(facts.reportCount, config);
    case "vote_velocity":
      return compareNumber(facts.voteVelocity, config);
    case "toxicity_abuse_classifier_score":
      return compareNumber(facts.toxicityAbuseClassifierScore, config);
    case "safety_classifier_score":
      return compareNumber(facts.safetyClassifierScore, config);
    case "external_url_reputation":
      return externalUrlReputationMatches(config, facts.externalUrlReputation);
    case "chat_message_frequency":
      return compareNumber(facts.chatMessageFrequencyPerMinute, config, {
        maxAlias: "max_per_minute",
        minAlias: "min_per_minute",
      });
    case "voice_room_join_frequency":
      return compareNumber(facts.voiceRoomJoinFrequencyPerMinute, config, {
        maxAlias: "max_per_minute",
        minAlias: "min_per_minute",
      });
    case "governance_vote_anomaly_score":
      return compareNumber(facts.governanceVoteAnomalyScore, config);
  }
}

function readConditions(value: unknown): AutomodConditions {
  if (!isRecord(value)) {
    return {};
  }
  const output: Record<string, unknown> = {};
  for (const [key, conditionValue] of Object.entries(value)) {
    output[normalizeKey(key)] = conditionValue;
  }
  return output as AutomodConditions;
}

function readActions(value: unknown): AutomodAction[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return items.flatMap((item) => {
    if (typeof item === "string") {
      const type = parseAutomodActionType(item);
      return type === null ? [] : [{ type }];
    }
    if (!isRecord(item)) {
      return [];
    }
    const type = parseAutomodActionType(item.type ?? item.action);
    if (type === null) {
      return [];
    }
    const durationSeconds = readPositiveInteger(item.durationSeconds ?? item.duration_seconds);
    const reason = readString(item.reason);
    const value = readString(item.value ?? item.flair ?? item.tag);
    return [
      {
        type,
        ...(reason ? { reason } : {}),
        ...(durationSeconds ? { durationSeconds } : {}),
        ...(value ? { value } : {}),
        ...(isRecord(item.metadata) ? { metadata: item.metadata } : {}),
      },
    ];
  });
}

function readRuleLayers(value: unknown): ModerationRuleLayer[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return Array.from(
    new Set(
      values.flatMap((item) => {
        const key = normalizeKey(readString(item));
        const aliased = LAYER_ALIASES[key];
        if (aliased !== undefined) {
          return [aliased];
        }
        return MODERATION_RULE_LAYERS.includes(key as ModerationRuleLayer)
          ? [key as ModerationRuleLayer]
          : [];
      }),
    ),
  );
}

function parseRuleText(source: string): Record<string, unknown> {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error("AutoMod rule source is empty.");
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("AutoMod JSON rule must be an object.");
    }
    return parsed;
  }
  return parseSimpleYamlObject(trimmed);
}

function parseSimpleYamlObject(source: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let section: string | null = null;
  let currentAction: Record<string, unknown> | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, "");
    if (!withoutComment.trim()) {
      continue;
    }
    const indent = withoutComment.match(/^ */)?.[0].length ?? 0;
    const line = withoutComment.trim();

    if (indent === 0) {
      const [key, value] = splitYamlPair(line);
      const normalizedKey = normalizeKey(key);
      currentAction = null;
      if (value === null) {
        section = normalizedKey;
        if (section === "scope" || section === "actions") {
          root[section] = [];
        } else {
          root[section] = {};
        }
      } else {
        root[normalizedKey] = parseYamlScalar(value);
        section = null;
      }
      continue;
    }

    if (section === "scope" && line.startsWith("-")) {
      const list = Array.isArray(root.scope) ? root.scope : [];
      list.push(parseYamlScalar(line.slice(1).trim()));
      root.scope = list;
      continue;
    }

    if (section === "actions") {
      const actions = Array.isArray(root.actions) ? root.actions : [];
      if (line.startsWith("-")) {
        const item = line.slice(1).trim();
        if (item.includes(":")) {
          const [key, value] = splitYamlPair(item);
          currentAction = { [normalizeKey(key)]: value === null ? true : parseYamlScalar(value) };
          actions.push(currentAction);
        } else {
          currentAction = null;
          actions.push(parseYamlScalar(item));
        }
        root.actions = actions;
      } else if (currentAction !== null) {
        const [key, value] = splitYamlPair(line);
        currentAction[normalizeKey(key)] = value === null ? true : parseYamlScalar(value);
      }
      continue;
    }

    if (section === "conditions") {
      const conditions = isRecord(root.conditions) ? root.conditions : {};
      const [key, value] = splitYamlPair(line);
      conditions[normalizeKey(key)] = value === null ? true : parseYamlScalar(value);
      root.conditions = conditions;
    }
  }

  return root;
}

function splitYamlPair(line: string): [string, string | null] {
  const index = line.indexOf(":");
  if (index === -1) {
    return [line, null];
  }
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim();
  return [key, value ? value : null];
}

function parseYamlScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "null" || trimmed === "~") {
    return null;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        return parseInlineYamlObject(trimmed.slice(1, -1));
      }
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        return trimmed
          .slice(1, -1)
          .split(",")
          .map((item) => parseYamlScalar(item.trim()));
      }
      return trimmed;
    }
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineYamlObject(value: string): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const part of value.split(",")) {
    const [key, scalar] = splitYamlPair(part.trim());
    if (!key) {
      continue;
    }
    output[normalizeKey(key)] = scalar === null ? true : parseYamlScalar(scalar);
  }
  return output;
}

function compareBoolean(actual: boolean | undefined, expected: unknown): boolean {
  const expectedBoolean = readBoolean(expected);
  if (expectedBoolean === undefined || actual === undefined) {
    return false;
  }
  return actual === expectedBoolean;
}

function compareNumber(
  actual: number | undefined,
  expected: unknown,
  aliases: { minAlias?: string; maxAlias?: string } = {},
): boolean {
  if (actual === undefined || !Number.isFinite(actual)) {
    return false;
  }
  if (typeof expected === "number") {
    return actual >= expected;
  }
  if (!isRecord(expected)) {
    return false;
  }
  const checks = [
    ["gt", (value: number) => actual > value],
    ["gte", (value: number) => actual >= value],
    ["min", (value: number) => actual >= value],
    [aliases.minAlias ?? "", (value: number) => actual >= value],
    ["lt", (value: number) => actual < value],
    ["lte", (value: number) => actual <= value],
    ["max", (value: number) => actual <= value],
    [aliases.maxAlias ?? "", (value: number) => actual <= value],
    ["eq", (value: number) => actual === value],
  ] as const;
  let hasCheck = false;
  for (const [key, predicate] of checks) {
    if (!key || expected[key] === undefined) {
      continue;
    }
    const value = Number(expected[key]);
    if (!Number.isFinite(value)) {
      return false;
    }
    hasCheck = true;
    if (!predicate(value)) {
      return false;
    }
  }
  return hasCheck;
}

function domainAllowListMatches(config: unknown, facts: AutomodFacts): boolean {
  const allowList = readStringArray(config).map(normalizeDomain);
  if (allowList.length === 0) {
    return false;
  }
  const domains = extractDomains(facts);
  return domains.length > 0 && domains.some((domain) => !domainAllowed(domain, allowList));
}

function domainBlockListMatches(config: unknown, facts: AutomodFacts): boolean {
  const blockList = readStringArray(config).map(normalizeDomain);
  if (blockList.length === 0) {
    return false;
  }
  return extractDomains(facts).some((domain) => domainAllowed(domain, blockList));
}

function regexMatches(config: unknown, text: string): boolean {
  return readStringArray(config).some((pattern) => {
    try {
      return new RegExp(pattern, "iu").test(text);
    } catch {
      return false;
    }
  });
}

function keywordMatches(config: unknown, text: string): boolean {
  const lower = text.toLowerCase();
  return readStringArray(config).some((keyword) => lower.includes(keyword.toLowerCase()));
}

function languageMatches(config: unknown, language: string | null | undefined): boolean {
  const normalizedLanguage = normalizeKey(language ?? "");
  if (!normalizedLanguage) {
    return false;
  }
  if (typeof config === "string") {
    return normalizedLanguage === normalizeKey(config);
  }
  if (!isRecord(config)) {
    return false;
  }
  const is = readString(config.is);
  if (is) {
    return normalizedLanguage === normalizeKey(is);
  }
  const allowed = readStringArray(config.in ?? config.allow);
  if (allowed.length > 0) {
    return allowed.map(normalizeKey).includes(normalizedLanguage);
  }
  const blocked = readStringArray(config.not_in ?? config.block);
  if (blocked.length > 0) {
    return blocked.map(normalizeKey).includes(normalizedLanguage);
  }
  return false;
}

function duplicateHashMatches(config: unknown, facts: AutomodFacts): boolean {
  const expected = readBoolean(config);
  if (expected !== undefined) {
    return facts.duplicateContentHash === expected;
  }
  const hash = readString(facts.contentHash);
  return Boolean(hash && facts.knownDuplicateHashes?.includes(hash));
}

function fileTypeMatches(config: unknown, fileType: string | null | undefined): boolean {
  const normalized = normalizeKey(fileType ?? "");
  if (!normalized) {
    return false;
  }
  if (typeof config === "string") {
    return normalized === normalizeKey(config);
  }
  if (Array.isArray(config)) {
    return config.map((item) => normalizeKey(readString(item))).includes(normalized);
  }
  if (!isRecord(config)) {
    return false;
  }
  const blocked = readStringArray(config.block ?? config.blocked ?? config.deny).map(normalizeKey);
  if (blocked.length > 0) {
    return blocked.includes(normalized);
  }
  const allowed = readStringArray(config.allow ?? config.allowed).map(normalizeKey);
  return allowed.length > 0 && !allowed.includes(normalized);
}

function missingFlairTagsMatches(config: unknown, facts: AutomodFacts): boolean {
  if (readBoolean(config) === true) {
    return !readString(facts.flair) && (facts.tags ?? []).length === 0;
  }
  const required = readStringArray(config).map(normalizeKey);
  if (required.length === 0) {
    return false;
  }
  const available = new Set([
    normalizeKey(facts.flair ?? ""),
    ...(facts.tags ?? []).map((tag) => normalizeKey(tag)),
  ]);
  return required.some((tag) => !available.has(tag));
}

function researchMetadataMissingMatches(config: unknown, facts: AutomodFacts): boolean {
  const missing = new Set((facts.missingResearchMetadata ?? []).map(normalizeKey));
  if (readBoolean(config) === true) {
    return missing.size > 0;
  }
  const required = readStringArray(config);
  if (required.length === 0) {
    return false;
  }
  return required.some((key) => {
    const normalized = normalizeKey(key);
    if (missing.has(normalized)) {
      return true;
    }
    if (!isRecord(facts.metadata)) {
      return true;
    }
    const value = facts.metadata[normalized] ?? facts.metadata[key];
    return value === undefined || value === null || value === "";
  });
}

function externalUrlReputationMatches(
  config: unknown,
  reputation: AutomodFacts["externalUrlReputation"],
): boolean {
  if (typeof reputation === "number") {
    return compareNumber(reputation, config);
  }
  const normalized = normalizeKey(reputation ?? "");
  if (!normalized) {
    return false;
  }
  return readStringArray(config).map(normalizeKey).includes(normalized);
}

function fullText(facts: AutomodFacts): string {
  return [facts.title, facts.text, facts.url, ...(facts.links ?? [])].filter(Boolean).join("\n");
}

function extractLinks(facts: AutomodFacts): string[] {
  const fromFacts = facts.links ?? [];
  const fromText = Array.from(fullText(facts).matchAll(/https?:\/\/[^\s<>"')]+/giu))
    .map((match) => match[0])
    .filter(Boolean);
  return Array.from(new Set([...fromFacts, ...fromText]));
}

function extractDomains(facts: AutomodFacts): string[] {
  const explicit = (facts.domains ?? []).map(normalizeDomain).filter(Boolean);
  const fromLinks = extractLinks(facts).flatMap((link) => {
    const host = /^https?:\/\/([^/?#:]+)/iu.exec(link)?.[1];
    return host ? [normalizeDomain(host)] : [];
  });
  return Array.from(new Set([...explicit, ...fromLinks]));
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function domainAllowed(domain: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));
}

function countMentions(text: string): number {
  return Array.from(text.matchAll(/(^|[^\w])@([a-zA-Z0-9_][a-zA-Z0-9_-]{1,38})/g)).length;
}

function enforcementActions(actions: readonly AutomodAction[]): AutomodAction[] {
  const nonAllow = actions.filter((action) => action.type !== "allow");
  return nonAllow.length > 0 ? nonAllow : actions.filter((action) => action.type === "allow");
}

function selectHighestPriorityAction(actions: readonly AutomodAction[]): AutomodAction {
  if (actions.length === 0) {
    return { type: "allow" };
  }
  return (
    [...actions].sort(
      (left, right) => ACTION_PRIORITY[right.type] - ACTION_PRIORITY[left.type],
    )[0] ?? {
      type: "allow",
    }
  );
}

function selectHighestSeverity(severities: readonly ModerationSeverity[]): ModerationSeverity {
  return (
    [...severities].sort((left, right) => SEVERITY_SCORE[right] - SEVERITY_SCORE[left])[0] ?? "low"
  );
}

function ruleScore(rule: AutomodRuleDefinition, matchedConditionCount: number): number {
  const action = selectHighestPriorityAction(rule.actions);
  return SEVERITY_SCORE[rule.severity] * 100 + ACTION_PRIORITY[action.type] + matchedConditionCount;
}

function ruleLayerSort(left: AutomodRuleDefinition, right: AutomodRuleDefinition): number {
  return layerPriority(left) - layerPriority(right);
}

function layerPriority(rule: AutomodRuleDefinition): number {
  if (rule.scope.includes("platform_global")) {
    return 0;
  }
  if (rule.scope.includes("research_archive")) {
    return 1;
  }
  if (rule.scope.includes("zone")) {
    return 2;
  }
  return 3;
}

function isActionAppealable(action: AutomodAction, rule: AutomodRuleDefinition): boolean {
  return rule.appealable && !NON_APPEALABLE_DEFAULT_ACTIONS.has(action.type);
}

function serializeResult(
  result: AutomodEvaluationResult | AutomodRuleEvaluation,
): Record<string, unknown> {
  if ("matchedRules" in result) {
    return {
      matched: result.matched,
      finalAction: result.finalAction,
      severity: result.severity,
      score: result.score,
      globalRuleMatched: result.globalRuleMatched,
      matchedRules: result.matchedRules.map((evaluation) => ({
        ruleId: evaluation.rule.id,
        ruleName: evaluation.rule.name,
        matchedConditions: evaluation.matchedConditions,
        actions: evaluation.actions,
        severity: evaluation.severity,
        score: evaluation.score,
        appealable: evaluation.appealable,
      })),
    };
  }
  return {
    matched: result.matched,
    ruleId: result.rule.id,
    matchedConditions: result.matchedConditions,
    failedConditions: result.failedConditions,
    actions: result.actions,
    severity: result.severity,
    score: result.score,
    appealable: result.appealable,
  };
}

function queuePriorityScore(
  severity: ModerationSeverity,
  createdAt: string,
  reason: unknown,
): number {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  const reasonBoost =
    parseReportReason(reason) === "child_safety" ||
    parseReportReason(reason) === "terrorism_extremism" ||
    parseReportReason(reason) === "dangerous_dual_use"
      ? 75
      : 0;
  return SEVERITY_SCORE[severity] * 100 + reasonBoost + Math.min(48, ageHours);
}

function severityForReportReason(reason: ReportReason): ModerationSeverity {
  if (reason === "child_safety" || reason === "terrorism_extremism") {
    return "critical";
  }
  if (
    reason === "hate_illegal_content" ||
    reason === "malware" ||
    reason === "dangerous_dual_use" ||
    reason === "safety_concern" ||
    reason === "privacy_doxxing"
  ) {
    return "high";
  }
  if (reason === "spam" || reason === "other") {
    return "medium";
  }
  return "medium";
}

function readAuditTrail(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(readString).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return readStringArray(parsed);
      } catch {
        return [];
      }
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (isRecord(value)) {
    const values = value.values ?? value.list ?? value.items;
    return readStringArray(values);
  }
  return [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const key = normalizeKey(value);
    if (key === "true" || key === "yes" || key === "1") {
      return true;
    }
    if (key === "false" || key === "no" || key === "0") {
      return false;
    }
  }
  return undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return undefined;
  }
  return Math.trunc(number);
}

function normalizeNullable(value: unknown): string | null {
  const text = readString(value);
  return text ? text : null;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
