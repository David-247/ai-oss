import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve("..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Phase 18 compliance and legal security", () => {
  it("renders all legal pages from versioned policy content", () => {
    const legalIndex = readRepoFile("apps/web/src/app/legal/page.tsx");
    const legalSlug = readRepoFile("apps/web/src/app/legal/[slug]/page.tsx");
    const compliance = readRepoFile("packages/compliance/src/index.ts");
    for (const required of [
      "privacy",
      "terms",
      "cookies",
      "dmca",
      "community-guidelines",
      "research-policy",
      "moderator-code",
      "transparency",
      "dsa",
      "online-safety",
    ]) {
      expect(compliance).toContain(required);
    }
    expect(legalIndex).toContain("legalPolicySummaries");
    expect(legalIndex).toContain("Do not sell/share by default");
    expect(legalSlug).toContain("generateStaticParams");
    expect(legalSlug).toContain("legalPolicyForSlug");
    expect(legalSlug).not.toContain("RouteShellPage");
  });

  it("exposes legal intake, cookie consent, and privacy SLA routes", () => {
    for (const file of [
      "apps/web/src/app/api/legal/dmca/route.ts",
      "apps/web/src/app/api/legal/dsa/route.ts",
      "apps/web/src/app/api/legal/online-safety/route.ts",
      "apps/web/src/app/api/compliance/cookie-consent/route.ts",
      "apps/web/src/lib/compliance-server.ts",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
    const privacy = readRepoFile("apps/web/src/app/api/account/privacy-request/route.ts");
    const server = readRepoFile("apps/web/src/lib/compliance-server.ts");
    expect(privacy).toContain("buildPrivacyRequestRow");
    expect(privacy).toContain("recordTransparencyEvent");
    expect(server).toContain("buildLegalRequestRow");
    expect(server).toContain("legal_hold");
    expect(server).toContain("transparency_report_events");
    expect(server).toContain("normalizeCookieConsent");
  });

  it("persists compliance metadata in migrations and database metadata", () => {
    const migration = readRepoFile("supabase/migrations/20260612011800_phase18_compliance_legal.sql");
    const db = readRepoFile("packages/db/src/index.ts");
    for (const required of [
      "due_at",
      "gpc_signal",
      "do_not_sell_share",
      "limit_sensitive_data",
      "requester_email",
      "target_url",
      "statement_of_reasons",
      "child_safety_escalation",
      "privacy_request_id",
      "legal_request_id",
      "ai_metadata",
    ]) {
      expect(migration).toContain(required);
      expect(db).toContain(required);
    }
  });

  it("wires AI metadata into research submission and paper records", () => {
    const researchServer = readRepoFile("apps/web/src/lib/research-server.ts");
    const researchPackage = readRepoFile("packages/research/src/index.ts");
    const papersRoute = readRepoFile("apps/web/src/app/api/research/papers/route.ts");
    expect(researchServer).toContain("buildAiMetadata");
    expect(researchServer).toContain("aiMetadata");
    expect(researchPackage).toContain("ai_metadata");
    expect(researchPackage).toContain("metadata_snapshot");
    expect(papersRoute).toContain("buildPaperInsertRow");
  });

  it("keeps admin legal/privacy actions permission-gated and audited", () => {
    const adminServer = readRepoFile("apps/web/src/lib/admin-server.ts");
    const adminPackage = readRepoFile("packages/admin/src/index.ts");
    expect(adminPackage).toContain("legal_hold");
    expect(adminPackage).toContain("privacy_request_execute");
    expect(adminServer).toContain("requirePermissionForRequest");
    expect(adminServer).toContain("requireHighRiskApproval");
    expect(adminServer).toContain("insertAuditEvent");
    expect(adminServer).toContain("verified_by_privacy_admin");
    expect(adminServer).toContain("legal_hold: true");
  });
});
