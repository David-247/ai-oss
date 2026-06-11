# Phase 19 — Security Architecture

**Source sections:** §24 Security Architecture (24.1–24.4); completes §3.8 web-security surface.

## Objectives

Harden the platform: web security headers + input/output safety, admin security (MFA/step-up/two-person/break-glass), API security (auth + validation + idempotency + webhook verification), and supply-chain controls — applied across every phase.

## Dependencies
- Phase 04 (authz/step-up/two-person/audit), Phase 14 (rate limits/BotID), Phase 00 (CI supply chain), Phase 05 (Markdown sanitizer). Cross-cuts all feature phases.

## In scope

### Web security (§24.1)
HTTPS only; HSTS; Secure/HttpOnly/SameSite cookies; CSRF protection for mutations; CSP; X-Frame-Options/frame-ancestors; Referrer-Policy; Permissions-Policy; input validation with Zod/Valibot; output sanitization; Markdown sanitization; file-type validation; **SSRF protection for URL fetches**; rate limits; dependency scanning; secret scanning; **no service-role key in browser**; **no raw user HTML**.

### Admin security (§24.2)
MFA/passkey required; step-up auth for high-risk actions; least privilege; session timeout; IP/device risk checks; audit logs; two-person approval for sensitive actions; admin-action reason required; no unaudited impersonation; **break-glass account stored and monitored**.

### API security (§24.3)
Server-side auth check every mutation; authorization policy check every mutation; idempotency keys for payments + critical jobs; request validation; response filtering; pagination caps; abuse throttles; webhook signature verification; signed URLs for uploads/downloads where needed; no secret leakage in logs.

### Supply chain (§24.4)
GitHub branch protection; required PR reviews; CI tests; dependency lockfile; Dependabot/Renovate; secret scanning; SAST; license scanning; production deploys only from protected branch; env vars scoped per environment. (Baseline established in Phase 00; this phase verifies + completes.)

## Out of scope (deferred)
- Security *admin dashboards* → Phase 16. Anti-bot/rate-limit *signal* logic → Phase 14. WAF provisioning → Phase 00 (rules authored here).

## Routes / APIs
- Applies platform-wide: security headers middleware; CSRF + validation layer on all mutations; signed-URL enforcement (Phase 06); webhook verification (Phase 17/02).

## Work items
1. Implement security-headers middleware (HSTS, CSP, frame-ancestors, Referrer-Policy, Permissions-Policy) + cookie flags + HTTPS-only.
2. Enforce Zod/Valibot validation + output sanitization + Markdown sanitization + file-type validation on all inputs; forbid raw user HTML.
3. Implement SSRF protection for all server-side URL fetches (paper links, avatars, external URL reputation checks).
4. Author Vercel WAF custom rules + rate limits for sensitive routes (with Phase 14).
5. Admin security: enforce MFA/passkey for elevated roles, session timeout, IP/device risk checks, break-glass account (stored + monitored), no unaudited impersonation.
6. API security: confirm every mutation passes auth + authorization (Phase 04) + validation; idempotency keys for payments/critical jobs; pagination caps; response filtering; signed URLs; webhook signature verification; secret-free logs.
7. Complete/verify supply-chain controls from Phase 00 (branch protection, SAST, secret + license scanning, scoped env vars).

## Acceptance criteria
- All security headers present; cookies Secure/HttpOnly/SameSite; HTTPS+HSTS enforced.
- Inputs validated; Markdown sanitized; no raw user HTML; SSRF blocked on URL fetches.
- Every mutation enforces server-side auth + authorization; payments/critical jobs idempotent; webhooks signature-verified.
- Elevated admins require MFA/passkey + step-up; impersonation never unaudited; break-glass monitored.
- Supply-chain controls all green in CI; no service-role key in any client bundle.

## Tests (§27.4)
- Security suite: unauthorized admin route access; horizontal privilege escalation; RLS bypass attempts; CSRF; XSS in Markdown; malicious-file upload simulation; webhook signature failure; rate-limit behavior; bot-challenge behavior; private-zone search leakage; private-chat leakage; SSRF attempt.

## Requirement traceability
§3.8, §24; agent rules §29 (#3, #4, #5 — no client service key, no RLS bypass, no unaudited admin actions).
