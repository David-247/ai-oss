# Phase 14 — Trust, Reputation & Anti-Abuse

**Source sections:** §3.8 Security & Anti-Bot Decision, §18 Trust, Reputation, and Anti-Abuse (18.1–18.4).

## Objectives

Deliver the internal trust score, public reputation surfaces, layered anti-bot controls for sensitive actions, and anti-brigading detection/mitigation — the signals consumed by zones (07), voting (08), governance (15), AutoMod (13), and voice (11).

## Dependencies
- Phase 03 (identity signals), Phase 04 (audit), Phase 08 (vote data), Phase 02 (vote-certification jobs), Phase 01 (`user_security_state`). WAF/BotID/Upstash provisioned in Phase 00.

## In scope

### Layered abuse controls (§3.8)
Vercel WAF custom rules + rate limiting; Vercel BotID (or equivalent) for sensitive actions; app-level rate limits in Redis/Upstash or Postgres; account trust scoring; email verification; optional passkeys/MFA; GitHub/social verification as a trust signal (not required of all users); vote anomaly detection; audit logs for admin/mod/security/privacy actions.

### Trust score (§18.1)
- Internal by default; computed from: account age; verified email; optional verified GitHub/ORCID; MFA/passkey; positive contributions; accepted reviews/replications; report accuracy; moderator actions; spam removals; vote-anomaly involvement; device/IP risk.
- **Payment status MUST NOT increase governance or moderation trust.**

### Reputation (§18.2)
- Public reputation MAY show: community karma; research contribution score; review helpfulness; replication contribution score; zone-specific reputation.
- Public reputation MUST NOT expose sensitive anti-abuse signals.

### Anti-bot controls (§18.3)
- Sensitive actions use: sign-up throttles; email verification; WAF rate limits; BotID; CSRF protection; IP/device risk signals; action velocity limits; content similarity checks; vote anomaly detection; new-user cooldowns; invite/approval controls for high-risk zones if necessary.
- Sensitive actions: voting; downvoting at scale; creating zones; creating many posts/comments; uploading research; joining many rooms; creating voice rooms; filing mass reports; governance petitions/votes; moderator-removal votes; account deletion/export.

### Anti-brigading (§18.4)
- Detect: sudden inbound-link vote floods; votes from new accounts; votes from accounts with no zone history; shared IP/device clusters; external coordination indicators; abnormal vote timing; abnormal up/down ratio shifts; moderator-removal brigades.
- Mitigations: hide scores temporarily; delay ranking effects; require vote certification; raise quorum thresholds; freeze governance vote; route to security/admin review; rate-limit suspicious clusters.

## Out of scope (deferred)
- Governance vote machinery → Phase 15 (consumes certification + eligibility). Security event admin tooling → Phase 19/16. WAF rule authoring → Phase 19. AutoMod condition wiring → Phase 13.

## Data model
`user_security_state` (`risk_score`, `trust_score`), vote-certification metadata on `votes`/`governance_ballots`; reads `audit_events`.

## Routes / APIs
- Reuses `/api/votes` (certification), governance APIs (Phase 15), and shared rate-limit middleware applied to all sensitive actions.

## Work items
1. Implement trust-score computation (all §18.1 inputs) writing `user_security_state.trust_score`; ensure payment status is excluded from governance/moderation trust.
2. Implement public reputation surfaces (§18.2) without leaking anti-abuse signals.
3. Implement layered anti-bot controls (WAF + BotID + Upstash rate limits + CSRF + velocity + similarity + new-user cooldowns) and apply to every §18.3 sensitive action.
4. Implement vote anomaly detection + vote certification jobs (Phase 02) feeding ranking (Phase 08) and governance (Phase 15).
5. Implement anti-brigading detection signals + mitigations (score hide/delay, certification, quorum raise, governance freeze, security routing, cluster rate-limit).
6. Expose host-reputation gate for public voice rooms (Phase 11) and zone-creation thresholds (Phase 07).

## Acceptance criteria
- Trust score computed from all §18.1 signals; donations never raise governance/moderation trust (REQ-CORE-010).
- Public reputation shows only permitted scores; no anti-abuse signal leakage.
- Every §18.3 sensitive action is rate-limited + bot-checked; new-user cooldowns enforced.
- Brigading scenarios trigger detection + at least one mitigation; suspicious votes await certification before affecting ranking/governance.

## Tests (§27.1, §27.4)
- Unit: trust score updates; vote-anomaly classification.
- Security: rate-limit behavior; bot-challenge behavior; brigading mitigation triggers.

## Requirement traceability
REQ-CORE-010; §3.8, §18; agent rule §29 (#6 — donations never affect governance/ranking).
