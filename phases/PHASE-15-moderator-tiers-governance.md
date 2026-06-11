# Phase 15 — Moderator Tiers & Community Governance

**Source sections:** §16 Moderator Tiers and Community Governance (16.1–16.5); completes §8.4.

## Objectives

Deliver the zone moderator tier model, moderator selection paths, the full community moderator-removal petition→vote→certification flow with anti-bot controls, and global-admin emergency overrides — all audited.

## Dependencies
- Phase 07 (zones + zone roles), Phase 14 (eligibility/anti-bot/certification), Phase 04 (authz/audit), Phase 01 (governance tables), Phase 02 (vote certification jobs).

## In scope

### Moderator tiers (§16.1)
1. **Lead Moderator** — manage zone settings; manage moderators (subject to governance/anti-abuse); publish zone AutoMod rules; lock/restore content; handle appeals; start moderator elections/removal certification.
2. **Content Moderator** — moderate posts/comments; handle content reports; lock/remove/restore within scope.
3. **Chat Moderator** — moderate chat/voice; mute/kick; lock chat rooms; end voice rooms if needed.
4. **Junior Moderator** — triage reports; mark spam; recommend actions; cannot permanently ban or remove moderators.
5. **Research Reviewer** — add structured review metadata; cannot remove content unless also a moderator.
6. **AutoMod Editor** — draft AutoMod changes; cannot publish without lead moderator or authorized admin approval.

### Moderator selection (§16.2) — zones MUST support
Founder appointment at creation; lead-moderator invitations; community nominations; optional zone-specific elections; admin emergency appointment during abandonment/abuse.

### Community moderator removal (§16.3)
- Users MUST be able to initiate removal when: they meet eligibility; moderator is in their zone; moderator is not a global admin acting in global capacity; petition meets threshold.
- Mandatory flow: petition w/ reason → gather support from eligible members → if threshold met, removal vote opens → open for configured duration → votes collected with anti-bot controls → vote closes → certification → if certified + threshold met, mod removed/demoted → if suspicious, admin review → outcome + reason published to zone governance log.

### Anti-bot controls for governance (§16.4)
- Eligibility considers: verified email; account age; zone membership age; recent meaningful zone participation; not banned/suspended; no recent severe moderation actions; device/IP risk score; BotID result for voting; rate-limit status; reputation/trust threshold; duplicate-account cluster risk.
- Governance votes MUST: not be weighted by donations; not be publicly visible by voter identity during voting; be auditable after close in privacy-preserving aggregate; be held for certification before action; be delayable/invalidatable by authorized admins on brigading/botting/coercion/off-platform manipulation.

### Emergency overrides (§16.5) — global admins MUST be able to
Suspend a moderator immediately for credible safety/legal/security risk; freeze a governance vote under active manipulation; certify/invalidate a vote with public reason; restore a removed moderator if abuse proven; transfer zone ownership if the mod team is compromised. **All overrides MUST be audited.**

## Out of scope (deferred)
- Trust/eligibility signal computation → Phase 14. Admin override UI surfaces → Phase 16. General appeals engine → Phase 13.

## Data model
`mod_removal_petitions`, `mod_removal_petition_support`, `governance_votes`, `governance_ballots` (`ballot_hash`, `eligibility_snapshot`, `risk_snapshot`), `zone_governance_settings`; `audit_events`.

## Routes / APIs
- Pages: `/z/[zoneSlug]/governance`.
- APIs: `/api/zones/[zoneId]/governance/*`, `/api/zones/[zoneId]/moderators`.

## Work items
1. Implement all six moderator tiers with scoped capabilities bound via Phase 04.
2. Implement selection paths: founder appointment, lead invitations, community nominations, optional elections, admin emergency appointment.
3. Implement removal flow: petition → support threshold → vote open/close → anti-bot ballot collection (eligibility + risk snapshots) → certification (Phase 02/14) → removal/demotion or admin review → publish outcome to governance log.
4. Enforce governance vote rules: donation-weight excluded, voter identity hidden during vote, privacy-preserving aggregate audit, certification-before-action, admin delay/invalidate on manipulation.
5. Implement emergency overrides (suspend/freeze/certify/invalidate/restore/transfer) — all audited with public reasons where required.

## Acceptance criteria
- All six tiers exist with correct capability boundaries (e.g., Junior cannot permanently ban; AutoMod Editor cannot publish without approval).
- Removal flow runs end-to-end with anti-bot eligibility + certification; suspicious results route to admin review; outcomes published.
- Donations never affect governance votes; voter identities hidden during voting; post-close audit is privacy-preserving aggregate.
- Emergency overrides function and are always audited.

## Tests (§27.2, §27.3)
- Integration: moderator removal vote (incl. certification + brigading→admin-review path).
- E2E: initiate petition → vote → certified removal.

## Requirement traceability
REQ-CORE-010; §16, §8.4; agent rules §29 (#5, #6 — audited overrides; donations never affect governance).
