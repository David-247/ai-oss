import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 14 trust and anti-abuse route boundaries", () => {
  it("exposes the trust package and safe public reputation API", () => {
    const root = resolve("..");
    expect(existsSync(resolve(root, "packages/trust/src/index.ts"))).toBe(true);
    expect(existsSync(resolve(root, "apps/web/src/app/api/trust/reputation/route.ts"))).toBe(true);

    const route = readFileSync(
      resolve(root, "apps/web/src/app/api/trust/reputation/route.ts"),
      "utf8",
    );
    expect(route).toContain("buildPublicReputation");
    expect(route).not.toContain("risk_score");
    expect(route).not.toContain("user_security_state");
  });

  it("applies the shared sensitive-action gate to required routes", () => {
    const root = resolve("..");
    const routeActions: Array<[string, string]> = [
      ["apps/web/src/app/api/votes/route.ts", "downvote_scale"],
      ["apps/web/src/app/api/zones/route.ts", "zone_create"],
      ["apps/web/src/app/api/posts/route.ts", "post_create"],
      ["apps/web/src/app/api/comments/route.ts", "comment_create"],
      ["apps/web/src/app/api/research/papers/route.ts", "research_upload"],
      ["apps/web/src/app/api/files/upload-url/route.ts", "research_upload"],
      ["apps/web/src/app/api/voice/token/route.ts", "room_join"],
      ["apps/web/src/app/api/voice/rooms/route.ts", "voice_room_create"],
      ["apps/web/src/app/api/reports/route.ts", "mass_report"],
      ["apps/web/src/app/api/account/export/route.ts", "account_delete_export"],
      ["apps/web/src/app/api/account/delete/route.ts", "account_delete_export"],
    ];

    for (const [file, action] of routeActions) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, `${file} should call enforceSensitiveAction`).toContain(
        "enforceSensitiveAction",
      );
      expect(source, `${file} should name ${action}`).toContain(action);
    }
  });

  it("records Postgres-backed rate-limit events and BotID/CSRF checks", () => {
    const root = resolve("..");
    const helper = readFileSync(resolve(root, "apps/web/src/lib/trust-server.ts"), "utf8");

    expect(helper).toContain("abuse_rate_limit_events");
    expect(helper).toContain("TRUST_BOTID_ENFORCEMENT");
    expect(helper).toContain("x-csrf-verified");
    expect(helper).toContain("x-vercel-botid-status");
  });

  it("adds trust, vote certification, governance mitigation, and abuse event schema", () => {
    const root = resolve("..");
    const migration = readFileSync(
      resolve(root, "supabase/migrations/20260612011400_phase14_trust_anti_abuse.sql"),
      "utf8",
    );
    const dbPackage = readFileSync(resolve(root, "packages/db/src/index.ts"), "utf8");

    expect(migration).toContain("risk_score");
    expect(migration).toContain("public_reputation");
    expect(migration).toContain("certification_status");
    expect(migration).toContain("anomaly_reasons");
    expect(migration).toContain("brigading_mitigation");
    expect(migration).toContain("create table if not exists public.abuse_rate_limit_events");
    expect(dbPackage).toContain('"abuse_rate_limit_events"');
    expect(dbPackage).toContain('"certification_status"');
  });

  it("guards the payment exclusion rule in trust scoring source", () => {
    const root = resolve("..");
    const trustPackage = readFileSync(resolve(root, "packages/trust/src/index.ts"), "utf8");

    expect(trustPackage).toContain("excludedSignals");
    expect(trustPackage).toContain("payment_status");
    expect(trustPackage).toContain("donation_total_cents");
    expect(trustPackage).not.toContain("donationTotalCents ?? 0) *");
  });
});
