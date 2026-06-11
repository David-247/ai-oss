# Phase 03 — Authentication, Accounts, Profiles & Privacy Controls

**Source sections:** §3.2 End-User Authentication Decision, §7 User Accounts, Profiles, and Privacy Controls (7.1–7.6).

## Objectives

Deliver the full public identity system: signup, login/security, profiles, account deletion, data export, and privacy controls — all backed by Supabase Auth as the identity source of truth, with consent capture and notification preferences.

## Dependencies
- Phase 01 (`profiles`, `user_settings`, `user_security_state`, `consent_events`, `privacy_requests`, `files`), Phase 02 (export/deletion/digest jobs), Phase 00 (Supabase Auth provisioned).

## In scope

### Auth decision (§3.2)
- **Supabase Auth** for public users (NOT Vercel deployment-protection auth).
- Supabase Auth is the source of truth for user identity; optional Auth.js only for provider customization.

### Account creation (§7.1)
- Email+password or passwordless email; OAuth where configured (esp. **GitHub**); email verification; **age attestation**; acceptance of Terms, Privacy, Community Guidelines, Research Publishing Policy, Cookie Policy (record as `consent_events`); optional display name + bio.
- Users MUST NOT be required to donate, give legal name, or connect GitHub for basic activity (stronger verification only at anti-abuse thresholds → Phase 14).

### Login & security (§7.2)
- Session management; active session list; logout-everywhere; password reset (if password auth); optional **MFA/passkeys**; suspicious-login alerts if feasible; email-change confirmation.
- Elevated admins/mods MUST use MFA or passkeys (enforced with Phase 04/19).

### Profile (§7.3)
- Fields: user id, username, display name, avatar (`avatar_file_id` → Phase 06), bio, website, GitHub, optional ORCID, optional affiliation, research interests/tags, public contribution summary, reputation/trust indicators (read-only, from Phase 14), donation badge (if opted in, Phase 17), mod/admin badges only when public-appropriate.

### Account deletion (§7.4)
- `/account/delete` flow: re-auth → show consequences → offer export → revoke sessions → mark deletion-pending → queue deletion/anonymization workflow → delete/anonymize per retention rules → preserve legally necessary records only → emit audit event → send confirmation.
- Content policy: private messages/private fields deleted or anonymized unless legally retained; public posts/comments user-deletable/anonymizable; **published research versions withdrawn/anonymized/redacted, never silently destroyed** (coordinate with Phase 09); authorship PII removable/pseudonymizable where legally required; UI explains this before publication and again at deletion.

### Data export (§7.5)
- Export: profile, settings, zone memberships, posts, comments, paper submissions+metadata, reviews+replications, votes where appropriate, moderation history involving them, donation records available, consent records.
- Format: machine-readable **JSON**, plus CSV where useful. Delivered as expiring-link archive (Phase 06/02).

### Privacy controls (§7.6)
- Manage: email visibility, profile visibility, research affiliation visibility, notification preferences, cookie/analytics consent, public donor-badge preference, DM/contact permissions, profile search-indexing preference where applicable.

## Out of scope (deferred)
- RBAC/role assignment & permission enforcement → Phase 04. Trust score computation → Phase 14. Avatar upload pipeline → Phase 06. Donation badge issuance → Phase 17. Legal/regulatory request handling → Phase 18.

## Data model
`profiles`, `user_settings`, `user_security_state` (read), `consent_events`, `privacy_requests`, `audit_events` (write via Phase 04 helper).

## Routes / APIs
- Pages: `/login`, `/signup`, `/logout`, `/account`, `/account/profile`, `/account/security`, `/account/privacy`, `/account/delete`, `/account/export`, `/account/notifications`.
- APIs: `/api/auth/*`, `/api/account/export`, `/api/account/delete`, `/api/account/privacy-request`.

## Work items
1. Integrate Supabase Auth (email/password, passwordless, GitHub OAuth, email verification).
2. Build signup with age attestation + multi-policy consent capture → `consent_events`.
3. Build session management, active-session list, logout-everywhere, password reset, email-change confirmation; optional MFA/passkey enrollment.
4. Build profile read/edit with all §7.3 fields.
5. Implement account deletion flow + deletion/anonymization workflow (Phase 02) honoring research-record exception.
6. Implement data export job producing JSON (+CSV) archive with expiring link.
7. Implement privacy controls UI persisting to `user_settings.privacy/notifications`.
8. Wire notification preferences to digest jobs (Phase 02).

## Acceptance criteria
- User can sign up, verify email, log in/out, reset password, list+revoke sessions, enroll MFA/passkey.
- Consent + age attestation recorded with policy versions in `consent_events`.
- Deletion flow re-auths, revokes sessions, queues anonymization, preserves published-research integrity, emits audit event, sends confirmation.
- Export produces machine-readable JSON covering all §7.5 categories.
- Privacy controls persist and take effect (e.g., email hidden when set).

## Tests (§27.1, §27.2, §27.3)
- Unit: privacy export serialization; account deletion/anonymization logic.
- Integration: signup/login/delete.
- E2E: new-user onboarding, account export, account deletion.

## Requirement traceability
REQ-CORE-007; §3.2, §7; agent rules §29 (#2, #8, #10).
