import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@ai-oss/auth";
import {
  buildDonorBadgeDonationPatch,
  buildDonorBadgeProfilePatch,
  buildStripeCheckoutSessionParams,
  buildStripeEventRow,
  donationPatchFromStripeEvent,
  parseStripeSignatureHeader,
  shouldIssueDonorBadge,
  stripeWebhookSignedPayload,
  type NormalizedDonationCheckout,
  type StripeEventLike,
} from "@ai-oss/donations";
import { problem } from "@/lib/auth-server";

export interface StripeCheckoutSessionResult {
  id: string;
  url: string;
}

export function stripeConfigStatus(env: NodeJS.ProcessEnv = process.env) {
  return {
    secretKey: env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
    siteUrl: env.NEXT_PUBLIC_SITE_URL ?? "",
  };
}

export async function createStripeCheckoutSession(input: {
  secretKey: string;
  donationId: string;
  checkout: NormalizedDonationCheckout;
  origin: string;
}): Promise<{ ok: true; session: StripeCheckoutSessionResult } | { ok: false; response: NextResponse }> {
  if (!input.secretKey.startsWith("sk_")) {
    return {
      ok: false,
      response: problem(503, "stripe-not-configured", "Stripe secret key is not configured."),
    };
  }

  const successUrl = `${input.origin}/donate?donation=${encodeURIComponent(input.donationId)}&status=success`;
  const cancelUrl = `${input.origin}/donate?donation=${encodeURIComponent(input.donationId)}&status=canceled`;
  const params = new URLSearchParams(
    buildStripeCheckoutSessionParams({
      donationId: input.donationId,
      checkout: input.checkout,
      successUrl,
      cancelUrl,
    }),
  );

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `donation_checkout_${input.donationId}`,
    },
    body: params,
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok || payload === null) {
    return {
      ok: false,
      response: problem(
        502,
        "stripe-checkout-failed",
        readStripeError(payload) ?? "Stripe checkout session creation failed.",
      ),
    };
  }

  const id = typeof payload.id === "string" ? payload.id : "";
  const url = typeof payload.url === "string" ? payload.url : "";
  if (id.length === 0 || url.length === 0) {
    return {
      ok: false,
      response: problem(502, "stripe-checkout-invalid", "Stripe returned an invalid session."),
    };
  }

  return { ok: true, session: { id, url } };
}

export function verifyStripeWebhookSignature(input: {
  payload: string;
  signatureHeader: string | null;
  secret: string;
  now?: Date;
  toleranceSeconds?: number;
}) {
  if (!input.secret.startsWith("whsec_")) {
    return { ok: false as const, reason: "webhook_secret_not_configured" };
  }

  const envelope = parseStripeSignatureHeader(input.signatureHeader);
  if (envelope === null) {
    return { ok: false as const, reason: "missing_or_invalid_signature" };
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - envelope.timestamp) > toleranceSeconds) {
    return { ok: false as const, reason: "signature_timestamp_outside_tolerance" };
  }

  const expected = createHmac("sha256", input.secret)
    .update(stripeWebhookSignedPayload(input.payload, envelope.timestamp), "utf8")
    .digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const matched = envelope.signatures.some((signature) => {
    const actualBytes = Buffer.from(signature, "hex");
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
  });

  return matched
    ? { ok: true as const }
    : { ok: false as const, reason: "signature_mismatch" };
}

export async function recordAndApplyStripeEvent(
  client: SupabaseClient,
  event: StripeEventLike,
) {
  const row = buildStripeEventRow(event);
  const inserted = await client.from("stripe_events").insert(row).select("id").single();
  if (inserted.error !== null) {
    if (isDuplicateError(inserted.error)) {
      return { ok: true as const, duplicate: true, ignored: false, applied: false };
    }
    return { ok: false as const, error: inserted.error.message };
  }

  const applied = await applyStripeDonationEvent(client, event);
  const eventPatch = applied.ok
    ? { processed_at: new Date().toISOString(), processing_error: null }
    : { processed_at: null, processing_error: applied.error };
  await client.from("stripe_events").update(eventPatch).eq("id", event.id);

  if (!applied.ok) {
    return applied;
  }

  return {
    ok: true as const,
    duplicate: false,
    ignored: applied.ignored,
    applied: applied.applied,
    donationId: applied.donationId,
    donorBadgeIssued: applied.donorBadgeIssued,
  };
}

async function applyStripeDonationEvent(client: SupabaseClient, event: StripeEventLike) {
  const eventPatch = donationPatchFromStripeEvent(event);
  if (eventPatch.ignored) {
    return {
      ok: true as const,
      ignored: true,
      applied: false,
      donationId: eventPatch.donationId,
      donorBadgeIssued: false,
    };
  }

  const patch = compactPatch(eventPatch.patch);
  const query = buildDonationUpdateQuery(client, eventPatch, patch);
  if (query === null) {
    return { ok: false as const, error: "Stripe event did not include a donation identifier." };
  }

  const result = await query.select("id,user_id,anonymous,donor_badge_opt_in,status").maybeSingle();
  if (result.error !== null) {
    return { ok: false as const, error: result.error.message };
  }
  if (result.data === null) {
    return {
      ok: true as const,
      ignored: false,
      applied: false,
      donationId: eventPatch.donationId,
      donorBadgeIssued: false,
    };
  }

  let donorBadgeIssued = false;
  if (shouldIssueDonorBadge(result.data)) {
    const now = new Date();
    await client
      .from("profiles")
      .update(buildDonorBadgeProfilePatch(now))
      .eq("id", result.data.user_id);
    await client
      .from("donations")
      .update(buildDonorBadgeDonationPatch(now))
      .eq("id", result.data.id);
    donorBadgeIssued = true;
  }

  return {
    ok: true as const,
    ignored: false,
    applied: true,
    donationId: String(result.data.id),
    donorBadgeIssued,
  };
}

function buildDonationUpdateQuery(
  client: SupabaseClient,
  eventPatch: ReturnType<typeof donationPatchFromStripeEvent>,
  patch: Record<string, unknown>,
) {
  const base = client.from("donations").update(patch);
  if (eventPatch.donationId !== null) {
    return base.eq("id", eventPatch.donationId);
  }
  if (eventPatch.checkoutSessionId !== null && eventPatch.checkoutSessionId.length > 0) {
    return base.eq("stripe_checkout_session_id", eventPatch.checkoutSessionId);
  }
  if (eventPatch.paymentIntentId !== null && eventPatch.paymentIntentId.length > 0) {
    return base.eq("stripe_payment_intent_id", eventPatch.paymentIntentId);
  }
  if (eventPatch.subscriptionId !== null && eventPatch.subscriptionId.length > 0) {
    return base.eq("stripe_subscription_id", eventPatch.subscriptionId);
  }
  return null;
}

function compactPatch(patch: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

function readStripeError(payload: Record<string, unknown> | null): string | null {
  const error = payload?.error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }
  return null;
}

function isDuplicateError(error: { code?: string; message?: string }) {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}
