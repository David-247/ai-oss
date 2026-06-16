import { describe, expect, it } from "vitest";
import {
  SUPPLY_CHAIN_CONTROLS,
  VERCEL_WAF_RULES,
  buildBreakGlassMonitorEvent,
  buildSecurityHeaders,
  evaluateAdminSessionSecurity,
  evaluateCsrfRequest,
  evaluateServerSideUrl,
  secretEnvExposureIssues,
} from "@ai-oss/security";
import { buildPostInsertRow } from "@ai-oss/discussions";
import { buildPaperLinkRows, type ResearchSubmissionInput } from "@ai-oss/research";

const headers = (values: Record<string, string>): Headers => new Headers(values);

describe("Phase 19 security architecture helpers", () => {
  it("builds the required browser security headers", () => {
    const result = buildSecurityHeaders({ env: "production", reportUri: "/api/csp-report" });
    expect(result["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(result["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(result["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(result["Content-Security-Policy"]).toContain("report-uri /api/csp-report");
    expect(result["X-Frame-Options"]).toBe("DENY");
    expect(result["X-Content-Type-Options"]).toBe("nosniff");
    expect(result["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(result["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("requires CSRF protection for cookie-backed mutations only", () => {
    expect(
      evaluateCsrfRequest({
        method: "GET",
        url: "https://www.ai-oss.net/account",
        headers: headers({ cookie: "sb-access-token=session" }),
      }).allowed,
    ).toBe(true);

    expect(
      evaluateCsrfRequest({
        method: "POST",
        url: "https://www.ai-oss.net/api/account",
        headers: headers({ cookie: "sb-access-token=session", origin: "https://evil.test" }),
      }),
    ).toMatchObject({ allowed: false, reason: "csrf_protection_required" });

    expect(
      evaluateCsrfRequest({
        method: "POST",
        url: "https://www.ai-oss.net/api/account",
        headers: headers({ cookie: "sb-access-token=session", origin: "https://www.ai-oss.net" }),
      }).reason,
    ).toBe("same_origin");

    const token = "x".repeat(32);
    expect(
      evaluateCsrfRequest({
        method: "PATCH",
        url: "https://www.ai-oss.net/api/account",
        headers: headers({
          cookie: `sb-access-token=session; aioss_csrf=${token}`,
          "x-csrf-token": token,
        }),
      }).reason,
    ).toBe("double_submit_token");
  });

  it("blocks SSRF-prone server-side URLs", () => {
    expect(evaluateServerSideUrl("https://example.com/data.json")).toMatchObject({
      allowed: true,
      normalizedUrl: "https://example.com/data.json",
    });
    for (const value of [
      "file:///etc/passwd",
      "http://localhost:54321",
      "http://127.0.0.1/admin",
      "http://10.0.0.5/admin",
      "http://169.254.169.254/latest/meta-data",
      "http://metadata.google.internal/computeMetadata/v1",
      "http://intranet",
      "https://user:pass@example.com",
    ]) {
      expect(evaluateServerSideUrl(value).allowed, value).toBe(false);
    }
  });

  it("rejects unsafe research paper links before persistence", () => {
    expect(() =>
      buildPaperLinkRows({ ...submission, links: [{ type: "code", url: "http://127.0.0.1:3000" }] }, "paper-1"),
    ).toThrow(/External URL is not allowed/);

    expect(buildPaperLinkRows(submission, "paper-1")[0]).toMatchObject({
      url: "https://example.com/code",
    });
  });

  it("rejects SSRF-prone discussion link posts before persistence", () => {
    expect(() =>
      buildPostInsertRow({
        authorId: "user-1",
        zoneId: "zone-1",
        postType: "link",
        title: "Internal link",
        body: "link body",
        url: "http://169.254.169.254/latest/meta-data",
      }),
    ).toThrow(/valid_http_url_required/);
  });

  it("enforces elevated admin session posture and break-glass monitoring", () => {
    const now = new Date("2026-06-12T12:00:00.000Z");
    expect(
      evaluateAdminSessionSecurity({
        roles: ["security_admin"],
        mfaEnrolled: true,
        stepUpVerifiedAt: "2026-06-12T11:55:00.000Z",
        sessionStartedAt: "2026-06-12T11:45:00.000Z",
        ipRiskScore: 0.1,
        deviceRiskScore: 0.1,
        now,
      }).allowed,
    ).toBe(true);

    expect(
      evaluateAdminSessionSecurity({
        roles: ["super_admin"],
        mfaEnrolled: true,
        stepUpVerifiedAt: "2026-06-12T10:00:00.000Z",
        sessionStartedAt: "2026-06-12T11:45:00.000Z",
        now,
      }).reasons,
    ).toContain("fresh_step_up_required");

    const breakGlass = evaluateAdminSessionSecurity({
      roles: ["owner"],
      breakGlass: true,
      sessionStartedAt: "2026-06-12T11:45:00.000Z",
      now,
    });
    expect(breakGlass).toMatchObject({ allowed: true, auditRequired: true });
    expect(buildBreakGlassMonitorEvent({ actorId: "owner-1", reason: "Emergency incident" }))
      .toMatchObject({
        action: "security.break_glass_used",
        severity: "critical",
        monitoring_required: true,
      });
  });

  it("declares WAF and supply-chain controls without client-exposed secrets", () => {
    expect(VERCEL_WAF_RULES.map((rule) => rule.key)).toEqual(
      expect.arrayContaining(["admin-step-up", "auth-abuse", "research-submit"]),
    );
    expect(SUPPLY_CHAIN_CONTROLS).toEqual(
      expect.arrayContaining(["github_actions_ci_required", "environment_scoped_secrets"]),
    );
    expect(secretEnvExposureIssues(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]))
      .toEqual([]);
    expect(secretEnvExposureIssues(["NEXT_PUBLIC_STRIPE_SECRET_KEY"])).toEqual([
      "NEXT_PUBLIC_STRIPE_SECRET_KEY",
    ]);
  });
});

const submission: ResearchSubmissionInput = {
  submitterId: "user-1",
  identifier: "AIOSS:202606.00042",
  title: "Security Test Paper",
  abstract: "A valid abstract with enough detail for testing security URL validation.",
  authors: [{ name: "Ada Researcher" }],
  submitterRelationship: "Author",
  categories: ["security"],
  license: "cc-by-4.0",
  fullText: "Full paper text.",
  safetyDisclosure: "No identified safety issues.",
  modelDataDisclosure: "No model training performed.",
  reproducibilityChecklist: { code_available: true },
  uploadRightsConfirmed: true,
  notPeerReviewedAcknowledged: true,
  contactPreference: "platform_messages",
  links: [{ type: "code", url: "https://example.com/code" }],
};
