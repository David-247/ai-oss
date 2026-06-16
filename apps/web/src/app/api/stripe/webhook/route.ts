import { NextResponse } from "next/server";
import type { StripeEventLike } from "@ai-oss/donations";
import { getServiceClientOrProblem, problem } from "@/lib/auth-server";
import {
  recordAndApplyStripeEvent,
  stripeConfigStatus,
  verifyStripeWebhookSignature,
} from "@/lib/stripe-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const config = stripeConfigStatus();
  if (config.webhookSecret.length === 0) {
    return problem(
      503,
      "stripe-webhook-not-configured",
      "Stripe webhook secret is not configured.",
    );
  }

  const verified = verifyStripeWebhookSignature({
    payload,
    signatureHeader: request.headers.get("stripe-signature"),
    secret: config.webhookSecret,
  });
  if (!verified.ok) {
    return problem(400, "stripe-webhook-signature-invalid", verified.reason);
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  let event: StripeEventLike;
  try {
    event = JSON.parse(payload) as StripeEventLike;
  } catch {
    return problem(400, "stripe-webhook-invalid-json", "Stripe webhook payload is not JSON.");
  }

  if (typeof event.id !== "string" || typeof event.type !== "string") {
    return problem(400, "stripe-webhook-invalid-event", "Stripe webhook event is missing id/type.");
  }

  const result = await recordAndApplyStripeEvent(service.client, event);
  if (!result.ok) {
    return problem(500, "stripe-webhook-processing-failed", result.error);
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
