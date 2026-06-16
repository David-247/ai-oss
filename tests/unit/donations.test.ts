import { describe, expect, it } from "vitest";
import {
  DONATION_NO_INFLUENCE_STATEMENT,
  buildAccountingExportRow,
  buildPendingDonationRow,
  buildStripeCheckoutSessionParams,
  buildStripeEventRow,
  donationGrantsNoPrivileges,
  donationPatchFromStripeEvent,
  normalizeDonationCheckoutInput,
  parseStripeSignatureHeader,
  shouldIssueDonorBadge,
  stripeWebhookSignedPayload,
} from "@ai-oss/donations";

describe("Phase 17 donations", () => {
  it("normalizes checkout requests for one-time, recurring, custom, anonymous, and badge donations", () => {
    expect(
      normalizeDonationCheckoutInput({
        amount_cents: "2500",
        mode: "payment",
        anonymous: "false",
        donor_badge_opt_in: "true",
        userId: "user-1",
        receipt_email: "donor@example.com",
      }),
    ).toMatchObject({
      amountCents: 2500,
      currency: "usd",
      mode: "payment",
      anonymous: false,
      donorBadgeOptIn: true,
      userId: "user-1",
      receiptEmail: "donor@example.com",
    });

    expect(
      normalizeDonationCheckoutInput({
        amount_cents: "500",
        custom_amount_dollars: "42",
        mode: "subscription",
        anonymous: "true",
        donor_badge_opt_in: "true",
        userId: "user-1",
      }),
    ).toMatchObject({
      amountCents: 4200,
      mode: "subscription",
      anonymous: true,
      donorBadgeOptIn: false,
      userId: null,
    });

    expect(() =>
      normalizeDonationCheckoutInput({ donor_badge_opt_in: "true", anonymous: "false" }),
    ).toThrow(/signed-in user/i);
  });

  it("builds pending records and Stripe Checkout params without granting influence", () => {
    const checkout = normalizeDonationCheckoutInput({
      amount_cents: "1000",
      mode: "subscription",
      donor_badge_opt_in: "true",
      userId: "user-1",
    });
    const row = buildPendingDonationRow(checkout, new Date("2026-06-12T00:00:00.000Z"));
    const params = buildStripeCheckoutSessionParams({
      donationId: "donation-1",
      checkout,
      successUrl: "https://example.test/success",
      cancelUrl: "https://example.test/cancel",
    });

    expect(row).toMatchObject({
      user_id: "user-1",
      amount_cents: 1000,
      status: "pending",
      mode: "subscription",
      retention_reason: "financial_tax_fraud_chargeback_accounting_obligation",
    });
    expect(JSON.stringify(row.accounting_metadata)).toContain(DONATION_NO_INFLUENCE_STATEMENT);
    expect(params).toMatchObject({
      mode: "subscription",
      "line_items[0][price_data][recurring][interval]": "month",
      "metadata[donation_id]": "donation-1",
      "metadata[donor_badge_opt_in]": "true",
    });
  });

  it("derives webhook donation patches and badge eligibility only after success plus opt-in", () => {
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          customer: "cus_1",
          payment_intent: "pi_1",
          amount_total: 2500,
          currency: "usd",
          payment_status: "paid",
          metadata: { donation_id: "donation-1", donor_badge_opt_in: "true" },
        },
      },
    };
    const patch = donationPatchFromStripeEvent(event, new Date("2026-06-12T00:00:00.000Z"));

    expect(patch).toMatchObject({
      donationId: "donation-1",
      checkoutSessionId: "cs_1",
      paymentIntentId: "pi_1",
      ignored: false,
      patch: {
        stripe_checkout_session_id: "cs_1",
        stripe_payment_intent_id: "pi_1",
        amount_cents: 2500,
        status: "succeeded",
      },
    });
    expect(
      shouldIssueDonorBadge({
        user_id: "user-1",
        anonymous: false,
        donor_badge_opt_in: true,
        status: "succeeded",
      }),
    ).toBe(true);
    expect(
      shouldIssueDonorBadge({
        user_id: "user-1",
        anonymous: true,
        donor_badge_opt_in: true,
        status: "succeeded",
      }),
    ).toBe(false);
  });

  it("handles refund, chargeback, accounting export, and webhook idempotency rows", () => {
    expect(
      donationPatchFromStripeEvent({
        id: "evt_refund",
        type: "charge.refunded",
        data: { object: { payment_intent: "pi_1", metadata: { donation_id: "donation-1" } } },
      }).patch,
    ).toMatchObject({ status: "refunded" });
    expect(
      donationPatchFromStripeEvent({
        id: "evt_dispute",
        type: "charge.dispute.created",
        data: { object: { payment_intent: "pi_1", status: "needs_response" } },
      }).patch,
    ).toMatchObject({ status: "charged_back", chargeback_status: "needs_response" });
    expect(buildStripeEventRow({ id: "evt_1", type: "checkout.session.completed" })).toMatchObject(
      {
        id: "evt_1",
        idempotency_key: "stripe:evt_1",
        processed_at: null,
      },
    );
    expect(
      buildAccountingExportRow({
        id: "donation-1",
        amount_cents: 500,
        currency: "usd",
        status: "succeeded",
        anonymous: true,
      }),
    ).toMatchObject({
      donationId: "donation-1",
      retentionReason: "financial_tax_fraud_chargeback_accounting_obligation",
    });
  });

  it("parses Stripe webhook signatures and asserts donations grant no privileges", () => {
    expect(parseStripeSignatureHeader("t=1780000000,v1=abc,v1=def")).toEqual({
      timestamp: 1780000000,
      signatures: ["abc", "def"],
    });
    expect(stripeWebhookSignedPayload("{\"id\":\"evt_1\"}", 1780000000)).toBe(
      '1780000000.{"id":"evt_1"}',
    );
    expect(donationGrantsNoPrivileges()).toEqual({
      voteWeight: 1,
      researchRankingBoost: 0,
      searchRankingBoost: 0,
      moderationBypass: false,
      moderatorStatusGranted: false,
      adminStatusGranted: false,
      reviewPrivilegeGranted: false,
      policyViolationHidden: false,
      governanceRateLimitReduction: 0,
      payToPublish: false,
    });
  });
});
