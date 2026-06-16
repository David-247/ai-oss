import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RUNBOOKS } from "@ai-oss/observability";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("Phase 20 observability operations wiring", () => {
  it("creates append-only observability, alert, and health tables with RLS", () => {
    const migration = read(
      "supabase/migrations/20260612012000_phase20_observability_operations.sql",
    );
    for (const table of [
      "observability_events",
      "alert_events",
      "system_health_snapshots",
    ]) {
      expect(migration).toContain(`public.${table}`);
      expect(migration).toContain(`${table}_append_only`);
    }
    expect(migration).toContain("prevent_row_update_or_delete");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("system.settings_read");
    expect(migration).toContain("security.read");
    expect(migration).toContain("audit.read");
    expect(migration).toContain("redaction_applied = true");
  });

  it("represents observability tables as protected append-only database metadata", () => {
    const db = read("packages/db/src/index.ts");
    expect(db).toContain('"observability_events"');
    expect(db).toContain('"alert_events"');
    expect(db).toContain('"system_health_snapshots"');
    expect(db).toContain('observability_events: ["message", "tags", "metadata", "correlation_id"]');
    expect(db).toContain('"observability_events",\n  "alert_events",\n  "system_health_snapshots"');
  });

  it("wires public health and protected synthetic alert endpoints", () => {
    const healthRoute = read("apps/web/src/app/api/health/route.ts");
    const observabilityRoute = read("apps/web/src/app/api/observability/route.ts");
    const server = read("apps/web/src/lib/observability-server.ts");

    expect(healthRoute).toContain("handleHealthGet");
    expect(observabilityRoute).toContain("handleObservabilityGet");
    expect(observabilityRoute).toContain("handleObservabilityPost");
    expect(server).toContain("verifyJobTrigger");
    expect(server).toContain("buildSyntheticAlertEvent");
    expect(server).toContain("getServiceClientOrProblem");
    expect(server).not.toContain("SUPABASE_SERVICE_ROLE_KEY:");
  });

  it("links observability coverage and runbooks from admin surfaces", () => {
    const adminPackage = read("packages/admin/src/index.ts");
    const adminServer = read("apps/web/src/lib/admin-server.ts");
    expect(adminPackage).toContain('"Incident runbooks"');
    expect(adminPackage).toContain('"alert_events"');
    expect(adminPackage).toContain('"system_health_snapshots"');
    expect(adminServer).toContain("observabilityCoverageSummary");
    expect(adminServer).toContain("buildAdminOperationalSignals");
    expect(adminServer).toContain("RUNBOOKS");
  });

  it("ships every required runbook with incident handling sections", () => {
    for (const runbook of RUNBOOKS) {
      const path = join(repoRoot, runbook.path);
      expect(existsSync(path), runbook.slug).toBe(true);
      const body = read(runbook.path);
      for (const section of [
        "## Severity",
        "## First 15 Minutes",
        "## Diagnose",
        "## Mitigate",
        "## Communications",
        "## Evidence",
        "## Exit Criteria",
      ]) {
        expect(body).toContain(section);
      }
    }
  });
});
