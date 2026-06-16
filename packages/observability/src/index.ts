export const PACKAGE_NAME = "@ai-oss/observability" as const;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export type JsonRecord = { [key: string]: JsonValue | undefined };

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";
export type HealthStatus = "operational" | "degraded" | "down" | "unknown";
export type AlertSeverity = "info" | "warning" | "critical";
export type RunbookSlug =
  | "production-outage"
  | "database-incident"
  | "auth-incident"
  | "payment-incident"
  | "spam-raid"
  | "governance-vote-attack"
  | "illegal-content-report"
  | "csam-report"
  | "dmca-takedown"
  | "privacy-deletion-export"
  | "admin-account-compromise"
  | "data-breach"
  | "voice-room-abuse";

export const REDACTED = "[REDACTED]" as const;

export const METRIC_CATALOG = [
  metric("request.rate", "counter", "Request rate by route/method/status"),
  metric("request.error_rate", "gauge", "5xx and route error percentage"),
  metric("request.latency_ms", "histogram", "Server request latency in milliseconds"),
  metric("web_vitals.lcp", "histogram", "Core Web Vitals largest contentful paint"),
  metric("web_vitals.cls", "histogram", "Core Web Vitals cumulative layout shift"),
  metric("web_vitals.inp", "histogram", "Core Web Vitals interaction to next paint"),
  metric("auth.signups", "counter", "Signup volume"),
  metric("auth.failures", "counter", "Authentication failure volume"),
  metric("auth.signups.bot_suspected", "counter", "Bot-suspected signup volume"),
  metric("users.active", "gauge", "Active users"),
  metric("zones.created", "counter", "Zone creation count"),
  metric("discussions.posts", "counter", "Post creation count"),
  metric("discussions.comments", "counter", "Comment creation count"),
  metric("research.submissions", "counter", "Research submission count"),
  metric("chat.messages", "counter", "Chat message volume"),
  metric("voice.minutes", "counter", "Voice usage minutes"),
  metric("moderation.reports", "counter", "Report volume"),
  metric("moderation.actions", "counter", "Moderator action count"),
  metric("moderation.appeal_outcomes", "counter", "Appeal decisions"),
  metric("files.scan_failures", "counter", "File scan failures"),
  metric("files.scan_backlog_minutes", "gauge", "File scan backlog age in minutes"),
  metric("jobs.failures", "counter", "Job failures and dead letters"),
  metric("donations.events", "counter", "Donation and Stripe event volume"),
  metric("donations.webhook_failures", "counter", "Failed Stripe webhook events"),
  metric("search.latency_ms", "histogram", "Search latency"),
  metric("trust.bot_rate_limit_events", "counter", "Bot/rate-limit events"),
  metric("moderation.queue_backlog_hours", "gauge", "Moderation queue backlog age in hours"),
  metric("compliance.deadline_hours_remaining", "gauge", "Nearest legal/privacy SLA deadline"),
  metric("admin.role_changes", "counter", "Admin role change events"),
  metric("security.waf_botid_events", "counter", "WAF and bot identity challenge events"),
  metric("database.connection_usage_percent", "gauge", "Database connection pool saturation"),
  metric("realtime.failures", "counter", "Realtime channel failures"),
  metric("voice.provider_failures", "counter", "Voice provider failures"),
] as const;

export type MetricKey = (typeof METRIC_CATALOG)[number]["key"];

