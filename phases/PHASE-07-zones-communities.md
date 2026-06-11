# Phase 07 — Zones: Communities & Research Workspaces

**Source sections:** §8 Zones (8.1–8.4).

## Objectives

Deliver user-created communities ("zones") with creation flow + anti-abuse gating, the full feature surface, zone-level roles, and zone governance hooks. Zones are the container for posts (Phase 08), chat/voice (10/11), and governance (15).

## Dependencies
- Phase 04 (zone-scoped roles via `role_bindings`), Phase 05 (zone routes/shell), Phase 01 (zone tables). Anti-abuse thresholds from Phase 14.

## In scope

### Zone creation (§8.1)
- Authenticated users MAY create zones when anti-abuse requirements met: verified email; account-age OR trust-score threshold; unique slug; name; description; rules; topic tags; visibility (public/restricted/private); default posting permissions; default chat permissions; moderation-team bootstrap; AutoMod baseline enabled.
- Global admins MUST be able to disable new zone creation temporarily during abuse events.

### Zone features (§8.2) — each zone MUST include
Zone homepage; posts; comments; voting; rules page; wiki/docs; chat room list; voice room list; member list where appropriate; moderator list; report flow; modmail; in-zone search; sort modes (hot, new, top, active, controversial); flair/tag system; pinned posts; announcements; sidebar; zone settings; moderation queue; AutoMod rules; governance/voting area.

### Zone roles (§8.3) — MUST include
Zone owner/founder (cannot bypass global policy); lead moderator; content moderator; chat moderator; research reviewer; automod editor; wiki editor; member; restricted member; banned user. **No zone role overrides global legal/privacy/safety/security requirements.**

### Zone governance (§8.4) — zones MUST support
Moderator appointment by eligible leadership; moderator resignation; moderator removal by global admins for safety/legal/security; **moderator removal by community vote with anti-bot certification** (full flow in Phase 15); public moderator-action-log summaries where privacy permits; appeals.

## Out of scope (deferred)
- Post/comment/vote mechanics → Phase 08. Chat/voice rooms → Phases 10/11. Full governance vote machinery → Phase 15. AutoMod rule engine → Phase 13. Modmail message transport reuses chat infra (Phase 10).

## Data model
`zones`, `zone_members`, `zone_flairs`, `zone_wiki_pages`, `zone_settings`, `zone_governance_settings`; `role_bindings` (zone-scoped).

## Routes / APIs
- Pages: `/z`, `/z/new`, `/z/[zoneSlug]`, `/z/[zoneSlug]/rules`, `/z/[zoneSlug]/wiki`, `/z/[zoneSlug]/settings`, `/z/[zoneSlug]/moderation`, `/z/[zoneSlug]/modmail`, `/z/[zoneSlug]/governance` (governance UI shared with Phase 15).
- APIs: `/api/zones`, `/api/zones/[zoneId]`, `/api/zones/[zoneId]/members`, `/api/zones/[zoneId]/roles`, `/api/zones/[zoneId]/moderators`, `/api/zones/[zoneId]/governance/*`.

## Work items
1. Zone creation flow with anti-abuse gating (verified email, age/trust threshold, unique slug) + AutoMod baseline + mod bootstrap.
2. Global admin kill-switch to pause zone creation during abuse events.
3. Zone homepage + features surface (rules, wiki, sidebar, flairs, pinned posts, announcements, member/mod lists, in-zone search hook, sort modes).
4. Zone settings + visibility (public/restricted/private) with RLS-aligned access.
5. Zone-role model (all §8.3 roles) bound via Phase 04; enforce that zone roles cannot override global policy.
6. Zone governance hooks: appointment, resignation, admin removal, community-removal entry point (→ Phase 15), public action-log summaries, appeals entry.
7. Wire report flow + moderation queue + modmail entry points (transport from Phases 13/10).

## Acceptance criteria
- A qualifying user can create a zone; non-qualifying users are blocked with clear reason; admins can pause creation.
- Zone exposes all §8.2 features; visibility levels enforced via RLS.
- All §8.3 roles assignable; zone roles cannot exceed global policy.
- Governance entry points exist (appointment/resignation/admin-removal/community-removal/appeals) with audit events.

## Tests (§27.2, §27.3)
- Integration: zone creation (incl. threshold rejection).
- E2E: create zone; visit zone features; assign zone moderator.
- RLS: restricted/private zone content isolation.

## Requirement traceability
REQ-CORE-006; §8; agent rule §29 (#9 — zones cannot weaken global rules).
