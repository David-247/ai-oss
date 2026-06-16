import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseStripeSignatureHeader } from "@ai-oss/donations";
import { renderSafeMarkdown } from "@ai-oss/design-system";
import { evaluateSensitiveActionGuard } from "@ai-oss/trust";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("Phase 22 security QA gate", () => {
  it("keeps the §27.4 attack surface represented by executable controls", () => {
    const adminRoute = read("apps/web/src/app/api/admin/route.ts");
    const permissions = read("apps/web/src/lib/permissions-server.ts");
    const searchServer = read("apps/web/src/lib/search-server.ts");
    const searchRoute = read("apps/web/src/app/api/search/route.ts");
    const chatServer = read("apps/web/src/lib/chat-server.ts");
    const middleware = read("apps/web/src/middleware.ts");

    expect(adminRoute).toContain("handleAdminGet");
    expect(permissions).toContain("requirePermissionForRequest");
    expect(permissions).toContain("checkPermission");
    expect(searchRoute).toContain("canReadSearchDocument");
    expect(searchServer).toContain("readableZoneIds");
    expect(chatServer).toContain("loadChatRoomAccess");
    expect(chatServer).toContain("visibility === \"private\"");
    expect(middleware).toContain("evaluateCsrfRequest");
  });

  it("blocks XSS-prone markdown, malformed webhooks, and bot/rate-limited sensitive actions", () => {
    const rendered = renderSafeMarkdown(
      "# Hi\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))",
    );
    expect(rendered.strippedTags).toContain("script");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("javascript:alert");

    expect(parseStripeSignatureHeader("t=1700000000")).toBeNull();
    expect(parseStripeSignatureHeader("v1=abc")).toBeNull();

    const decision = evaluateSensitiveActionGuard({
      action: "post_create",
      trustScore: 10,
      recentActionCount: 99,
      csrfVerified: false,
      botVerified: false,
      botScore: 12,
      accountAgeDays: 0,
      emailVerified: false,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toEqual(
      expect.arrayContaining(["csrf_required", "bot_challenge_required", "action_rate_limited"]),
    );
  });
});