export const ALERT_RULES = [
  alert("elevated-5xx", "critical", "request.error_rate", 5, "production-outage"),
  alert("auth-failure-spike", "warning", "auth.failures", 50, "auth-incident"),
  alert("bot-signup-spike", "warning", "auth.signups.bot_suspected", 25, "spam-raid"),
  alert("payment-webhook-failures", "critical", "donations.webhook_failures", 1, "payment-incident"),
  alert("file-scan-backlog", "warning", "files.scan_backlog_minutes", 15, "database-incident"),
  alert(
    "moderation-queue-backlog",
    "warning",
    "moderation.queue_backlog_hours",
    4,
    "illegal-content-report",
  ),
  alert(
    "legal-privacy-deadline",
    "critical",
    "compliance.deadline_hours_remaining",
    24,
    "privacy-deletion-export",
    "less_than_or_equal",
  ),
  alert("admin-role-change", "critical", "admin.role_changes", 1, "admin-account-compromise"),
  alert("waf-botid-spike", "warning", "security.waf_botid_events", 100, "spam-raid"),
  alert("database-saturation", "critical", "database.connection_usage_percent", 85, "database-incident"),
  alert("realtime-failures", "warning", "realtime.failures", 5, "production-outage"),
  alert("voice-provider-failures", "warning", "voice.provider_failures", 3, "voice-room-abuse"),
  alert("job-failures", "warning", "jobs.failures", 1, "production-outage"),
] as const;

export type AlertKey = (typeof ALERT_RULES)[number]["key"];

export const OBSERVABILITY_DASHBOARDS = [
  dashboard("traffic", "Traffic and errors", [
    "request.rate",
    "request.error_rate",
    "request.latency_ms",
    "web_vitals.lcp",
    "web_vitals.cls",
    "web_vitals.inp",
  ]),
  dashboard("growth", "Growth and activity", [
    "auth.signups",
    "users.active",
    "zones.created",
    "discussions.posts",
    "discussions.comments",
    "research.submissions",
  ]),
  dashboard("trust-safety", "Trust and safety", [
    "moderation.reports",
    "moderation.actions",
    "moderation.appeal_outcomes",
    "trust.bot_rate_limit_events",
    "security.waf_botid_events",
  ]),
  dashboard("operations", "Operations", [
    "jobs.failures",
    "files.scan_failures",
    "files.scan_backlog_minutes",
    "database.connection_usage_percent",
    "realtime.failures",
  ]),
  dashboard("revenue-and-compliance", "Revenue and compliance", [
    "donations.events",
    "donations.webhook_failures",
    "compliance.deadline_hours_remaining",
    "admin.role_changes",
  ]),
] as const;

export const RUNBOOKS = [
  runbook("production-outage", "Production Outage", "critical"),
  runbook("database-incident", "Database Incident", "critical"),
  runbook("auth-incident", "Auth Incident", "critical"),
  runbook("payment-incident", "Payment Incident", "critical"),
  runbook("spam-raid", "Spam Raid", "critical"),
  runbook("governance-vote-attack", "Governance Vote Attack", "critical"),
  runbook("illegal-content-report", "Illegal Content Report", "critical"),
  runbook("csam-report", "CSAM Report", "critical"),
  runbook("dmca-takedown", "DMCA Takedown", "warning"),
  runbook("privacy-deletion-export", "Privacy Deletion/Export", "critical"),
  runbook("admin-account-compromise", "Admin Account Compromise", "critical"),
  runbook("data-breach", "Data Breach", "critical"),
  runbook("voice-room-abuse", "Voice Room Abuse", "warning"),
] as const;

export interface StructuredLogInput {
  level: LogLevel;
  event: string;
  message: string;
  correlationId: string;
  metadata?: JsonRecord;
  timestamp?: string;
}

