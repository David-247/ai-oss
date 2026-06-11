# Phase 20 — Observability & Operations

**Source sections:** §25 Observability and Operations (25.1–25.4).

## Objectives

Deliver metrics, redacting logs, alerts, and runbooks so the platform is operable, debuggable, and incident-ready — covering every subsystem built in prior phases.

## Dependencies
- All feature phases (emit metrics/logs), Phase 02 (job telemetry), Phase 19 (security events), Phase 18 (legal/privacy deadlines).

## In scope

### Metrics (§25.1) — track
Request rate; error rate; latency; Core Web Vitals; signups; active users; zone creation; posts/comments; research submissions; chat/voice usage; reports; moderation-action counts; appeal outcomes; file-scan failures; job failures; donation events; search latency; bot/rate-limit events.

### Logs (§25.2) — MUST redact
Passwords; tokens; secrets; payment details; sensitive personal data; private-message bodies (unless specifically in an audited moderation export).

### Alerts (§25.3) — MUST exist for
Elevated 5xx; auth-failures spike; bot/signup spike; payment webhook failures; file-scan backlog; moderation-queue backlog; legal/privacy deadline approaching; admin role changes; WAF/BotID spikes; database connection saturation; realtime failures; voice-provider failures.

### Runbooks (§25.4) — MUST exist for
Production outage; database incident; auth incident; payment incident; spam raid; governance-vote attack; illegal-content report; CSAM report; DMCA takedown; privacy deletion/export; admin-account compromise; data breach; voice-room abuse.

## Out of scope (deferred)
- Performance budgets/scalability → Phase 21. Security incident *tooling UI* → Phase 16/19 (this phase provides telemetry + runbooks).

## Work items
1. Instrument all subsystems with the §25.1 metrics (request/error/latency/CWV + product + safety + ops metrics).
2. Centralized structured logging with mandatory redaction of all §25.2 fields; correlation IDs from Phase 02/04.
3. Configure all §25.3 alerts with thresholds + routing/on-call.
4. Author all §25.4 runbooks under `docs/runbooks/`.
5. Surface job-failure + queue-backlog + legal/privacy-deadline + admin-role-change signals to Admin Home (Phase 16).

## Acceptance criteria
- Dashboards show all §25.1 metrics; Core Web Vitals tracked.
- Logs verifiably redact passwords/tokens/secrets/payment/PII/private-message bodies.
- All §25.3 alerts configured and test-fired.
- All §25.4 runbooks exist and are linked from Security Admin (§15.10).

## Tests (§27.4 partial)
- Log-redaction test: secrets/PII never appear in logs.
- Alert smoke tests: synthetic trigger fires expected alert.

## Requirement traceability
§25; agent rule §29 (#5 — observable/audited operations).
