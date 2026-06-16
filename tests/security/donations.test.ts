import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve("..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Phase 17 donation security", () => {
  it("ships the required donation page UX and public guardrail copy", () => {
    const page = readRepoFile("apps/web/src/app/donate/page.tsx");
    for (const required of [
      "Donate to AI-OSS.net",
      "hosting",
      "security",
      "moderation tooling",
      "DONATION_AMOUNT_PRESETS_CENTS",
      "custom_amount_dollars",
      "subscription",
      "anonymous",
      "donor_badge_opt_in",
      "DONATION_NO_INFLUENCE_STATEMENT",
      "DONATION_TAX_STATUS_STATEMENT",
      "support@ai-oss.net",
    ]) {
      expect(page).toContain(required);
    }
  });

  it("implements checkout and webhook routes with Stripe-owned server state", () => {
    const checkout = readRepoFile("apps/web/src/app/api/stripe/checkout/route.ts");
    const webhook = readRepoFile("apps/web/src/app/api/stripe/webhook/route.ts");
    const stripeServer = readRepoFile("apps/web/src/lib/stripe-server.ts");
    expect(checkout).not.toContain("notImplemented");
    expect(checkout).toContain("buildPendingDonationRow");
    expect(checkout).toContain("createStripeCheckoutSession");
    expect(checkout).toContain("status: \"failed\"");
    expect(webhook).toContain("request.text()");
    expect(webhook).toContain("stripe-signature");
    expect(webhook).toContain("verifyStripeWebhookSignature");
    expect(webhook).toContain("recordAndApplyStripeEvent");
    expect(stripeServer).toContain("createHmac");
    expect(stripeServer).toContain("timingSafeEqual");
    expect(stripeServer).toContain("stripe_events");
    expect(stripeServer).toContain("isDuplicateError");
    expect(stripeServer).toContain("shouldIssueDonorBadge");
  });

  it("adds donation persistence metadata for webhooks, accounting, refunds, and chargebacks", () => {
    const migration = readRepoFile("supabase/migrations/20260612011700_phase17_donations.sql");
    const db = readRepoFile("packages/db/src/index.ts");
    for (const required of [
      "checkout_url",
      "donor_badge_issued_at",
      "retention_reason",
      "accounting_exported_at",
      "failure_code",
      "chargeback_status",
      "idempotency_key",
    ]) {
      expect(migration).toContain(required);
      expect(db).toContain(required);
    }
    expect(migration).toContain("stripe_events_idempotency_key_idx");
  });

  it("keeps donation status out of voting, ranking, moderation, governance, and publish privilege paths", () => {
    const donations = readRepoFile("packages/donations/src/index.ts");
    const trust = readRepoFile("packages/trust/src/index.ts");
    const zones = readRepoFile("packages/zones/src/index.ts");
    const votesRoute = readRepoFile("apps/web/src/app/api/votes/route.ts");
    const papersRoute = readRepoFile("apps/web/src/app/api/research/papers/route.ts");

    expect(donations).toContain("voteWeight: 1");
    expect(donations).toContain("researchRankingBoost: 0");
    expect(donations).toContain("moderationBypass: false");
    expect(donations).toContain("moderatorStatusGranted: false");
    expect(donations).toContain("adminStatusGranted: false");
    expect(donations).toContain("governanceRateLimitReduction: 0");
    expect(donations).toContain("payToPublish: false");
    expect(trust).toContain("donation_total_cents");
    expect(zones).toContain("donationSignalsExcluded");
    expect(zones).toContain("donationWeightExcluded");
    expect(votesRoute).not.toContain("donation");
    expect(papersRoute).not.toContain("donation");
  });

  it("exposes expected Phase 17 files", () => {
    for (const file of [
      "packages/donations/src/index.ts",
      "apps/web/src/app/donate/page.tsx",
      "apps/web/src/app/api/stripe/checkout/route.ts",
      "apps/web/src/app/api/stripe/webhook/route.ts",
      "apps/web/src/lib/stripe-server.ts",
      "supabase/migrations/20260612011700_phase17_donations.sql",
    ]) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });
});