export function buildStructuredLog(input: StructuredLogInput) {
  return {
    level: input.level,
    event: input.event,
    message: redactString(input.message),
    correlation_id: input.correlationId,
    metadata: redactLogRecord(input.metadata ?? {}),
    redaction_applied: true,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

export function redactLogRecord<TValue extends JsonValue>(value: TValue): TValue {
  return redactValue(value, []) as TValue;
}

export function findRedactionIssues(value: JsonValue): string[] {
  const serialized = JSON.stringify(value).toLowerCase();
  const issues: string[] = [];
  const checks: readonly [string, RegExp][] = [
    ["password123", /password123/],
    ["bearer ", /bearer\s+(?!\[redacted\])[a-z0-9._~+/=-]+/],
    ["sk_live_", /sk_live_(?!\[redacted\])[a-z0-9]+/],
    ["whsec_", /whsec_(?!\[redacted\])[a-z0-9]+/],
    ["4111111111111111", /4111111111111111/],
    ["ssn", /\bssn\b/],
    ["private message", /private message/],
  ];
  for (const [marker, pattern] of checks) {
    if (pattern.test(serialized)) {
      issues.push(marker);
    }
  }
  return issues;
}

export function buildMetricEventRow(input: {
  key: MetricKey | string;
  value: number;
  unit?: string;
  tags?: JsonRecord;
  correlationId?: string | null;
  occurredAt?: string;
}) {
  return {
    event_type: "metric",
    metric_key: input.key,
    value: input.value,
    unit: input.unit ?? null,
    log_level: null,
    event_name: null,
    message: null,
    tags: redactLogRecord(input.tags ?? {}),
    metadata: {},
    correlation_id: input.correlationId ?? null,
    redaction_applied: true,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  };
}

export function buildLogEventRow(input: StructuredLogInput) {
  const log = buildStructuredLog(input);
  return {
    event_type: "log",
    metric_key: null,
    value: null,
    unit: null,
    log_level: log.level,
    event_name: log.event,
    message: log.message,
    tags: {},
    metadata: log.metadata,
    correlation_id: log.correlation_id,
    redaction_applied: true,
    occurred_at: log.timestamp,
  };
}

export function evaluateAlertRule(
  key: AlertKey,
  observedValue: number,
): { firing: boolean; rule: (typeof ALERT_RULES)[number]; observedValue: number } {
  const rule = requireAlertRule(key);
  const firing =
    rule.comparison === "less_than_or_equal"
      ? observedValue <= rule.threshold
      : observedValue >= rule.threshold;
  return { firing, rule, observedValue };
}

export function buildAlertEventRow(input: {
  key: AlertKey;
  observedValue: number;
  status?: "firing" | "resolved" | "test";
  correlationId?: string | null;
  metadata?: JsonRecord;
  firedAt?: string;
}) {
  const evaluation = evaluateAlertRule(input.key, input.observedValue);
  return {
    alert_key: evaluation.rule.key,
    severity: evaluation.rule.severity,
    status: input.status ?? (evaluation.firing ? "firing" : "resolved"),
    threshold: evaluation.rule.threshold,
    observed_value: input.observedValue,
    runbook_slug: evaluation.rule.runbookSlug,
    correlation_id: input.correlationId ?? null,
    metadata: redactLogRecord(input.metadata ?? {}),
    fired_at: input.firedAt ?? new Date().toISOString(),
  };
}

export function buildSyntheticAlertEvent(key: AlertKey, now = new Date()) {
  const rule = requireAlertRule(key);
  return buildAlertEventRow({
    key,
    observedValue:
      rule.comparison === "less_than_or_equal" ? rule.threshold - 1 : rule.threshold + 1,
    status: "test",
    correlationId: `synthetic-${key}-${now.getTime()}`,
    metadata: { synthetic: true },
    firedAt: now.toISOString(),
  });
}

export function buildSystemHealthSnapshot(input: {
  components: readonly { key: string; status: HealthStatus; detail?: string }[];
  source?: string;
  metadata?: JsonRecord;
  createdAt?: string;
}) {
  const statuses = input.components.map((component) => component.status);
  const overall: HealthStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : statuses.includes("unknown")
        ? "unknown"
        : "operational";
  return {
    overall_status: overall,
    components: input.components.map((component) => ({ ...component })),
    source: input.source ?? "app",
    metadata: redactLogRecord(input.metadata ?? {}),
    created_at: input.createdAt ?? new Date().toISOString(),
  };
}

export function buildAdminOperationalSignals(input: {
  jobFailures?: number | null;
  queueBacklog?: number | null;
  legalDeadlinesDueSoon?: number | null;
  privacyDeadlinesDueSoon?: number | null;
  adminRoleChanges?: number | null;
  securityAlerts?: number | null;
}) {
  return [
    signal("job_failures", "Job failures", input.jobFailures ?? 0, "warning"),
    signal("queue_backlog", "Queue backlog", input.queueBacklog ?? 0, "warning"),
    signal(
      "legal_deadlines",
      "Legal deadlines due soon",
      input.legalDeadlinesDueSoon ?? 0,
      "critical",
    ),
    signal(
      "privacy_deadlines",
      "Privacy deadlines due soon",
      input.privacyDeadlinesDueSoon ?? 0,
      "critical",
    ),
    signal("admin_role_changes", "Admin role changes", input.adminRoleChanges ?? 0, "critical"),
    signal("security_alerts", "Security alerts", input.securityAlerts ?? 0, "critical"),
  ];
}

export function runbookPath(slug: RunbookSlug | string): string {
  return `docs/runbooks/${slug}.md`;
}

export function observabilityCoverageSummary() {
  return {
    metrics: METRIC_CATALOG.length,
    alerts: ALERT_RULES.length,
    runbooks: RUNBOOKS.length,
    dashboards: OBSERVABILITY_DASHBOARDS.length,
    redactionRequired: true,
  };
}

function metric(key: string, type: "counter" | "gauge" | "histogram", description: string) {
  return { key, type, description };
}

function dashboard(key: string, title: string, metricKeys: readonly MetricKey[]) {
  return { key, title, metricKeys };
}

function alert(
  key: string,
  severity: AlertSeverity,
  metricKey: string,
  threshold: number,
  runbookSlug: RunbookSlug,
  comparison: "greater_than_or_equal" | "less_than_or_equal" = "greater_than_or_equal",
) {
  return { key, severity, metricKey, threshold, runbookSlug, comparison };
}

function runbook(slug: string, title: string, severity: AlertSeverity) {
  return {
    slug,
    title,
    severity,
    path: runbookPath(slug),
  };
}

function signal(
  key: string,
  label: string,
  value: number,
  severity: AlertSeverity,
) {
  return {
    key,
    label,
    value,
    severity,
    active: value > 0,
  };
}

function redactValue(value: JsonValue, path: readonly string[]): JsonValue {
  if (typeof value === "string") {
    return shouldRedactPath(path) ? REDACTED : redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(item, [...path, String(index)]));
  }
  if (typeof value === "object" && value !== null) {
    const output: JsonRecord = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = shouldRedactPath([...path, key])
        ? REDACTED
        : redactValue(child ?? null, [...path, key]);
    }
    return output;
  }
  return value;
}

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/sk_(live|test)_[A-Za-z0-9]+/g, "sk_$1_[REDACTED]")
    .replace(/whsec_[A-Za-z0-9]+/g, "whsec_[REDACTED]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, REDACTED)
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, REDACTED)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED);
}

function shouldRedactPath(path: readonly string[]): boolean {
  const key = path[path.length - 1]?.toLowerCase() ?? "";
  return [
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "cookie",
    "secret",
    "service_role_key",
    "stripe_secret_key",
    "stripe_webhook_secret",
    "payment_method",
    "card_number",
    "cvc",
    "ssn",
    "email",
    "phone",
    "private_message_body",
    "chat_message_body",
    "message_body",
    "dm_body",
  ].some((sensitive) => key.includes(sensitive));
}

function requireAlertRule(key: AlertKey): (typeof ALERT_RULES)[number] {
  const rule = ALERT_RULES.find((candidate) => candidate.key === key);
  if (rule === undefined) {
    throw new Error(`Unknown alert rule: ${key}`);
  }
  return rule;
}
