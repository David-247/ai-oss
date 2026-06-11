# Phase 21 — Performance & Scalability

**Source sections:** §26 Performance and Scalability (26.1–26.3); supports §6 perf goals.

## Objectives

Meet the performance budgets, apply the scalability patterns, and implement cost controls so the platform is fast, scalable, and economically sustainable at launch.

## Dependencies
- All feature phases (targets of optimization), Phase 20 (CWV/latency metrics), Phase 12 (search), Phase 02 (job quotas).

## In scope

### Performance budgets (§26.1) — public pages SHOULD target
LCP < 2.5s on good mobile network; INP < 200ms; CLS < 0.1; search response < 500ms for common queries; realtime chat perceived latency < 500ms; lean initial page JS via server components + route splitting.

### Scalability patterns (§26.2) — use
Cursor pagination; infinite loading with virtualization; materialized counters; denormalized score fields updated safely; background indexing; cache public pages where safe; RLS-aware queries; avoid N+1; database indexes for all feed/search/mod-queue paths; connection pooling; job queues for heavy tasks.

### Cost controls (§26.3) — implement
Upload size limits; storage quotas by trust level; voice-room duration limits; chat rate limits; embedding-job quotas; search throttles; admin cost dashboard; donation-funding transparency.

## Out of scope (deferred)
- Metric collection itself → Phase 20. Rate-limit enforcement primitives → Phase 14/19 (this phase tunes them for cost/perf).

## Work items
1. Establish performance budgets in CI (Lighthouse/CWV checks) for public pages; enforce LCP/INP/CLS/search/chat-latency targets.
2. Implement cursor pagination + virtualized infinite loading across feeds/search/queues.
3. Implement materialized/denormalized counters (score, comment_count) with safe concurrent updates; background indexing.
4. Add DB indexes for every feed/search/mod-queue/governance path; connection pooling; eliminate N+1; RLS-aware query patterns.
5. Cache public pages where safe (respecting visibility/moderation state).
6. Cost controls: upload size limits; storage quotas by trust level (Phase 14); voice duration limits; chat rate limits; embedding-job + search throttles; admin cost dashboard; donation-funding transparency page.

## Acceptance criteria
- Public pages meet LCP/INP/CLS budgets on good mobile network; search < 500ms common queries; chat perceived latency < 500ms.
- Feeds/search/queues use cursor pagination + virtualization; no N+1 on hot paths; required indexes present.
- Cost controls enforced (upload/storage/voice/chat/embedding/search limits); admin cost dashboard live.

## Tests (§27.3 partial, perf)
- Perf checks in CI (CWV budgets).
- Load/scale checks on feed, search, and mod-queue hot paths.

## Requirement traceability
REQ-CORE-003 (responsive perf); §26; agent rule §29 (#10).
