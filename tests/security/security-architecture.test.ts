import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("Phase 19 security architecture wiring", () => {
  it("applies security headers and CSRF checks in edge middleware", () => {
    const middleware = read("apps/web/src/middleware.ts");
    const security = read("packages/security/src/index.ts");
    expect(middleware).toContain("buildSecurityHeaders");
    expect(middleware).toContain("evaluateCsrfRequest");
    expect(security).toContain("Strict-Transport-Security");
    expect(security).toContain("Content-Security-Policy");
    expect(middleware).toContain("csrf-protection-required");
  });

  it("adds admin session and append-only security event persistence", () => {
    const migration = read("supabase/migrations/20260612011900_phase19_security_architecture.sql");
    expect(migration).toContain("mfa_verified_at");
    expect(migration).toContain("step_up_verified_at");
    expect(migration).toContain("admin_session_expires_at");
    expect(migration).toContain("break_glass_enabled");
    expect(migration).toContain("create table if not exists public.security_events");
    expect(migration).toContain("prevent_row_update_or_delete");
    expect(migration).toContain("enable row level security");
  });

  it("keeps security fields represented as protected DB metadata", () => {
    const db = read("packages/db/src/index.ts");
    expect(db).toContain('"security_events"');
    expect(db).toContain('"session_risk"');
    expect(db).toContain('"break_glass_last_used_at"');
    expect(db).toContain('security_events: ["severity", "ip_hash", "device_hash", "metadata"]');
  });

  it("wires SSRF-safe URL handling into research links", () => {
    const security = read("packages/security/src/index.ts");
    const research = read("packages/research/src/index.ts");
    expect(security).toContain("evaluateServerSideUrl");
    expect(security).toContain("a === 169 && b === 254");
    expect(security).toContain("metadata.google.internal");
    expect(research).toContain("isPrivateOrLocalHostname");
    expect(research).toContain("metadata.google.internal");
  });

  it("declares WAF and supply-chain controls", () => {
    const waf = JSON.parse(read("vercel/waf-rules.phase19.json")) as {
      rules: { key: string; action: string; paths: string[] }[];
    };
    expect(waf.rules.map((rule) => rule.key)).toEqual(
      expect.arrayContaining(["admin-step-up", "auth-abuse", "legal-intake", "research-submit"]),
    );
    expect(waf.rules.find((rule) => rule.key === "admin-step-up")?.action).toBe("challenge");
    expect(read(".github/workflows/ci.yml")).toContain("pnpm test");
    expect(read(".github/dependabot.yml")).toContain("package-ecosystem");
    expect(read(".github/CODEOWNERS")).toContain("*");
    expect(read("pnpm-lock.yaml").length).toBeGreaterThan(1000);
  });

  it("keeps admin actions audited and gated by elevated session security", () => {
    const admin = read("apps/web/src/lib/admin-server.ts");
    expect(admin).toContain("requireElevatedAdminSession");
    expect(admin).toContain("evaluateAdminSessionSecurity");
    expect(admin).toContain("buildBreakGlassMonitorEvent");
    expect(admin).toContain("insertAuditEvent");
  });
});
