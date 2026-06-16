import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertZoneRoleWithinGlobalPolicy,
  buildGovernanceEvent,
  evaluateZoneCreation,
} from "@ai-oss/zones";

describe("Phase 07 zone governance and safety boundaries", () => {
  it("does not let zone-scoped roles grant global legal/privacy/security powers", () => {
    for (const forbidden of [
      "legal.purge",
      "privacy.delete_execute",
      "security.waf_bypass_update",
      "finance.refund_export",
      "audit.export",
      "system.settings_update",
      "feature_flags.manage",
    ]) {
      expect(() =>
        assertZoneRoleWithinGlobalPolicy("zone_owner_founder", ["zones.update", forbidden]),
      ).toThrow(/cannot grant global policy/i);
    }
  });

  it("blocks suspended users and duplicate slugs at zone creation time", () => {
    expect(
      evaluateZoneCreation({
        userId: "user-1",
        emailVerified: true,
        accountCreatedAt: "2026-05-01T00:00:00.000Z",
        trustScore: 100,
        riskLevel: "suspended",
        slug: "evals",
        name: "Evals",
        rules: ["No spam"],
        slugAvailable: false,
        now: new Date("2026-06-12T00:00:00.000Z"),
      }).reasons,
    ).toEqual(
      expect.arrayContaining(["account_risk_level_blocks_zone_creation", "zone_slug_unavailable"]),
    );
  });

  it("marks community moderator-removal petitions as certification-gated", () => {
    expect(
      buildGovernanceEvent({
        zoneId: "zone-1",
        actorId: "member-1",
        targetUserId: "mod-1",
        action: "community_removal_petition",
        reason: "Repeated off-policy removals",
      }),
    ).toMatchObject({
      requiresCertification: true,
      auditAction: "zones.governance.community_removal_petition",
    });
  });

  it("exposes the required zone API route files and creation kill-switch env var", () => {
    const root = resolve("..");
    for (const file of [
      "apps/web/src/app/api/zones/route.ts",
      "apps/web/src/app/api/zones/[zoneId]/route.ts",
      "apps/web/src/app/api/zones/[zoneId]/members/route.ts",
      "apps/web/src/app/api/zones/[zoneId]/roles/route.ts",
      "apps/web/src/app/api/zones/[zoneId]/moderators/route.ts",
      "apps/web/src/app/api/zones/[zoneId]/governance/actions/route.ts",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }

    expect(readFileSync(resolve(root, ".env.example"), "utf8")).toContain("ZONE_CREATION_PAUSED");
  });
});
