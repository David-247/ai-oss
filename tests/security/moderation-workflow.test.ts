import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 13 moderation workflow boundaries", () => {
  it("exposes the required moderation API route files", () => {
    const root = resolve("..");
    for (const file of [
      "apps/web/src/app/api/reports/route.ts",
      "apps/web/src/app/api/moderation/route.ts",
      "apps/web/src/app/api/moderation/queue/route.ts",
      "apps/web/src/app/api/moderation/actions/route.ts",
      "apps/web/src/app/api/moderation/appeals/route.ts",
      "apps/web/src/app/api/moderation/automod/test/route.ts",
      "apps/web/src/app/api/moderation/automod/rules/route.ts",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });

  it("centralizes report taxonomy and moderation action validation in the shared package", () => {
    const root = resolve("..");
    const reports = readFileSync(resolve(root, "apps/web/src/app/api/reports/route.ts"), "utf8");
    const actions = readFileSync(
      resolve(root, "apps/web/src/app/api/moderation/actions/route.ts"),
      "utf8",
    );
    const moderationPackage = readFileSync(
      resolve(root, "packages/moderation/src/index.ts"),
      "utf8",
    );

    expect(reports).toContain("buildReportInsertRow");
    expect(actions).toContain("buildModerationActionRow");
    expect(moderationPackage).toContain("child_safety");
    expect(moderationPackage).toContain("dangerous_dual_use");
    expect(moderationPackage).toContain("moderator_action");
  });

  it("requires moderation permissions and audits queue actions, appeals, and AutoMod lifecycle changes", () => {
    const root = resolve("..");
    const helper = readFileSync(resolve(root, "apps/web/src/lib/moderation-server.ts"), "utf8");
    const actions = readFileSync(
      resolve(root, "apps/web/src/app/api/moderation/actions/route.ts"),
      "utf8",
    );
    const appeals = readFileSync(
      resolve(root, "apps/web/src/app/api/moderation/appeals/route.ts"),
      "utf8",
    );
    const rules = readFileSync(
      resolve(root, "apps/web/src/app/api/moderation/automod/rules/route.ts"),
      "utf8",
    );

    expect(helper).toContain('"moderation.read"');
    expect(helper).toContain('"moderation.update"');
    expect(helper).toContain('"moderation.automod_manage"');
    expect(actions).toContain("auditModerationEvent");
    expect(appeals).toContain("isModerationActionAppealable");
    expect(appeals).toContain("buildAppealDecisionPatch");
    expect(rules).toContain("buildAutomodRuleLifecyclePatch");
    expect(rules).toContain("auditModerationEvent");
  });

  it("adds lifecycle, evidence, statement-of-reasons, and run snapshot columns", () => {
    const root = resolve("..");
    const migration = readFileSync(
      resolve(root, "supabase/migrations/20260612011300_phase13_moderation_system.sql"),
      "utf8",
    );

    expect(migration).toContain("rule_key");
    expect(migration).toContain("published_at");
    expect(migration).toContain("evidence jsonb");
    expect(migration).toContain("decision_reason");
    expect(migration).toContain("statement_of_reasons");
    expect(migration).toContain("input_snapshot");
    expect(migration).toContain("automod_runs_zone_status_idx");
  });

  it("keeps global AutoMod enforcement explicit in the engine", () => {
    const root = resolve("..");
    const moderationPackage = readFileSync(
      resolve(root, "packages/moderation/src/index.ts"),
      "utf8",
    );

    expect(moderationPackage).toContain("globalRuleMatched");
    expect(moderationPackage).toContain("blockedWeakeningActions");
    expect(moderationPackage).toContain("platform_global");
  });
});
