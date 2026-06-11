# Phase 17 — Donations

**Source sections:** §3.7 Payments/Donations Decision, §13 Donations (13.1–13.3); supports REQ-CORE-010.

## Objectives

Deliver Stripe-backed donations (one-time + optional recurring, with anonymous + opt-in donor badge), verified idempotent webhooks, finance tooling, and ironclad enforcement that donations buy **zero** influence.

## Dependencies
- Phase 04 (audit), Phase 02 (idempotent webhook jobs), Phase 16 (donations admin), Phase 01 (`donations`, `stripe_events`). Stripe provisioned in Phase 00.

## In scope

### Decision (§3.7)
- Donations use **Stripe via Vercel Marketplace**. One-time MUST be supported; recurring SHOULD be supported; donor badges MAY show if donor opts in; anonymous donations MUST be supported. Donation status MUST NOT grant moderation/governance/ranking/voting/search/admin/review privileges. Stripe webhooks verified server-side. Payment records retained only as needed for financial/tax/fraud/chargeback/accounting obligations.

### Donation UX (§13.1) — `/donate` MUST show
Mission statement; what donations fund; one-time donation; optional recurring; amount presets; custom amount; anonymous option; public donor-badge option; clear "donations do not buy influence" statement; tax-deductibility status statement; contact/support link.

### Donation backend (§13.2) — MUST include
Stripe Checkout or Payment Element; server-created checkout sessions; webhook signature verification; idempotent webhook handling; donation records; refund/chargeback handling; donor-badge issuance only after successful payment; finance/admin panel (Phase 16); export for accounting.

### Donation restrictions (§13.3) — donations MUST NOT
Increase vote weight; increase research ranking; bypass moderation; grant moderator status; grant admin status; hide policy violations; reduce rate limits for governance; allow "pay to publish."

## Out of scope (deferred)
- Donations admin UI surfaces → Phase 16 (this phase exposes the data/services). Trust-score exclusion of payment status → Phase 14 (enforced there too).

## Data model
`donations` (user nullable, stripe ids, amount_cents, currency, status, anonymous, donor_badge_opt_in), `stripe_events` (id, type, payload, processed_at).

## Routes / APIs
- Pages: `/donate`.
- APIs: `/api/stripe/checkout`, `/api/stripe/webhook`.

## Work items
1. Build `/donate` page with all §13.1 elements incl. explicit no-influence + tax-status statements.
2. Server-created Stripe Checkout/Payment Element sessions (`/api/stripe/checkout`) for one-time + optional recurring.
3. Webhook handler (`/api/stripe/webhook`) with signature verification + idempotent processing (Phase 02), persisting `stripe_events` + `donations`.
4. Donor-badge issuance only after successful payment + donor opt-in; anonymous donations supported.
5. Refund/chargeback handling; accounting export; finance data for Phase 16.
6. Hard guardrails: donation status excluded from every privilege/ranking/rate-limit/moderation/governance path (assert in code + tests).
7. Retention limited to financial/tax/fraud/chargeback/accounting needs.

## Acceptance criteria
- One-time donations work end-to-end; recurring works where enabled; anonymous donations supported.
- Webhooks are signature-verified and idempotent (replay causes no double effects).
- Donor badge issued only after successful payment + opt-in.
- Verified: donation status grants no vote weight, ranking boost, moderation bypass, mod/admin status, governance rate-limit reduction, or pay-to-publish.

## Tests (§27.1, §27.2, §27.3, §27.4)
- Unit: webhook idempotency.
- Integration: donation checkout/webhook.
- E2E: donation flow.
- Security: webhook signature failure rejected; donation-grants-no-privilege assertions.

## Requirement traceability
REQ-CORE-010; §3.7, §13; agent rule §29 (#6 — donation status never affects governance/ranking).
