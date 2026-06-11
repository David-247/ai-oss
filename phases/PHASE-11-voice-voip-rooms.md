# Phase 11 — Voice / VoIP Rooms

**Source sections:** §3.6 Voice/VoIP Decision, §12 Voice/VoIP Rooms (12.1–12.4).

## Objectives

Deliver WebRTC voice rooms via LiveKit with server-issued authorization tokens, host/moderator controls, **opt-in only** recording/transcription with consent, and abuse controls — never recording by default.

## Dependencies
- Phase 07 (zones), Phase 04 (authz/audit), Phase 06 (recording storage/retention), Phase 14 (host reputation), Phase 01 (voice tables). LiveKit provisioned in Phase 00.

## In scope

### Decision (§3.6)
- Voice uses **WebRTC (LiveKit)**, not Vercel Functions as a media server. Vercel Functions issue short-lived room tokens after authorization checks. Session metadata in Postgres. **Audio not recorded by default.** Recording/transcription disabled unless a room owner enables it AND the UI obtains explicit participant notice + consent before joining.

### Voice room types (§12.1) — MUST support
Zone voice room; paper review voice room; event/seminar room; moderator room; temporary invite-only voice room.

### Voice features (§12.2) — MUST support
Join/leave; mute/unmute; deafen; push-to-talk option; host controls; moderator controls; kick; ban from room; lock room; waiting room; participant list; voice status in zone; optional text side-channel (Phase 10); optional screen share only if enabled and moderated.

### Recording & transcription (§12.3)
- Default: no recording, no transcription, no persistent audio storage.
- If enabled: participants MUST see clear pre-join notice; MUST consent before joining; recording indicator MUST remain visible; recording file stored with retention policy; transcript labelable as automated, editable only with audit history; rooms with recording MUST expose report/delete-request controls.

### Voice abuse controls (§12.4) — MUST support
Join rate limits; room-creation rate limits; host reputation requirements for public rooms; moderator emergency mute-all; moderator remove participant; lock room; report participant; temporary cooldown after abuse; anti-raid room privacy changes; abuse-metadata logging **without recording audio by default**.

## Out of scope (deferred)
- LiveKit infra provisioning → Phase 00. Recording file storage/retention pipeline reuses Phase 06. Host reputation/trust computation → Phase 14. Text side-channel transport → Phase 10.

## Data model
`voice_rooms` (recording_enabled/transcription_enabled default false, `livekit_room_name`), `voice_participants`; `audit_events`.

## Routes / APIs
- Pages: `/z/[zoneSlug]/voice/[roomId]`.
- APIs: `/api/voice/rooms`, `/api/voice/rooms/[roomId]`, `/api/voice/token`, `/api/voice/end`.

## Work items
1. Voice room model + all §12.1 types; server-side authorization → short-lived LiveKit token issuance (`/api/voice/token`).
2. Client voice UX: join/leave, mute/deafen, push-to-talk, participant list, waiting room, zone voice status, optional moderated screen share, optional text side-channel.
3. Host/moderator controls: kick, ban-from-room, lock, emergency mute-all, remove participant, end room (`/api/voice/end`).
4. Recording/transcription strictly opt-in: pre-join notice + consent gate, persistent visible indicator, retention policy, automated-transcript labeling with audit-only edits, report/delete controls.
5. Abuse controls: join + creation rate limits, public-room host reputation gate (Phase 14), post-abuse cooldown, anti-raid privacy changes, abuse-metadata logging without audio.

## Acceptance criteria
- Tokens issued only after server-side authorization; metadata persisted.
- Recording/transcription are OFF by default; enabling requires owner action + per-participant pre-join consent + visible indicator + retention + report/delete controls.
- Host/moderator controls (mute-all, kick, ban, lock, end) work.
- Abuse controls enforce rate limits, host reputation, cooldowns, anti-raid changes; abuse metadata logged without recording audio.

## Tests (§27.2, §27.3)
- Integration: voice token creation (authorized vs unauthorized).
- E2E: start voice room; recording-consent gate; moderator mute-all/kick.

## Requirement traceability
§3.6, §12; agent rule §29 (#7 — recording/transcription never default).
