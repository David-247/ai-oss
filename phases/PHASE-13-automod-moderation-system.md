# Phase 13 — AutoMod & Moderation System

**Source sections:** §17 AutoMod and Moderation System (17.1–17.8).

## Objectives

Deliver the layered, Reddit-AutoModerator-inspired rule engine (UI + YAML/JSON), unified moderation queues, the full report taxonomy, and the appeals workflow — feeding admin panels (Phase 16) and compliance flows (Phase 18).

## Dependencies
- Phase 04 (authz/audit), Phase 02 (queue/job processing), content phases (08/09/10/11) as moderation targets, Phase 01 (moderation tables).

## In scope

### Philosophy (§17.1)
- Reddit AutoModerator-inspired rules of checks + actions; support human-readable UI editing AND YAML/JSON import/export for power users.

### Rule layers (§17.2)
1. **Platform Global Rules** (cannot be weakened by zones; illegal content, spam, malware, CSAM reporting, copyright, abuse, safety, platform-wide bans). 2. **Research Archive Rules** (metadata/file validation, license attestation, safety disclosure, duplicate/spam papers). 3. **Zone Rules** (posting requirements, topic enforcement, link rules, flair requirements, new-user throttles). 4. **Chat/Voice Rules** (message rate, repeated content, links, mentions, raid behavior).

### Rule schema (§17.3)
- YAML/JSON rules with `id`, `name`, `enabled`, `scope[]`, `conditions{}`, `actions[]`, `severity`, `appealable` (per the spec's example).

### Conditions (§17.4) — MUST include
Account age; email verified; MFA enabled; zone reputation; global reputation; prior removals; prior reports; new user; contains link; domain allow/block list; regex; keyword list; language detection; mention count; duplicate content hash; similarity to known spam; file type; file size; missing flair/tags; research metadata missing; report count; vote velocity; toxicity/abuse classifier score; safety classifier score; external URL reputation; chat message frequency; voice room join frequency; governance vote anomaly score.

### Actions (§17.5) — MUST include
Allow; filter to queue; remove; lock; flair/tag; add warning; notify moderators; notify author; require edit; slow mode; temporary mute; temporary ban; escalate to T&S; escalate to legal; quarantine paper/file; hide score; freeze vote count; require manual certification.

### Moderation queues (§17.6)
Unified across content types; filterable; severity-prioritized; realtime-updated; audited; integrated with appeals; integrated with DSA/OSA statement-of-reasons workflows (Phase 18).

### Reports (§17.7)
- Reportable: posts, comments, chat messages, voice participants, papers, paper files, reviews, replication reports, user profiles, zones, moderator actions.
- Reasons: spam; harassment; hate/illegal content; malware; copyright infringement; privacy/doxxing; impersonation; research fraud; safety concern; dangerous dual-use; child safety; terrorism/extremism; other.

### Appeals (§17.8)
- Appeals include: original action; original reason; appeal text; optional evidence; status; decision; decision reason; reviewer; timestamp; audit trail.

## Out of scope (deferred)
- Admin AutoMod UI surfaces (editor/simulator/version/rollback) consumed/displayed in Phase 16. Trust/reputation signals fed in from Phase 14. DSA/OSA statement-of-reasons legal content → Phase 18. CSAM/illegal legal escalation handling → Phase 18.

## Data model
`automod_rules` (scope, zone, yaml, version, publish state), `automod_runs`, `reports`, `moderation_actions`, `appeals`.

## Routes / APIs
- `/api/reports`, `/api/moderation/queue`, `/api/moderation/actions`, `/api/moderation/appeals`, `/api/moderation/automod/test`, `/api/moderation/automod/rules`.
- Zone surface: `/z/[zoneSlug]/moderation`.

## Work items
1. Build `packages/moderation` rule engine: parse/validate YAML/JSON, evaluate all §17.4 conditions, execute all §17.5 actions, enforce layer precedence (global cannot be weakened by zones).
2. Rule lifecycle: draft → validate → test simulator → dry-run → version → publish → rollback (UI in Phase 16; engine here) with hit logging (`automod_runs`).
3. Unified moderation queue: filterable, severity-prioritized, realtime (Phase 10/02), audited, appeal-integrated, DSA/OSA-hook-ready.
4. Reports: all §17.7 targets + reasons; report-count thresholds → queue/escalation.
5. Appeals workflow with all §17.8 fields + audit trail; appealable flag honored per rule/action.
6. Safety/toxicity classifier integration points feeding conditions.

## Acceptance criteria
- Rules created via UI or YAML/JSON; validated; testable in simulator + dry-run; versioned/publishable/rollback-able with hit logs.
- Global rules cannot be weakened at zone level; all §17.4 conditions + §17.5 actions supported.
- All §17.7 report targets/reasons work; reports route to the unified, severity-prioritized, audited queue.
- Appeals capture all §17.8 fields with audit trail; non-appealable actions correctly blocked from appeal.

## Tests (§27.1, §27.2, §27.4)
- Unit: AutoMod rule parsing; AutoMod matching.
- Integration: moderation action/appeal.
- E2E: report content; moderator queue action; appeal action.

## Requirement traceability
§17; agent rules §29 (#2, #5, #9 — scope not deferred, audited actions, global rules not weakened).
