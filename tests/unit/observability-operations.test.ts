import { describe, expect, it } from "vitest";
import {
  ALERT_RULES,
  METRIC_CATALOG,
  OBSERVABILITY_DASHBOARDS,
  REDACTED,
  RUNBOOKS,
  buildAdminOperationalSignals,
  buildLogEventRow,
  buildMetricEventRow,
  buildStructuredLog,
  buildSyntheticAlertEvent,
  buildSystemHealthSnapshot,
  evaluateAlertRule,
  findRedactionIssues,
  observabilityCoverageSummary,
  type MetricKey,
} from "@ai-oss/observability";

describe("Phase 20 observability operations helpers", () => {
  it("catalogs all required product, safety, and operations metrics", () => {
    const keys = METRIC_CATALOG.map((metric) => metric.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "request.rate",
        "request.error_rate",
        "request.latency_ms",
        "web_vitals.lcp",
        "web_vitals.cls",
        "web_vitals.inp",
        "auth.signups",
        "users.active",
        "zones.created",
        "discussions.posts",
        "discussions.comments",
        "research.submissions",
        "chat.messages",
        "voice.minutes",
        "moderation.reports",
        "moderation.actions",
        "moderation.appeal_outcomes",
        "files.scan_failures",
        "jobs.failures",
        "donations.events",
        "search.latency_ms",
        "trust.bot_rate_limit_events",
      ]),
    );
  });

  it("keeps dashboards backed by declared metric keys", () => {
    const metricKeys = new Set<string>(METRIC_CATALOG.map((metric) => metric.key));
    for (const dashboard of OBSERVABILITY_DASHBOARDS) {
      expect(dashboard.metricKeys.length).toBeGreaterThan(0);
      for (const key of dashboard.metricKeys) {
        expect(metricKeys.has(key), `${dashboard.key}:${key}`).toBe(true);
      }
    }
  });

  it("redacts structured logs before persistence", () => {
    const log = buildStructuredLog({
      level: "error",
      event: "auth.login_failed",
      message:
        "Bearer abc.def.ghi sk_live_secret whsec_webhook jane@example.com 4111111111111111",
      correlationId: "corr-1",
      metadata: {
        password: "password123",
        token: "Bearer token",
        stripe_secret_key: "sk_live_hidden",
        card_number: "4111111111111111",
        email: "jane@example.com",
        private_message_body: "private message body",
      },
      timestamp: "2026-06-12T00:00:00.000Z",
    });

    expect(log.metadata.password).toBe(REDACTED);
    expect(log.metadata.private_message_body).toBe(REDACTED);
    expect(log.message).not.toContain("sk_live_secret");
    expect(log.message).not.toContain("jane@example.com");
    expect(findRedactionIssues(log)).toEqual([]);

    const row = buildLogEventRow({
      level: "warn",
      event: "chat.message_filtered",
      message: "Filtered chat payload from jane@example.com",
      correlationId: "corr-2",
      metadata: { chat_message_body: "private message content" },
      timestamp: "2026-06-12T00:00:00.000Z",
    });
    expect(row).toMatchObject({
      event_type: "log",
      redaction_applied: true,
      correlation_id: "corr-2",
      event_name: "chat.message_filtered",
    });
    expect(findRedactionIssues(row)).toEqual([]);
  });

  it("redacts metric tags and builds alert smoke events", () => {
    const metric = buildMetricEventRow({
      key: "request.rate",
      value: 42,
      unit: "requests",
      tags: { route: "/api/auth", email: "jane@example.com" },
      correlationId: "corr-3",
      occurredAt: "2026-06-12T00:00:00.000Z",
    });
    expect(metric.tags.email).toBe(REDACTED);
    expect(metric).toMatchObject({
      event_type: "metric",
      metric_key: "request.rate",
      redaction_applied: true,
    });

    expect(evaluateAlertRule("elevated-5xx", 5)).toMatchObject({ firing: true });
    const synthetic = buildSyntheticAlertEvent(
      "payment-webhook-failures",
      new Date("2026-06-12T00:00:00.000Z"),
    );
    expect(synthetic).toMatchObject({
      alert_key: "payment-webhook-failures",
      status: "test",
      runbook_slug: "payment-incident",
    });
  });

  it("computes health and admin operational signals", () => {
    const health = buildSystemHealthSnapshot({
      components: [
        { key: "web", status: "operational" },
        { key: "database", status: "degraded" },
      ],
      createdAt: "2026-06-12T00:00:00.000Z",
    });
    expect(health.overall_status).toBe("degraded");

    const signals = buildAdminOperationalSignals({
      jobFailures: 2,
      queueBacklog: 0,
      legalDeadlinesDueSoon: 1,
      privacyDeadlinesDueSoon: 0,
      adminRoleChanges: 1,
      securityAlerts: 3,
    });
    expect(signals.filter((signal) => signal.active).map((signal) => signal.key)).toEqual(
      expect.arrayContaining([
        "job_failures",
        "legal_deadlines",
        "admin_role_changes",
        "security_alerts",
      ]),
    );
  });

  it("covers required alert and runbook inventory", () => {
    const alertKeys = ALERT_RULES.map((rule) => rule.key);
    expect(alertKeys).toEqual(
      expect.arrayContaining([
        "elevated-5xx",
        "auth-failure-spike",
        "bot-signup-spike",
        "payment-webhook-failures",
        "file-scan-backlog",
        "moderation-queue-backlog",
        "legal-privacy-deadline",
        "admin-role-change",
        "waf-botid-spike",
        "database-saturation",
        "realtime-failures",
        "voice-provider-failures",
      ]),
    );

    const runbookSlugs = RUNBOOKS.map((runbook) => runbook.slug);
    expect(runbookSlugs).toEqual(
      expect.arrayContaining([
        "production-outage",
        "database-incident",
        "auth-incident",
        "payment-incident",
        "spam-raid",
        "governance-vote-attack",
        "illegal-content-report",
        "csam-report",
        "dmca-takedown",
        "privacy-deletion-export",
        "admin-account-compromise",
        "data-breach",
        "voice-room-abuse",
      ]),
    );

    expect(observabilityCoverageSummary()).toMatchObject({
      metrics: METRIC_CATALOG.length,
      alerts: ALERT_RULES.length,
      runbooks: RUNBOOKS.length,
      redactionRequired: true,
    });
  });
});

function assertMetricKey(_key: MetricKey) {
  return true;
}

assertMetricKey("request.rate");
