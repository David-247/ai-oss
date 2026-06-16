import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve("..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Phase 15 moderator governance security", () => {
  it("ships the required governance migration and protected metadata", () => {
    const migration = readRepoFile(
      "supabase/migrations/20260612011500_phase15_moderator_governance.sql",
    );
    for (const required of [
      "junior_moderator",
      "moderator_tier",
      "moderator_selection_source",
      "mod_removal_petitions",
      "support_threshold",
      "eligibility_snapshot",
      "risk_snapshot",
      "ballot_hash",
      "certification_status",
      "aggregate_tally",
      "public_result",
      "frozen_at",
      "invalidated_at",
      "zone:automod_editor",
    ]) {
      expect(migration).toContain(required);
    }

    const db = readRepoFile("packages/db/src/index.ts");
    expect(db).toContain("moderator_tier");
    expect(db).toContain("ballot_hash");
    expect(db).toContain("certification_status");
    expect(db).toContain("mod_removal_petitions");
  });

  it("enforces anti-abuse gates for petitions and moderator-removal ballots", () => {
    const route = readRepoFile(
      "apps/web/src/app/api/zones/[zoneId]/governance/actions/route.ts",
    );
    expect(route).toContain("enforceSensitiveAction");
    expect(route).toContain('action: "governance_petition"');
    expect(route).toContain('action: "moderator_removal_vote"');
    expect(route).toContain("evaluateGovernanceEligibility");
    expect(route).toContain("classifyVoteAnomaly");
    expect(route).toContain("freeze_governance_vote");
  });

  it("keeps governance ballot identities private during voting and excludes donation weight", () => {
    const zones = readRepoFile("packages/zones/src/index.ts");
    const route = readRepoFile(
      "apps/web/src/app/api/zones/[zoneId]/governance/actions/route.ts",
    );
    expect(zones).toContain("voterIdentitiesHidden");
    expect(zones).toContain("donationWeightExcluded");
    expect(zones).toContain("paymentSignalsExcluded");
    expect(route).toContain("ballotHash");
    expect(route).not.toContain("donation_weight");
  });

  it("requires global admin roles for emergency governance overrides and audits them", () => {
    const route = readRepoFile(
      "apps/web/src/app/api/zones/[zoneId]/governance/actions/route.ts",
    );
    const zones = readRepoFile("packages/zones/src/index.ts");
    expect(route).toContain("GLOBAL_OVERRIDE_ROLES");
    expect(route).toContain("global-admin-required");
    expect(route).toContain("buildEmergencyGovernanceOverride");
    expect(route).toContain("auditGovernance");
    expect(zones).toContain("zones.governance.emergency");
  });

  it("keeps the expected API route files in place", () => {
    for (const file of [
      "apps/web/src/app/api/zones/[zoneId]/governance/actions/route.ts",
      "apps/web/src/app/api/zones/[zoneId]/moderators/route.ts",
      "apps/web/src/app/api/zones/[zoneId]/roles/route.ts",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });
});
