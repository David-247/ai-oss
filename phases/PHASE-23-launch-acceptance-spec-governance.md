# Phase 23 — Launch-Complete Acceptance & Spec Governance

**Source sections:** §0 How to Use This Document, §28 Launch-Complete Acceptance Criteria, §29 Development Agent Rules, §30 Source References.

## Objectives

Gate production launch on the complete §28 acceptance checklist, codify the §0 + §29 governance rules that bind all phases, and preserve the §30 references. This phase asserts "nothing was deferred" and obtains counsel sign-off before public launch.

## Dependencies
- ALL prior phases (00–22). This is the terminal verification + governance phase.

## In scope

### Document governance (§0, §29)
- Treat `AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md` as the controlling spec; honor normative keywords (MUST/MUST NOT/SHOULD/MAY) and the "launch-complete = required in first build" rule.
- No requirement may be removed/weakened without a new **versioned** architecture doc (changelog + rationale + owner approval).
- **Development Agent Rules (§29)** are binding on every phase:
  1. Architecture file = source of truth; requirements carry traceable IDs in issues/PRs.
  2. Never remove compliance/moderation/privacy/admin scope as "later."
  3. Never store service-role keys client-side.
  4. Never bypass RLS by exposing admin APIs to clients.
  5. Never create unaudited admin/moderation actions.
  6. Never make donation status affect governance or ranking.
  7. Never make recording/transcription default for voice.
  8. Never silently overwrite published paper versions.
  9. Never weaken global moderation rules at zone level.
  10. Always add tests for privacy, permissions, and moderation-sensitive changes.

### Launch-complete acceptance criteria (§28) — all 25 MUST be true
1. `https://www.ai-oss.net/` deployed on Vercel with apex redirect. *(Phase 00)*
2. Users can create, authenticate, secure, export, delete accounts. *(03)*
3. Users can create zones + Reddit-like posts/comments/votes. *(07, 08)*
4. Zones have rules, moderators, modmail, AutoMod, chat, voice, governance. *(07, 13, 10, 11, 15)*
5. Users can submit full research papers with immutable versions. *(09)*
6. Research papers have pages, files, full text, comments, votes, reviews, replication reports. *(09)*
7. Search works across public/authorized content with keyword + semantic. *(12)*
8. Realtime text chat works with membership authorization + moderation. *(10, 13)*
9. Voice rooms work through WebRTC with host/mod controls. *(11)*
10. Donations work through Stripe with verified webhooks. *(17)*
11. Admin panels exist for users, roles, zones, content, research, AutoMod, appeals, legal/privacy, security, donations, analytics, audit logs, system health. *(16)*
12. Custom admin roles and permissions supported. *(04, 16)*
13. Moderator tiers supported. *(15)*
14. Moderator removal by community vote with anti-bot certification. *(15, 14)*
15. AutoMod rules can be created, tested, versioned, published, rolled back. *(13, 16)*
16. Reports, moderation actions, appeals work. *(13)*
17. DSA/OSA-compatible notice, reason, appeal data captured. *(18, 13)*
18. DMCA workflow exists. *(18)*
19. Privacy export/deletion workflows exist. *(03, 18)*
20. Audit logs append-only at application level. *(04)*
21. Security headers, WAF, rate limiting, bot controls configured. *(19, 14)*
22. Accessibility checks pass. *(05, 22)*
23. RLS tests pass. *(01, 22)*
24. E2E tests pass for core flows. *(22)*
25. Legal/privacy documents present and approved by counsel before public launch. *(18 + counsel gate)*

### Source references (§30)
- Preserve the §30 reference list in `docs/architecture/`; flag that provider APIs/pricing/legal obligations MUST be rechecked during implementation.

## Work items
1. Build a launch-acceptance checklist (the 25 items) as an auditable gate; each item links to the owning phase + its passing tests/evidence.
2. Verify every §29 agent rule has an enforcing control/test somewhere in phases 00–22; document the mapping.
3. Confirm no MUST/launch-complete requirement was deferred; if any change occurred, ensure a versioned architecture doc with changelog exists.
4. Obtain counsel sign-off on Terms, Privacy, Community Guidelines, Research Publishing Policy, DMCA, DSA/OSA flows, cookie/consent, age policy, DPAs, retention schedule (§23 preamble, §28 #25).
5. Archive the §30 references + recheck note.

## Acceptance criteria
- All 25 §28 criteria verified true with linked evidence; launch gate passes only when all are green.
- Every §29 rule maps to an enforcing control + test.
- No launch-complete requirement deferred; any deviation has a versioned, approved architecture doc.
- Counsel sign-off recorded before public launch.

## Tests
- Meta-test: acceptance checklist automation asserts each §28 item's evidence exists and its tests pass (aggregates Phase 22 suites).

## Requirement traceability
§0, §28 (all 25), §29 (all 10), §30; REQ-CORE-001…010 final verification.
