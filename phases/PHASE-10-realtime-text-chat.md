# Phase 10 — Realtime Text Chat

**Source sections:** §3.5 Realtime Text Chat Decision, §11 Realtime Text Chat (11.1–11.4).

## Objectives

Deliver membership-authorized realtime text chat backed by Supabase Realtime + persistent Postgres storage, with full chat features, AutoMod integration, and privacy-respecting access to private rooms.

## Dependencies
- Phase 07 (zones, modmail), Phase 06 (attachment scanning), Phase 13 (AutoMod), Phase 04 (authz/audit), Phase 01 (chat tables). Supabase Realtime provisioned in Phase 00.

## In scope

### Decision (§3.5)
- MUST NOT rely on a long-lived socket server inside Vercel Functions.
- **Supabase Realtime** for presence, message broadcast, typing indicators, membership-gated events; messages persisted in Postgres; channels authorized by room membership + zone permissions.

### Chat room types (§11.1) — MUST support
Zone general; zone project; paper discussion; post-linked; moderator; admin/security; temporary ad-hoc; private invite-only (subject to abuse controls).

### Chat features (§11.2) — MUST support
Persistent messages; realtime delivery; presence; typing indicators; optional read receipts; Markdown-lite; code snippets; **attachments after scanning**; message editing; message deletion; moderator deletion; optional thread replies; message reporting; slow mode; room locking; user mute/kick/ban; pinned messages; room rules; export for mods/admins where authorized and legally permissible.

### Chat moderation (§11.3) — integrate with AutoMod
Link filtering; new-account slow/block; repeated-message rate limiting; keyword/regex filter/report/remove; spam-velocity temp mute; report-count → mod queue; voice-room chat remains logged when text messages are sent.

### Chat privacy (§11.4)
- Private rooms are private to members, moderators with explicit jurisdiction, and global admins with **audited** access. Admin access to private room content MUST require a reason and create an audit event.

## Out of scope (deferred)
- AutoMod rule engine itself → Phase 13 (this phase consumes it). Attachment scanning internals → Phase 06. Voice rooms → Phase 11. Chat search → Phase 12 (only accessible rooms, if enabled).

## Data model
`chat_rooms`, `chat_room_members`, `chat_messages`; audit via `audit_events` for privileged access.

## Routes / APIs
- Pages: `/z/[zoneSlug]/chat`, `/z/[zoneSlug]/chat/[roomId]`, `/messages` (DMs subject to privacy controls).
- APIs: `/api/chat/rooms`, `/api/chat/rooms/[roomId]`, `/api/chat/messages`, `/api/chat/token`.

## Work items
1. Implement room model + all §11.1 types; membership + zone-permission-gated Realtime channel authorization (`/api/chat/token`).
2. Persistent messages in Postgres + realtime delivery, presence, typing, optional read receipts.
3. Message composer: Markdown-lite, code snippets, scanned attachments (Phase 06), edit/delete.
4. Moderator controls: mod deletion, slow mode, room lock, mute/kick/ban, pinned messages, room rules; message reporting → mod queue.
5. AutoMod integration (Phase 13): link/keyword/regex filters, new-account throttle, repeated-message + spam-velocity limits, report-count escalation.
6. Authorized export for mods/admins; private-room admin access requires reason + audit event.

## Acceptance criteria
- Only authorized members receive realtime events for a room; private rooms isolated (RLS + channel authz).
- All §11.2 features work; attachments only after scanning.
- AutoMod actions fire on chat per configured rules; reports reach the mod queue.
- Admin access to private room content always requires a reason and writes an audit event.

## Tests (§27.2, §27.3, §27.4)
- Integration: chat room join/message.
- E2E: join chat.
- Security: private chat leakage attempt fails; unauthorized channel subscription rejected; admin private-access is audited.

## Requirement traceability
§3.5, §11; agent rule §29 (#5 — audited privileged access; #9 — global rules not weakened).
