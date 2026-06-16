import { NextResponse } from "next/server";
import {
  buildPendingDonationRow,
  normalizeDonationCheckoutInput,
  type DonationCheckoutInput,
} from "@ai-oss/donations";
import { getServiceClientOrProblem, problem, requireAuthenticatedUser } from "@/lib/auth-server";
import { isRecord, readRequestBody } from "@/lib/permissions-server";
import { createStripeCheckoutSession, stripeConfigStatus } from "@/lib/stripe-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readRequestBody(request);
  if (!isRecord(body)) {
    return problem(400, "invalid-donation-checkout", "Expected a JSON or form donation body.");
  }

  const wantsPublicBadge = body.donor_badge_opt_in === "true" || body.donorBadgeOptIn === true;
  let userId: string | null = null;
  if (wantsPublicBadge && body.anonymous !== "true" && body.anonymous !== true) {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    userId = auth.user.id;
  }

  let checkout;
  try {
    checkout = normalizeDonationCheckoutInput({
      ...(body as DonationCheckoutInput),
      userId,
      metadata: { requestPath: "/api/stripe/checkout" },
    });
  } catch (error) {
    return problem(
      400,
      "invalid-donation-checkout",
      error instanceof Error ? error.message : "Donation checkout input is invalid.",
    );
  }

  const service = getServiceClientOrProblem();
  if (!service.ok) {
    return service.response;
  }

  const config = stripeConfigStatus();
  const inserted = await service.client
    .from("donations")
    .insert(buildPendingDonationRow(checkout))
    .select("id")
    .single();
  if (inserted.error !== null || inserted.data === null) {
    return problem(
      500,
      "donation-record-failed",
      inserted.error?.message ?? "Donation record could not be created.",
    );
  }

  const origin = resolveOrigin(request, config.siteUrl);
  const session = await createStripeCheckoutSession({
    secretKey: config.secretKey,
    donationId: String(inserted.data.id),
    checkout,
    origin,
  });
  if (!session.ok) {
    await service.client
      .from("donations")
      .update({ status: "failed", failure_code: "stripe_checkout_failed" })
      .eq("id", inserted.data.id);
    return session.response;
  }

  await service.client
    .from("donations")
    .update({
      stripe_checkout_session_id: session.session.id,
      checkout_url: session.session.url,
    })
    .eq("id", inserted.data.id);

  return NextResponse.json(
    {
      ok: true,
      donationId: inserted.data.id,
      checkoutSessionId: session.session.id,
      url: session.session.url,
      influence: "none",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function resolveOrigin(request: Request, configuredSiteUrl: string) {
  if (configuredSiteUrl.length > 0) {
    return configuredSiteUrl.replace(/\/+$/g, "");
  }
  return new URL(request.url).origin;
}
