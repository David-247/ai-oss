# Phase 02 — Background Jobs & Workflow Infrastructure

**Source sections:** §3.9 Background Jobs and Scheduled Work, §4.2 (Workflows/Queues/Cron runtime responsibilities).

## Objectives

Establish the durable, idempotent, retry-safe background processing framework that later phases plug into (file scanning, embeddings, notifications, moderation jobs, vote certification, privacy exports, account deletion, digest emails, transparency rollups). This phase delivers the *framework and conventions*, plus stubs for each job type; the job *bodies* are implemented in their owning phases.

## Dependencies
- Phase 00 (Vercel Workflows/Queues/Cron provisioned), Phase 01 (tables the jobs read/write).

## In scope

### Durable processing choices (§3.9)
- **Vercel Workflows** for durable multi-step jobs.
- **Vercel Queues** for lower-level message processing.
- **Vercel Cron Jobs** for scheduled tasks.
- **Vercel Functions `waitUntil`** ONLY for non-critical after-response work (analytics logging, cache updates).
- **Critical jobs MUST be idempotent and retry-safe** — provide idempotency-key + dedupe helpers and a standard retry/backoff/dead-letter pattern.

### Job catalog to register (§3.9, §4.2) — framework + stub for each
- File scan workflow (owner: Phase 06).
- Paper indexing workflow (owner: Phase 09/12).
- Embedding generation (owner: Phase 12).
- Moderation queue processing (owner: Phase 13).
- Vote certification (owner: Phase 08/14).
- Transparency report rollups (owner: Phase 18).
- Privacy export & account deletion/anonymization jobs (owner: Phase 03/18).
- Notification digest emails (owner: Phase 03).
- Search maintenance (owner: Phase 12).

### Routing
- `/api/cron/*` and `/api/workflows/*` handlers (scaffolded in Phase 00) get the dispatch/trigger framework here.

## Out of scope (deferred)
- Concrete job logic lives in owning phases. Alerting on job failure → Phase 20. Cost quotas for embedding/search jobs → Phase 21.

## Work items
1. Define a job framework in `packages/shared` (or `packages/jobs`): typed job definitions, idempotency keys, retry/backoff, dead-letter handling, correlation IDs.
2. Wire Vercel Workflows for multi-step durable jobs; Queues for message processing; Cron for schedules.
3. Implement `/api/cron/*` and `/api/workflows/*` dispatchers with signature/secret verification.
4. Register stubs for every job in the catalog with no-op idempotent handlers + tests.
5. Standardize `waitUntil` usage rule (non-critical only) with a lint/convention check.
6. Emit structured logs + correlation IDs for each job run (consumed by Phase 20).

## Acceptance criteria
- A demonstrably idempotent sample job: re-running with the same idempotency key produces no duplicate effects.
- Failed jobs retry with backoff and land in a dead-letter path after exhaustion.
- Cron and workflow endpoints reject unsigned/unauthorized triggers.
- Every catalog job has a registered stub + passing idempotency test.

## Tests (§27.1 partial)
- Unit: idempotency-key dedupe; retry/backoff; webhook/cron trigger auth.
- Integration: end-to-end durable workflow happy path + failure/retry.

## Requirement traceability
§3.9; agent rule §29 (#5 — actions auditable; #10 — tests for sensitive jobs).
