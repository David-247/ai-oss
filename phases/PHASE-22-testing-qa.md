# Phase 22 — Testing & QA

**Source sections:** §27 Testing Requirements (27.1–27.5).

## Objectives

Deliver the full automated test suite — unit, integration, end-to-end (desktop + mobile), security, and compliance — providing the evidence base for the launch acceptance gate (Phase 23). Per §29 #10, privacy/permissions/moderation-sensitive changes always ship with tests.

## Dependencies
- Every feature/cross-cutting phase (the systems under test). Test harness folders from Phase 00 (`tests/{e2e,integration,security,rls}/`).

## In scope

### Unit tests (§27.1) — MUST cover
Permission checks; AutoMod rule parsing; AutoMod matching; vote uniqueness; ranking functions; trust-score updates; privacy-export serialization; account deletion/anonymization; webhook idempotency; research versioning.

### Integration tests (§27.2) — MUST cover
Signup/login/delete; zone creation; post/comment/vote; research submission/publish/version; file scan workflow; chat room join/message; voice token creation; moderation action/appeal; moderator removal vote; donation checkout/webhook; RLS policies.

### End-to-end tests (§27.3) — desktop + mobile flows
New-user onboarding; create zone; create post; comment and vote; submit paper; review paper; join chat; start voice room; report content; moderator queue action; appeal action; admin role grant; account export; account deletion; donation.

### Security tests (§27.4) — MUST cover
Unauthorized admin route access; horizontal privilege escalation; RLS bypass attempts; CSRF; XSS in Markdown; upload malicious-file simulation; webhook signature failure; rate-limit behavior; bot-challenge behavior; private-zone search leakage; private-chat leakage.

### Compliance tests (§27.5) — MUST cover
Cookie-consent behavior; privacy-export due-date tracking; deletion/anonymization; DMCA notice workflow; DSA report+appeal flow; OSA report/redress flow; consent-record versioning; terms-acceptance versioning.

## Out of scope (deferred)
- Performance budget tests → Phase 21 (referenced in launch gate). Counsel review → Phase 23.

## Work items
1. Build unit suite covering every §27.1 item (esp. permissions, AutoMod, voting/ranking, trust, privacy, versioning, webhook idempotency).
2. Build integration suite covering every §27.2 flow incl. RLS policy verification (consolidating Phase 01 `tests/rls/`).
3. Build E2E suite (Playwright/Cypress) covering every §27.3 flow on **both** desktop and mobile viewports.
4. Build security suite covering every §27.4 attack/abuse case.
5. Build compliance suite covering every §27.5 regulatory flow.
6. Wire all suites into CI as merge + release gates; produce a coverage/traceability report mapping tests → architecture requirements.

## Acceptance criteria
- All five suites exist and pass; every §27.1–§27.5 item has a corresponding passing test.
- E2E flows pass on desktop and mobile.
- CI blocks merges on failing tests; release gate requires green suites.
- Traceability report links each test to its architecture requirement ID.

## Tests
This phase IS the test deliverable; it provides evidence for Phase 23 acceptance items (RLS tests pass, E2E core flows pass, security/compliance pass).

## Requirement traceability
§27; acceptance items §28 #22–#24; agent rule §29 (#10 — always test privacy/permissions/moderation).
