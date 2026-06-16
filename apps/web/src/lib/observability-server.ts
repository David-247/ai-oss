import { NextResponse } from "next/server";
import {
  ALERT_RULES,
  METRIC_CATALOG,
  OBSERVABILITY_DASHBOARDS,
  RUNBOOKS,
  buildAlertEventRow,
  buildAdminOperationalSignals,
  buildSyntheticAlertEvent,
  buildSystemHealthSnapshot,
  observabilityCoverageSummary,
  type AlertKey,
  type HealthStatus,
} from "@ai-oss/observability";
import { verifyJobTrigger } from "@ai-oss/jobs";
import { authConfigStatus, getServiceClientOrProblem, problem } from "@/lib/auth-server";
import { listJobs } from "@/lib/jobs";

const NO_STORE = { "Cache-Control": "no-store" };

export function buildPublicHealthSnapshot(env: NodeJS.ProcessEnv = process.env) {
  const auth = authConfigStatus();
  const jobs = listJobs();
  const coverage = observabilityCoverageSummary();

  return buildSystemHealthSnapshot({
    source: "web",
    components: [
      component("web", "operational", "Next.js route handler responsive"),
      component(
        "supabase_public",
        auth.publicConfig.configured ? "operational" : "degraded",
        auth.publicConfig.configured ? "public config present" : "public config missing",
      ),
      component(
        "supabase_service",
        auth.serviceConfig.configured ? "operational" : "degraded",
        auth.serviceConfig.configured ? "service config present" : "service config missing",
      ),
      component(
        "jobs",
        jobs.length > 0 ? "operational" : "degraded",
        `${jobs.length} jobs registered`,
      ),
      component(
        "observability_catalog",
        coverage.metrics > 0 && coverage.alerts > 0 && coverage.runbooks > 0
          ? "operational"
          : "degraded",
        `${coverage.metrics} metrics, ${coverage.alerts} alerts, ${coverage.runbooks} runbooks`,
      ),
      component(
        "stripe",
        env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET ? "operational" : "degraded",
        "payment provider configuration",
      ),
      component(
        "livekit",
        env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_URL
          ? "operational"
          : "degraded",
        "voice provider configuration",
      ),
    ],
    metadata: {
      jobCount: jobs.length,
      metricCount: coverage.metrics,
      alertCount: coverage.alerts,
      runbookCount: coverage.runbooks,
      dashboards: coverage.dashboards,
    },
  });
}

export function buildObservabilityResponse() {
  const health = buildPublicHealthSnapshot();
  return {
    coverage: observabilityCoverageSummary(),
    dashboards: OBSERVABILITY_DASHBOARDS,
    metrics: METRIC_CATALOG,
    alerts: ALERT_RULES,
    runbooks: RUNBOOKS,
    jobs: listJobs(),
    health,
  };
}

export function buildDefaultOperationalSignals() {
  return buildAdminOperationalSignals({
    jobFailures: 0,
    queueBacklog: 0,
    legalDeadlinesDueSoon: 0,
    privacyDeadlinesDueSoon: 0,
    adminRoleChanges: 0,
    securityAlerts: 0,
  });
}

export function handleHealthGet() {
  const health = buildPublicHealthSnapshot();
  return NextResponse.json(
    {
      status: health.overall_status,
      generatedAt: health.created_at,
      components: health.components,
      metadata: health.metadata,
    },
    { headers: NO_STORE },
  );
}

export function handleObservabilityGet() {
  return NextResponse.json(buildObservabilityResponse(), { headers: NO_STORE });
}

export async function handleObservabilityPost(request: Request) {
  const secret = process.env.JOB_TRIGGER_SECRET ?? process.env.CRON_SECRET;
  const verification = verifyJobTrigger({ headers: request.headers, secret });
  if (verification !== true) {
    return problem(
      verification.status,
      verification.reason,
      verification.status === 500
        ? "Job trigger secret is not configured."
        : "Observability trigger credentials are invalid.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, "invalid-json", "Request body must be valid JSON.");
  }

  if (!isRecord(body) || body.action !== "test_alert") {
    return problem(400, "invalid-observability-action", "Use action=test_alert.");
  }

  const alertKey = typeof body.alertKey === "string" ? body.alertKey : "";
  if (!isAlertKey(alertKey)) {
    return problem(400, "unknown-alert-key", "Unknown alert key.");
  }

  const event =
    typeof body.observedValue === "number"
      ? buildAlertEventRow({
          key: alertKey,
          observedValue: body.observedValue,
          status: "test",
          correlationId: readString(body.correlationId) || null,
          metadata: { synthetic: true, source: "api" },
        })
      : buildSyntheticAlertEvent(alertKey);

  const service = getServiceClientOrProblem();
  let persisted = false;
  let persistError: string | null = null;
  if (service.ok) {
    const insert = await service.client.from("alert_events").insert(event);
    persisted = insert.error === null;
    persistError = insert.error?.message ?? null;
  }

  return NextResponse.json({ ok: true, event, persisted, persistError }, { headers: NO_STORE });
}

function component(key: string, status: HealthStatus, detail: string) {
  return { key, status, detail };
}

function isAlertKey(value: string): value is AlertKey {
  return ALERT_RULES.some((rule) => rule.key === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
