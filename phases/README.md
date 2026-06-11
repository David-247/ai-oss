# AI-OSS.net — Implementation Phases

This directory decomposes **`AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md`** (v1.0, 2026-06-10) into discrete, buildable phases. Every section (§0–§30) and every normative requirement in the architecture is assigned to exactly one owning phase, with cross-cutting concerns referenced where they recur.

> **Authority:** The architecture document remains the source of truth. These phase files are an execution decomposition of it — they MUST NOT weaken, drop, or defer any MUST/MUST NOT requirement. If a conflict is found, the architecture wins and the phase file is corrected.

## How to read a phase file

Each `PHASE-NN-*.md` follows the same template:

- **Source sections** — the architecture §§ this phase implements (traceability).
- **Objectives** — what "done" means for this phase.
- **Dependencies** — phases that must land first.
- **In scope** — concrete deliverables, transcribed from the architecture (nothing summarized away).
- **Out of scope** — explicitly deferred to a named phase (prevents silent gaps).
- **Data model** — tables created/touched (from §19).
- **Routes / APIs** — pages and endpoints (from §5.2 / §5.3).
- **Work items** — actionable build tasks.
- **Acceptance criteria** — testable exit conditions.
- **Tests** — required test coverage (from §27).
- **Requirement traceability** — REQ-CORE / agent-rule IDs touched.

## Build order & dependency graph

```
00 Foundation ──┬─> 01 Data & RLS ──┬─> 02 Background Jobs
                │                    ├─> 03 Auth & Accounts ──> 04 Authorization & Audit
                │                    │         │
                │                    │         └─> 05 Design System & Shell
                │                    │
                ├──(04)──> 06 Files ──> 09 Research
                ├──(05)──> 07 Zones ──> 08 Discussions ──> 12 Search
                │                  └──> 10 Chat ──> 11 Voice
                ├──> 13 AutoMod & Moderation ──> 14 Trust & Anti-Abuse ──> 15 Governance
                ├──> 16 Admin Panels
                ├──> 17 Donations
                ├──> 18 Compliance & Legal
                ├──> 19 Security
                ├──> 20 Observability ──> 21 Performance
                └──> 22 Testing ──> 23 Launch Acceptance
```

Phases 00–05 are foundational and largely sequential. Phases 06–17 are feature pillars that can be parallelized once their dependencies land. Phases 18–23 are cross-cutting hardening/verification layers that run alongside and gate launch.

## Phase index

| # | Phase | Architecture sections |
|---|-------|-----------------------|
| 00 | Foundation, Platform & Project Setup | §1, §2, §3, §4, §5.1, §5.3 (scaffold), §24.4 |
| 01 | Data Architecture & Row Level Security | §19, §20 |
| 02 | Background Jobs & Workflow Infrastructure | §3.9, §4.2 (Workflows/Queues/Cron) |
| 03 | Authentication, Accounts, Profiles & Privacy Controls | §3.2, §7 |
| 04 | Authorization: RBAC/ABAC, Roles, Permissions & Audit | §14 |
| 05 | Design System, Frontend Shell, Navigation & Accessibility | §5.2, §6 |
| 06 | File Upload, Storage, Scanning & Safety | §3.4, §22 |
| 07 | Zones: Communities & Research Workspaces | §8 |
| 08 | Posts, Comments, Voting, Feeds & Ranking | §9 |
| 09 | Research Publishing System | §10 |
| 10 | Realtime Text Chat | §3.5, §11 |
| 11 | Voice / VoIP Rooms | §3.6, §12 |
| 12 | Search Architecture | §3 (search), §21 |
| 13 | AutoMod & Moderation System | §17 |
| 14 | Trust, Reputation & Anti-Abuse | §3.8, §18 |
| 15 | Moderator Tiers & Community Governance | §16 |
| 16 | Admin Panels | §15 |
| 17 | Donations | §3.7, §13 |
| 18 | Compliance & Legal Architecture | §23 |
| 19 | Security Architecture | §24 |
| 20 | Observability & Operations | §25 |
| 21 | Performance & Scalability | §26 |
| 22 | Testing & QA | §27 |
| 23 | Launch-Complete Acceptance & Spec Governance | §28, §29, §30 |

## Section → phase coverage matrix

Every architecture section is owned by at least one phase. `★` = primary owner, `·` = materially contributes.

