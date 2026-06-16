export const PACKAGE_NAME = "@ai-oss/donations" as const;

export const DONATION_MODES = ["payment", "subscription"] as const;
export type DonationMode = (typeof DONATION_MODES)[number];

export const DONATION_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "charged_back",
  "canceled",
] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const DONATION_AMOUNT_PRESETS_CENTS = [500, 1_000, 2_500, 5_000, 10_000] as const;
export const DONATION_MIN_AMOUNT_CENTS = 100;
export const DONATION_MAX_AMOUNT_CENTS = 500_000;
export const DONATION_DEFAULT_CURRENCY = "usd";
export const DONATION_RECORD_RETENTION_REASON =
  "financial_tax_fraud_chargeback_accounting_obligation" as const;

export const DONATION_NO_INFLUENCE_STATEMENT =
  "Donations do not buy influence, ranking, moderation access, governance power, admin status, or publication priority.";

export const DONATION_TAX_STATUS_STATEMENT =
  "AI-OSS.net does not currently represent donations as tax-deductible charitable contributions; donors should consult their own tax adviser.";

export const DONATION_PRIVILEGE_GUARDRAILS = {
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
} as const;

export interface DonationCheckoutInput {
  amountCents?: unknown;
  amount_cents?: unknown;
  customAmountDollars?: unknown;
  custom_amount_dollars?: unknown;
  currency?: unknown;
  mode?: unknown;
  recurring?: unknown;
  frequency?: unknown;
  anonymous?: unknown;
  donorBadgeOptIn?: unknown;
  donor_badge_opt_in?: unknown;
  userId?: unknown;
  user_id?: unknown;
  receiptEmail?: unknown;
  receipt_email?: unknown;
  metadata?: Record<string, unknown>;
}

export interface NormalizedDonationCheckout {
  amountCents: number;
  currency: string;
  mode: DonationMode;
  anonymous: boolean;
  donorBadgeOptIn: boolean;
  userId: string | null;
  receiptEmail: string | null;
  metadata: Record<string, unknown>;
}

