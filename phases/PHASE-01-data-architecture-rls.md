# Phase 01 — Data Architecture & Row Level Security

**Source sections:** §3.3 Database, §19 Data Architecture (19.1–19.12), §20 Row Level Security and Data Access.

## Objectives

Define the complete relational schema, indexes, soft-delete/anonymization patterns, and RLS policies that every feature phase depends on. All tables from §19 exist as migrations in-repo; RLS is enabled on all user-accessible tables with the §20 access rules enforced.

## Dependencies
- Phase 00 (Supabase Postgres provisioned, monorepo `packages/db` + `supabase/`).

## In scope

### Mandatory database features (§3.3)
- Relational source of truth; Row Level Security; migrations stored in repo; full-text search columns + indexes; pgvector embeddings; audit/event tables; soft-delete + anonymization patterns for public UGC; strict separation of public / private / moderator-only / admin-only / security-sensitive data.

### Tables (§19) — create all
- **19.1 Core identity:** `profiles`, `user_settings`, `user_security_state`, `consent_events`.
- **19.2 Authorization:** `roles`, `role_bindings`, `permission_audit`.
- **19.3 Zone:** `zones`, `zone_members`, `zone_flairs`, `zone_wiki_pages`, `zone_settings`, `zone_governance_settings`.
- **19.4 Discussion:** `posts`, `comments`, `votes` (with `unique(user_id,target_type,target_id)`).
- **19.5 Research:** `papers`, `paper_versions` (`unique(paper_id,version_number)`), `paper_authors`, `paper_files`, `paper_links`, `paper_reviews`, `replication_reports`.
- **19.6 Chat/voice:** `chat_rooms`, `chat_room_members`, `chat_messages`, `voice_rooms` (recording/transcription default false), `voice_participants`.
- **19.7 Moderation:** `reports`, `moderation_actions`, `appeals`, `automod_rules`, `automod_runs`.
- **19.8 Governance:** `mod_removal_petitions`, `mod_removal_petition_support`, `governance_votes`, `governance_ballots`.
- **19.9 Files:** `files` (owner, provider, key, filename, content_type, size, sha256, visibility, scan_status, moderation_status, soft-delete).
- **19.10 Search:** `search_documents` (target, visibility, zone, title, body, metadata, `tsv tsvector`, `embedding vector`).
- **19.11 Donations:** `donations`, `stripe_events`.
- **19.12 Audit/compliance:** `audit_events`, `privacy_requests`, `legal_requests`, `transparency_report_events`.

Reproduce column definitions exactly as specified in §19 (types, PKs, uniques, nullability, `deleted_at`/`anonymized_at` columns).

### Indexing
- Indexes for every feed / search / mod-queue / governance query path (detailed budgets in §26.2). FTS GIN index on `search_documents.tsv`; ANN index on `embedding`.

### RLS policies (§20)
- Enable RLS on **all** user-accessible tables.
- Users can read public content; read their own private data; update only their own profile fields.
- Users CANNOT update trust scores, roles, audit logs, vote certification, moderation states, or payment records.
- Zone-private content visible only to authorized members.
- Chat messages visible only to room members + authorized mods/admins.
- Admin-only tables not exposed to client Supabase queries; all admin APIs server-side only.
- Service-role key never client-side.
- `search_documents` populated/visible only for content the querying user may see (§19.10).

### Patterns
- Soft-delete (`deleted_at`) + anonymization (`anonymized_at`) helpers for public UGC; document the published-research exception (withdraw/redact, not destroy) used by Phase 09.
- Seed data for system roles (consumed by Phase 04) and any enums.

## Out of scope (deferred)
- Application-level permission engine → Phase 04 (this phase is DB-level RLS only). Embedding generation jobs → Phase 02/12. Stripe write paths → Phase 17.

## Data model
All §19 tables (this phase owns them).

## Work items
1. Author SQL migrations under `supabase/migrations/` for every §19 table with exact columns/constraints.
2. Add FTS columns/triggers and pgvector columns + indexes.
3. Add soft-delete/anonymization columns and helper functions.
4. Write RLS policies under `supabase/policies/` implementing all §20 rules; enable RLS per table.
5. Typed DB access layer in `packages/db` (Prisma/Drizzle) mirroring the schema.
6. Seed scripts in `supabase/seed/` (system roles, enums, demo fixtures for tests).
7. Add `tests/rls/` harness.

## Acceptance criteria
- All §19 tables migrate cleanly from empty DB; uniques/PKs enforced (vote uniqueness, paper version uniqueness).
- RLS enabled on every user-accessible table; §20 rules verified by tests.
- Anonymous/other-user clients cannot read private data, cannot mutate protected columns (trust score, roles, audit, votes certification, moderation, payments).
- `search_documents` visibility filtering proven.
- Typed DB client compiles and matches schema.

## Tests (§27.1, §27.2 partial)
- Unit: vote uniqueness constraint; research version uniqueness.
- RLS suite (`tests/rls/`): read/update isolation per §20, private-zone and private-chat isolation, protected-column immutability.

## Requirement traceability
§3.3, §19, §20; agent rules §29 (#3, #4 — RLS not bypassed, no client service key).
