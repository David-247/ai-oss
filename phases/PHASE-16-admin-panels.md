# Phase 16 — Admin Panels

**Source sections:** §15 Admin Panels (15.1–15.11).

## Objectives

Deliver all eleven admin surfaces — server-side, permission-gated, audited — providing operational control over users, roles, zones, content, research, AutoMod, appeals, legal/privacy, security, donations, plus the admin home dashboard and supporting analytics/audit-log/system views.

## Dependencies
- Phase 04 (RBAC/ABAC, step-up, two-person approval, audit), Phase 13 (moderation/AutoMod engine), Phase 15 (governance overrides), Phase 17 (donations data), Phase 18 (legal/privacy data), Phase 14/19 (security data). Admin shell from Phase 05.

## In scope (each panel = the exact §15 checklist)

### 15.1 Admin Home (`/admin`)
System health; pending reports; pending appeals; quarantined papers; abuse spikes; new-user growth; active zones; donation summary; security alerts; privacy/legal deadlines; recent admin actions; background job failures.

### 15.2 User Administration (`/admin/users`)
Search users; view profile/account status/sessions/trust score/reports/moderation history; suspend/unsuspend; ban/unban; revoke sessions; force password reset if supported; mark for review; view linked OAuth; view deletion/export status; view consent records; assign/revoke roles if authorized; add internal note; trigger privacy export/deletion if authorized.

### 15.3 Role Administration (`/admin/roles`)
Global role list; custom role builder; permission matrix; role assignment; expiring role assignment; two-person approval workflow for high-risk roles; role audit history.

### 15.4 Zone Administration (`/admin/zones`)
Zone search; status; owner/mod list; rules; AutoMod status; reports; growth/abuse metrics; quarantine zone; transfer ownership; remove zone; lock zone; emergency read-only mode; override community mod removal when abuse detected (with reason).

### 15.5 Content Moderation (`/admin/content`, `/admin/reports`, `/admin/moderation`)
Unified queue (posts, comments, chats, paper comments, reviews, files); filter by zone/type/severity/report-reason/AutoMod-rule/date; bulk actions; single-item context; user history; conversation context; remove/approve/lock/restore; escalate to legal/security; reply to reporter; notify author; create appealable decision; generate DSA/OSA statement of reasons where applicable.

### 15.6 Research Administration (`/admin/research`)
Paper search; pending automated scans; quarantined papers; metadata correction; version audit; file scan state; license state; takedown state; withdrawal/retraction tools; safety flags; reviewer abuse reports; public status reason.

### 15.7 AutoMod Administration (`/admin/automod`)
Global + zone AutoMod rules; rule editor; YAML/JSON import/export; rule validation; test simulator; dry-run; version history; publish workflow; rollback; rule performance metrics; rule hit log.

### 15.8 Appeals Administration (`/admin/appeals`)
Appeal inbox; original decision; decision reason; user appeal text; content context; applicable policy; prior actions; decide (uphold/reverse/modify/escalate); response templates; audit trail; DSA/OSA-compatible handling.

### 15.9 Legal & Privacy Administration (`/admin/legal`, `/admin/privacy-requests`)
DMCA notices; counter-notices; repeat-infringer records; DSA notices; OSA risk records; law-enforcement requests; preservation/legal holds; user privacy requests; data exports; account deletion jobs; consent logs; cookie consent logs; retention schedules; transparency report exports.

### 15.10 Security Administration (`/admin/security`)
Suspicious logins; bot spikes; rate-limit events; WAF events; vote-manipulation alerts; governance-vote certification alerts; IP/device risk clusters; admin session list; secret rotation checklist; incident runbooks.

### 15.11 Donations Administration (`/admin/donations`)
Donation list; donation search; Stripe event log; refund/chargeback state; donor-badge opt-in state; anonymous donation flag; accounting export; donor support note.

### Plus supporting admin routes
`/admin/analytics`, `/admin/audit-log`, `/admin/system`.

## Out of scope (deferred)
- The underlying engines (moderation, governance, donations, legal/privacy, security) are owned by their phases; this phase builds the **admin UI/control surfaces** on top, enforcing Phase 04 checks + audit.

## Routes / APIs
- All `/admin/*` pages; `/api/admin/*` (server-side only).

## Work items
1. Build admin shell (data tables, filters, keyboard shortcuts per §6.3) gated by Phase 04 permissions; all admin APIs server-side only.
2. Implement each panel 15.1–15.11 to its exact checklist, wired to owning-phase data/services.
3. Enforce step-up auth + two-person approval for §14.4 high-risk actions invoked from panels.
4. Every admin action writes a §14.5 audit event; require reason where specified.
5. Generate DSA/OSA statements of reasons from content moderation + appeals panels (data from Phase 18).
6. Build analytics, append-only audit-log viewer, and system/health/feature-flag views.

## Acceptance criteria
- All eleven panels exist and meet their full §15 checklists; admin home shows all §15.1 widgets.
- Admin routes are server-side + permission-gated; unauthorized access blocked.
- High-risk actions require step-up + two-person approval; all actions audited with reasons.
- Custom roles + expiring assignments + two-person approval work from Role Admin.

## Tests (§27.3, §27.4)
- E2E: admin role grant; content-queue action; appeal decision; zone quarantine.
- Security: unauthorized admin route access blocked; audit written for each action; impersonation prohibited-by-default enforced.

## Requirement traceability
REQ-CORE-008; §15; agent rules §29 (#4, #5 — admin APIs server-side, audited actions).