| § | Topic | Primary phase(s) |
|---|-------|------------------|
| 0 | How to use the document | 23 (spec governance) |
| 1 | Mission & product definition | 00 |
| 2 | Non-negotiable requirements (REQ-CORE-001…010) | 00 ★ + traced across all |
| 3.1 | Vercel platform | 00 |
| 3.2 | End-user auth (Supabase Auth) | 03 |
| 3.3 | Database (Supabase Postgres) | 01 |
| 3.4 | Object storage (Vercel Blob / Supabase Storage) | 06 |
| 3.5 | Realtime text chat (Supabase Realtime) | 10 |
| 3.6 | Voice/VoIP (LiveKit) | 11 |
| 3.7 | Payments/donations (Stripe) | 17 |
| 3.8 | Security & anti-bot | 14, 19 |
| 3.9 | Background jobs & scheduled work | 02 |
| 4 | System architecture overview | 00 |
| 5.1 | Monorepo structure | 00 |
| 5.2 | Route structure | 05 |
| 5.3 | API route structure | 00 (scaffold) + owning feature phases |
| 6 | Frontend & design system | 05 |
| 7 | Accounts, profiles, privacy controls | 03 |
| 8 | Zones | 07 |
| 9 | Posts, comments, voting, feeds | 08 |
| 10 | Research publishing | 09 |
| 11 | Realtime text chat | 10 |
| 12 | Voice/VoIP rooms | 11 |
| 13 | Donations | 17 |
| 14 | Roles, permissions, access control | 04 |
| 15 | Admin panels | 16 |
| 16 | Moderator tiers & community governance | 15 |
| 17 | AutoMod & moderation system | 13 |
| 18 | Trust, reputation & anti-abuse | 14 |
| 19 | Data architecture | 01 |
| 20 | Row level security | 01 |
| 21 | Search architecture | 12 |
| 22 | File upload, scanning, safety | 06 |
| 23 | Compliance & legal | 18 |
| 24 | Security architecture | 19 |
| 25 | Observability & operations | 20 |
| 26 | Performance & scalability | 21 |
| 27 | Testing requirements | 22 |
| 28 | Launch-complete acceptance criteria | 23 |
| 29 | Development agent rules | 23 (binding on all) |
| 30 | Source references | 23 (appendix) |

## Coverage verification (3 review passes)

After the phases were authored, the architecture was cross-checked against them in three passes to confirm nothing was dropped:

- **Pass 1 — Section coverage:** every numbered section/subsection §0–§30 is claimed by a phase (see the matrix above). ✅ No orphan sections.
- **Pass 2 — Enumeration fidelity:** the large enumerated lists were checked verbatim — all 12 §19 table groups (every table incl. `transparency_report_events`, `governance_ballots`, `search_documents`, `mod_removal_petition_support`), all 11 global roles + full permission-scope catalog (§14), all 11 admin panels (§15), all report targets/reasons (§17.7), all runbooks (§25.4), all paper statuses (§10.6). ✅ Reproduced, not summarized.
- **Pass 3 — Requirements, routes & invariants:** REQ-CORE-001…010 each trace to an owning phase; every §5.2 page and §5.3 API route group is assigned; the 10 §29 agent rules are carried as cross-cutting invariants and mapped to enforcing phases (04, 06, 09, 11, 14, 17, 19). ✅ Complete.

No gaps were found. The notification surface (`/notifications`, `/account/notifications`, digests) is intentionally split across Phase 03 (preferences), Phase 02 (digest jobs), and Phase 05 (page shell) because the architecture has no standalone notifications section.

## Cross-cutting invariants (apply to EVERY phase)

From §29 (Development Agent Rules) — these are non-negotiable in all phases:

1. Architecture file is the source of truth; requirements carry traceable IDs in issues/PRs.
2. Never remove compliance, moderation, privacy, or admin scope as "later."
3. Never store service-role keys client-side.
4. Never bypass RLS by exposing admin APIs to clients.
5. Never create unaudited admin/moderation actions.
6. Never make donation status affect governance or ranking (REQ-CORE-010).
7. Never make recording/transcription default for voice.
8. Never silently overwrite published paper versions.
9. Never weaken global moderation rules at zone level.
10. Always add tests for privacy, permissions, and moderation-sensitive changes.