export interface DonationCheckoutSessionInput {
  donationId: string;
  checkout: NormalizedDonationCheckout;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeEventLike {
  id: string;
  type: string;
  created?: number;
  data?: {
    object?: Record<string, unknown>;
  };
}

export interface StripeDonationEventPatch {
  donationId: string | null;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  subscriptionId: string | null;
  patch: Record<string, unknown>;
  eventType: string;
  ignored: boolean;
}

export interface StripeSignatureEnvelope {
  timestamp: number;
  signatures: string[];
}

export function normalizeDonationCheckoutInput(
  input: DonationCheckoutInput,
): NormalizedDonationCheckout {
  const amountCents = normalizeAmountCents(input);
  const currency = normalizeCurrency(input.currency);
  const mode = normalizeMode(input.mode, input.recurring, input.frequency);
  const anonymous = readBoolean(input.anonymous);
  const userId = anonymous ? null : normalizeOptionalText(input.userId ?? input.user_id);
  const donorBadgeOptIn =
    !anonymous && readBoolean(input.donorBadgeOptIn ?? input.donor_badge_opt_in);

  if (donorBadgeOptIn && userId === null) {
    throw new Error("A signed-in user is required for a public donor badge.");
  }

  return {
    amountCents,
    currency,
    mode,
    anonymous,
    donorBadgeOptIn,
    userId,
    receiptEmail: normalizeEmail(input.receiptEmail ?? input.receipt_email),
    metadata: sanitizeMetadata(input.metadata ?? {}),
  };
}

export function buildPendingDonationRow(
  checkout: NormalizedDonationCheckout,
  now: Date = new Date(),
) {
  return {
    user_id: checkout.userId,
    amount_cents: checkout.amountCents,
    currency: checkout.currency,
    status: "pending" as DonationStatus,
    anonymous: checkout.anonymous,
    donor_badge_opt_in: checkout.donorBadgeOptIn,
    mode: checkout.mode,
    receipt_email: checkout.receiptEmail,
    retention_reason: DONATION_RECORD_RETENTION_REASON,
    accounting_metadata: {
      source: "donate_page",
      createdAt: now.toISOString(),
      donationInfluence: "none",
      noInfluenceStatement: DONATION_NO_INFLUENCE_STATEMENT,
      taxStatusStatement: DONATION_TAX_STATUS_STATEMENT,
      privilegeGuardrails: DONATION_PRIVILEGE_GUARDRAILS,
      ...checkout.metadata,
    },
  };
}

export function buildStripeCheckoutSessionParams(input: DonationCheckoutSessionInput) {
  const metadata = {
    donation_id: input.donationId,
    anonymous: String(input.checkout.anonymous),
    donor_badge_opt_in: String(input.checkout.donorBadgeOptIn),
    user_id: input.checkout.userId ?? "",
    mode: input.checkout.mode,
  };
  const params: Record<string, string> = {
    mode: input.checkout.mode,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.donationId,
    submit_type: "donate",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.checkout.currency,
    "line_items[0][price_data][unit_amount]": String(input.checkout.amountCents),
    "line_items[0][price_data][product_data][name]": "AI-OSS.net donation",
    "line_items[0][price_data][product_data][description]":
      "Supports platform operations without buying influence.",
    "metadata[donation_id]": metadata.donation_id,
    "metadata[anonymous]": metadata.anonymous,
    "metadata[donor_badge_opt_in]": metadata.donor_badge_opt_in,
    "metadata[user_id]": metadata.user_id,
    "metadata[mode]": metadata.mode,
    "payment_intent_data[metadata][donation_id]": input.donationId,
    "payment_intent_data[metadata][anonymous]": metadata.anonymous,
    "payment_intent_data[metadata][donor_badge_opt_in]": metadata.donor_badge_opt_in,
    "payment_intent_data[metadata][user_id]": metadata.user_id,
  };

  if (input.checkout.mode === "subscription") {
    params["line_items[0][price_data][recurring][interval]"] = "month";
    params["subscription_data[metadata][donation_id]"] = input.donationId;
    params["subscription_data[metadata][anonymous]"] = metadata.anonymous;
    params["subscription_data[metadata][donor_badge_opt_in]"] = metadata.donor_badge_opt_in;
    params["subscription_data[metadata][user_id]"] = metadata.user_id;
  }

  if (input.checkout.receiptEmail !== null) {
    params.customer_email = input.checkout.receiptEmail;
  }

  return params;
}

export function buildStripeEventRow(event: StripeEventLike) {
  return {
    id: event.id,
    event_type: event.type,
    payload: event,
    processed_at: null,
    processing_error: null,
    donation_id: readStripeDonationId(event),
    idempotency_key: `stripe:${event.id}`,
  };
}

export function donationPatchFromStripeEvent(
  event: StripeEventLike,
  now: Date = new Date(),
): StripeDonationEventPatch {
  const object = event.data?.object ?? {};
  const donationId = readStripeDonationId(event);
  const checkoutSessionId = readString(object.id);
  const paymentIntentId = readString(object.payment_intent);
  const subscriptionId = readString(object.subscription);
  const basePatch = {
    stripe_last_event_id: event.id,
    stripe_last_event_type: event.type,
  };

  if (event.type === "checkout.session.completed") {
    const paymentStatus = readString(object.payment_status);
    return {
      donationId,
      checkoutSessionId,
      paymentIntentId: paymentIntentId || readString(object.payment_intent),
      subscriptionId: subscriptionId || readString(object.subscription),
      eventType: event.type,
      ignored: false,
      patch: {
        ...basePatch,
        stripe_checkout_session_id: checkoutSessionId,
        stripe_customer_id: readString(object.customer) || null,
        stripe_payment_intent_id: paymentIntentId || null,
        stripe_subscription_id: subscriptionId || null,
        amount_cents: readInteger(object.amount_total) ?? undefined,
        currency: normalizeCurrency(object.currency),
        status: paymentStatus === "paid" || paymentStatus === "no_payment_required" ? "succeeded" : "pending",
      },
    };
  }

  if (event.type === "checkout.session.expired") {
    return {
      donationId,
      checkoutSessionId,
      paymentIntentId,
      subscriptionId,
      eventType: event.type,
      ignored: false,
      patch: { ...basePatch, status: "canceled" },
    };
  }

  if (event.type === "payment_intent.succeeded") {
    return {
      donationId,
      checkoutSessionId: null,
      paymentIntentId: checkoutSessionId,
      subscriptionId: null,
      eventType: event.type,
      ignored: false,
      patch: {
        ...basePatch,
        stripe_payment_intent_id: checkoutSessionId,
        amount_cents: readInteger(object.amount_received) ?? undefined,
        currency: normalizeCurrency(object.currency),
        status: "succeeded",
      },
    };
  }

  if (event.type === "payment_intent.payment_failed") {
    return {
      donationId,
      checkoutSessionId: null,
      paymentIntentId: checkoutSessionId,
      subscriptionId: null,
      eventType: event.type,
      ignored: false,
      patch: {
        ...basePatch,
        stripe_payment_intent_id: checkoutSessionId,
        status: "failed",
        failure_code: readNestedString(object.last_payment_error, "code") || "payment_failed",
      },
    };
  }

  if (event.type === "charge.refunded") {
    return {
      donationId,
      checkoutSessionId: null,
      paymentIntentId,
      subscriptionId: null,
      eventType: event.type,
      ignored: false,
      patch: {
        ...basePatch,
        status: "refunded",
        refunded_at: now.toISOString(),
      },
    };
  }

  if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
    return {
      donationId,
      checkoutSessionId: null,
      paymentIntentId,
      subscriptionId: null,
      eventType: event.type,
      ignored: false,
      patch: {
        ...basePatch,
        status: "charged_back",
        chargeback_status: readString(object.status) || "opened",
      },
    };
  }

