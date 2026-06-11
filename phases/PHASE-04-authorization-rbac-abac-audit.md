# Phase 04 — Authorization: RBAC/ABAC, Roles, Permissions & Audit Logging

**Source sections:** §14 Roles, Permissions, and Access Control (14.1–14.5).

## Objectives

Deliver the server-side authorization engine (RBAC + ABAC), the full global role set, the complete permission-scope catalog, high-risk action controls (step-up + two-person approval), and append-only audit logging that every mutation across the platform flows through.

## Dependencies
- Phase 01 (`roles`, `role_bindings`, `permission_audit`, `audit_events`), Phase 03 (identities + MFA/passkey for step-up).

## In scope

### Authorization model (§14.1)
- **RBAC** ("what role does this user have?") + **ABAC** ("given resource, zone, status, ownership, legal hold, risk level, may this action occur?").
- Permissions checked **server-side for every mutation**; client checks are UX hints only.
- Implemented in `packages/permissions` as a policy engine consumed by all feature phases.

### Global roles (§14.2) — all required
Owner; Super Admin; Trust & Safety Admin; Legal Admin; Privacy Admin/DPO; Security Admin; Finance Admin; Support Admin; Research Admin; Zone Admin; Read-only Auditor. Plus **custom roles composed from granular permissions**.

### Permission scopes (§14.3) — implement the full catalog
All scopes exactly as listed: `users.*` (read, update_basic, suspend, ban, delete_or_anonymize, export, impersonate_for_support_prohibited_by_default); `roles.*`; `zones.*`; `content.*`; `research.*`; `chat.*`; `voice.*`; `moderation.*`; `legal.*`; `privacy.*`; `security.*`; `finance.*`; `audit.read/export`; `system.settings_read/update`; `feature_flags.manage`.

### High-risk admin actions (§14.4)
Require **step-up authentication** and SHOULD require **two-person approval** (unless owner emergency): grant/remove owner or super admin; bulk user bans; bulk content removals; legal purges; full private chat export; privacy deletion execution; WAF/security bypass changes; payment refund exports; turning off AutoMod globally; changing governance vote certification thresholds.

### Audit logging (§14.5)
- Every admin/moderator/security/legal/privacy action creates an **append-only** `audit_events` row with: actor id, actor role, action, resource type, resource id, zone id (if any), previous-state hash/summary, new-state hash/summary, reason, request IP/device metadata where appropriate, timestamp, correlation id, automated-vs-manual flag.
- Audit logs MUST NOT be editable through the application.

## Out of scope (deferred)
- Admin panel UIs that *use* these checks → Phase 16. Zone-scoped role semantics surface in Phase 07. Governance threshold changes UI → Phase 15/16. Security event tooling → Phase 19.

## Data model
`roles`, `role_bindings` (zone-scoped via nullable `zone_id`, expiring via `expires_at`), `permission_audit`, `audit_events`.

## Routes / APIs
- `/api/zones/[zoneId]/roles` (zone bindings — consumed by Phase 07), `/api/admin/roles` (Phase 16 UI).
- Shared `requirePermission(scope, resourceCtx)` middleware used by all mutating routes.

## Work items
1. Build `packages/permissions` RBAC+ABAC engine: role resolution, scope checks, ABAC predicates (ownership, zone, status, legal hold, risk).
2. Seed the 11 system global roles with default scope sets; support custom role creation from scopes.
3. Implement `role_bindings` with zone scoping, expiry, grant/revoke, and `permission_audit` writes.
4. Implement step-up auth (re-auth/MFA) + two-person approval workflow for §14.4 actions.
5. Implement append-only audit logging helper (`recordAudit`) writing all §14.5 fields; make `audit_events` application-immutable (DB-enforced).
6. Provide a single mutation guard used platform-wide; document that all feature phases must route mutations through it.

## Acceptance criteria
- Every mutating endpoint enforces a server-side permission check; client-only bypass is impossible.
- All §14.3 scopes exist and are assignable; custom roles work.
- High-risk actions require step-up and (default) two-person approval; owner emergency path is audited.
- Every admin/mod/security/legal/privacy action writes a complete, immutable audit event; app cannot edit audit rows.

## Tests (§27.1, §27.4)
- Unit: permission checks (RBAC + ABAC predicates).
- Security: horizontal privilege escalation; unauthorized admin route access; audit immutability; two-person approval cannot be bypassed.

## Requirement traceability
§14; agent rules §29 (#3, #4, #5 — no unaudited admin/mod actions; least privilege).
