# Phase 18 — Compliance & Legal Architecture

**Source sections:** §23 Compliance and Legal Architecture (23.1–23.10); legal pages from §5.2.

## Objectives

Implement the technical + operational compliance baseline: privacy-by-design, GDPR/UK-GDPR/CCPA-CPRA rights, COPPA/minors policy, UK Online Safety Act, EU DSA, DMCA, cookie/analytics consent, and the AI-specific safety baseline — plus all legal/policy pages. (Counsel review is a launch gate per §23 preamble and Phase 23.)

## Dependencies
- Phase 03 (consent, export, deletion), Phase 13 (reports/appeals/statements of reasons), Phase 16 (legal/privacy admin), Phase 02 (privacy/deletion/transparency jobs), Phase 01 (`consent_events`, `privacy_requests`, `legal_requests`, `transparency_report_events`).

## In scope

### Privacy baseline (§23.1)
Privacy by design: minimum data; clear notices; record consent; access/export; deletion/anonymization; correction; objection/opt-out where applicable; cookie consent; processing records; processor/vendor list; DPAs with vendors; restrict admin access to personal data; encrypt in transit; provider encryption at rest; log access to sensitive personal data; retention schedules.

### EU GDPR (§23.2)
Rights: informed, access, rectification, erasure, restriction, portability, object, automated-decision/profiling where applicable; clear legal basis; data minimization; storage limitation; security/confidentiality; controller/processor disclosures; international-transfer safeguards.

### UK GDPR & DPA (§23.3)
Equivalent UK rights/principles; UK-specific privacy + cookie expectations reflected in Privacy + Cookie policies.

### CCPA/CPRA & US state privacy (§23.4)
Right to know/access; delete; correct where applicable; opt out of sale/share; limit sensitive-data use; non-discrimination; Global Privacy Control support where applicable; "Do Not Sell or Share My Personal Information" link if any sale/share interpretation could apply. Default: **do not sell**.

### COPPA & minors (§23.5)
Not directed to under-13; MUST NOT knowingly collect their data. Launch policy: min age 18 unless counsel approves otherwise; age attestation at signup; underage report flow; underage account-removal workflow; no targeted ads to minors; no child-directed UX; child-safety reporting escalation for suspected CSAM/grooming.

### UK Online Safety Act (§23.6)
Illegal-content risk assessment; child-access assessment/age policy; illegal-content reporting; user complaints + redress; content moderation records; terms explaining moderation; systems to reduce availability/spread of illegal content; crisis protocol for spikes; records of proportionate safety measures.

### EU DSA (§23.7)
Notice-and-action for illegal content; accessible reporting; confirmation of notice receipt; decision notification; statement of reasons where applicable; internal complaint/appeal mechanism; transparency-report data collection; trusted-flagger support if later applicable; no dark patterns in reporting/appeal flows.

### DMCA/copyright (§23.8)
DMCA agent registration workflow pre-launch (if seeking US safe harbor); public DMCA policy; takedown intake; counter-notice intake; repeat-infringer policy; copyright-owner contact process; file removal/disable-access workflow; audit log; user notification; legal hold support.

### Cookies & analytics (§23.9)
Strictly-necessary cookies for auth/security allowed; nonessential analytics/marketing/tracking require consent where legally required; withdrawable consent; disclosed categories + vendors; privacy-preserving analytics where possible; **no behavioral advertising at launch**.

### AI-specific baseline (§23.10)
Collect metadata: model/provider identity where applicable; license; training-data summary where applicable; safety/dual-use statement; intended use; limitations; evaluation results; known risks; responsible-disclosure status; export-control/sanctions warning where applicable; takedown/escalation path. (If AI-OSS later publishes/modifies models, a separate AI Act/UK/US governance addendum is required.)

## Out of scope (deferred)
- Admin UIs for these flows → Phase 16. Report/appeal engine → Phase 13. Consent/export/deletion mechanics → Phase 03. Counsel sign-off → Phase 23 gate.

## Data model
`consent_events`, `privacy_requests` (with `due_at` SLA tracking), `legal_requests`, `transparency_report_events`; audit via `audit_events`.

## Routes / APIs
- Legal pages: `/legal`, `/legal/privacy`, `/legal/terms`, `/legal/cookies`, `/legal/dmca`, `/legal/community-guidelines`, `/legal/research-policy`, `/legal/moderator-code`, `/legal/transparency`, `/legal/dsa`, `/legal/online-safety`.
- APIs: `/api/account/privacy-request` (Phase 03), DMCA/DSA/OSA intake endpoints + admin handlers (Phase 16).

## Work items
1. Privacy-by-design controls: processing records, vendor/processor + DPA register, sensitive-data access logging, retention schedules, encryption posture documentation.
2. Implement data-subject rights flows (GDPR/UK/CCPA) on top of Phase 03 export/deletion/correction + opt-out + GPC handling + "Do Not Sell/Share" link.
3. Minors policy: age gate (default 18), underage report + removal workflow, CSAM/grooming escalation.
4. UK OSA baseline: risk assessments, illegal-content reporting + redress, moderation records, crisis protocol.
5. EU DSA: notice-and-action, receipt confirmation, decision notification, statements of reasons (from Phase 13), internal complaint/appeal, transparency-report data collection, no dark patterns.
6. DMCA: agent registration workflow, policy, takedown + counter-notice intake, repeat-infringer tracking, removal/disable, notifications, legal holds, audit.
7. Cookie/consent manager (categories + vendors, withdrawable) + privacy-preserving analytics; no behavioral ads.
8. AI metadata capture wired into research submission (Phase 09) and surfaced on paper pages.
9. Author all legal/policy pages; transparency report generation (Phase 02 rollups).

## Acceptance criteria
- Data-subject rights (access/export/delete/correct/opt-out) work with SLA (`due_at`) tracking.
- Cookie consent gates nonessential cookies; consent withdrawable; categories/vendors disclosed; no behavioral ads.
- DMCA, DSA notice-and-action, and OSA report/redress flows function with audit + notifications + statements of reasons.
- Minors policy enforced (age gate + underage removal + CSAM/grooming escalation).
- AI metadata captured + displayed; transparency report data collected.
- All legal pages present.

## Tests (§27.5, §27.4)
- Compliance: cookie-consent behavior; privacy-export due-date tracking; deletion/anonymization; DMCA workflow; DSA report+appeal flow; OSA report/redress flow; consent-record versioning; terms-acceptance versioning.

## Requirement traceability
REQ-CORE-008; §23; agent rules §29 (#2 — compliance/privacy never deferred; #10 tests).