  if (event.type === "customer.subscription.deleted") {
    return {
      donationId,
      checkoutSessionId: null,
      paymentIntentId: null,
      subscriptionId: checkoutSessionId,
      eventType: event.type,
      ignored: false,
      patch: {
        ...basePatch,
        status: "canceled",
        stripe_subscription_id: checkoutSessionId,
      },
    };
  }

  return {
    donationId,
    checkoutSessionId: null,
    paymentIntentId: null,
    subscriptionId: null,
    patch: basePatch,
    eventType: event.type,
    ignored: true,
  };
}

export function shouldIssueDonorBadge(donation: {
  user_id?: unknown;
  anonymous?: unknown;
  donor_badge_opt_in?: unknown;
  status?: unknown;
}) {
  return (
    readString(donation.user_id).length > 0 &&
    !readBoolean(donation.anonymous) &&
    readBoolean(donation.donor_badge_opt_in) &&
    donation.status === "succeeded"
  );
}

export function buildDonorBadgeProfilePatch(now: Date = new Date()) {
  return {
    donor_badge_visible: true,
    updated_at: now.toISOString(),
  };
}

export function buildDonorBadgeDonationPatch(now: Date = new Date()) {
  return {
    donor_badge_issued_at: now.toISOString(),
  };
}

export function donationGrantsNoPrivileges() {
  return { ...DONATION_PRIVILEGE_GUARDRAILS };
}

export function buildAccountingExportRow(input: {
  id: string;
  amount_cents: number;
  currency: string;
  status: DonationStatus;
  anonymous: boolean;
  mode?: DonationMode;
  created_at?: string;
  updated_at?: string;
}) {
  return {
    donationId: input.id,
    amountCents: Math.trunc(input.amount_cents),
    currency: normalizeCurrency(input.currency),
    status: input.status,
    anonymous: input.anonymous,
    mode: input.mode ?? "payment",
    retentionReason: DONATION_RECORD_RETENTION_REASON,
    privilegeGuardrails: DONATION_PRIVILEGE_GUARDRAILS,
    createdAt: input.created_at ?? null,
    updatedAt: input.updated_at ?? null,
  };
}

export function parseStripeSignatureHeader(header: string | null): StripeSignatureEnvelope | null {
  if (header === null || header.trim().length === 0) {
    return null;
  }

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") {
      const parsed = Number(value);
      timestamp = Number.isFinite(parsed) ? parsed : null;
    }
    if (key === "v1" && value !== undefined && value.length > 0) {
      signatures.push(value);
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

export function stripeWebhookSignedPayload(payload: string, timestamp: number): string {
  return `${timestamp}.${payload}`;
}

export function readStripeDonationId(event: StripeEventLike): string | null {
  const object = event.data?.object ?? {};
  const metadata = isRecord(object.metadata) ? object.metadata : {};
  const donationId = normalizeOptionalText(
    metadata.donation_id ?? object.client_reference_id ?? object.donation_id,
  );
  return donationId;
}

function normalizeAmountCents(input: DonationCheckoutInput): number {
  const customAmount = readDollarAmount(input.customAmountDollars ?? input.custom_amount_dollars);
  const rawAmountCents =
    customAmount ?? readInteger(input.amountCents ?? input.amount_cents) ?? DONATION_AMOUNT_PRESETS_CENTS[1];
  if (rawAmountCents < DONATION_MIN_AMOUNT_CENTS || rawAmountCents > DONATION_MAX_AMOUNT_CENTS) {
    throw new Error(
      `Donation amount must be between ${DONATION_MIN_AMOUNT_CENTS} and ${DONATION_MAX_AMOUNT_CENTS} cents.`,
    );
  }
  return rawAmountCents;
}

function normalizeCurrency(value: unknown): string {
  const currency = readString(value || DONATION_DEFAULT_CURRENCY).toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new Error("Donation currency must be a three-letter ISO code.");
  }
  return currency;
}

function normalizeMode(mode: unknown, recurring: unknown, frequency: unknown): DonationMode {
  const raw = readString(mode || frequency).toLowerCase();
  if (raw === "subscription" || raw === "recurring" || raw === "monthly") {
    return "subscription";
  }
  if (readBoolean(recurring)) {
    return "subscription";
  }
  return "payment";
}

function normalizeEmail(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (text === null) {
    return null;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null;
}

function normalizeOptionalText(value: unknown): string | null {
  const text = readString(value);
  return text.length > 0 ? text : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1" || value === 1;
}

function readInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
}

function readDollarAmount(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function readNestedString(value: unknown, key: string): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return normalizeOptionalText(value[key]);
}

function sanitizeMetadata(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => /^[a-zA-Z0-9_.:-]{1,80}$/.test(key))
      .slice(0, 50),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
