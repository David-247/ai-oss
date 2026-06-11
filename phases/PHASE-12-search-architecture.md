# Phase 12 — Search Architecture

**Source sections:** §3.3 (FTS + pgvector), §10.10 (research search), §21 Search Architecture (21.1–21.4).

## Objectives

Deliver authorization-aware hybrid search (Postgres FTS + pgvector semantic), the indexing pipeline, all search surfaces, and SEO/agent-readability assets — never leaking content the querying user may not see.

## Dependencies
- Phase 01 (`search_documents`, FTS/vector columns), Phase 02 (indexing/embedding jobs), and content phases (07/08/09/10) producing indexable entities.

## In scope

### Hybrid search (§21.1)
- Combine Postgres full-text search (exact/keyword) + pgvector semantic search; facets/filters; **authorization-aware filtering**; ranking that respects visibility, moderation status, user permissions.

### Indexing (§21.2)
1. Content created/updated → 2. event to queue/workflow → 3. text extracted/sanitized → 4. `search_documents` upserted → 5. embeddings generated asynchronously → 6. doc marked fresh → 7. deleted/private/quarantined content removed from public index.

### Search surfaces (§21.3) — MUST cover
Zones; posts; comments; research papers; paper full text; reviews; replication reports; users (where profile visibility allows); tags; chat (only within accessible rooms and only if enabled).

### SEO & agent readability (§21.4) — public pages MUST include
Canonical URLs; Open Graph metadata; structured metadata for papers; sitemaps; RSS/Atom feeds for zones and research; `robots.txt`; **`/llms.txt`** describing public research/archive access + API policies; **public read API for papers and metadata**.

### Research search fields (§10.10)
Title, abstract, full text, authors, tags, categories, identifier, code/data/model links, license, status, date, zone, review/replication status; keyword + semantic.

## Out of scope (deferred)
- Search throttles/cost quotas → Phase 21. Embedding job framework → Phase 02. Per-entity content creation → owning phases.

## Data model
`search_documents` (`tsv tsvector`, `embedding vector`, `visibility`, `zone_id`); only populated for content the querying user may see (§19.10).

## Routes / APIs
- Pages: `/search`.
- APIs: `/api/search`, `/api/search/suggest`; public read API for papers/metadata; `/sitemap.xml`, `/robots.txt`, `/llms.txt`, RSS/Atom feeds.

## Work items
1. Implement FTS indexing + query; pgvector semantic query; hybrid ranking blending both with visibility/permission/moderation filters.
2. Build indexing pipeline (Phase 02): extract/sanitize → upsert `search_documents` → async embeddings → freshness flag → purge deleted/private/quarantined.
3. Implement all §21.3 surfaces incl. permission-scoped chat search and visibility-gated user search.
4. Faceted filters for research (all §10.10 fields) + general search.
5. SEO/agent assets: canonical URLs, OG metadata, paper structured metadata, sitemaps, RSS/Atom, robots.txt, `/llms.txt`, public read API.
6. `/api/search/suggest` autocomplete.

## Acceptance criteria
- Hybrid keyword + semantic search returns results; private/quarantined/deleted content never appears for unauthorized users.
- All §21.3 surfaces searchable with correct visibility scoping.
- Research searchable across all §10.10 fields.
- SEO assets present; `/llms.txt` and public paper read API serve documented content.

## Tests (§27.2, §27.4)
- Integration: index → search freshness; research field search.
- Security: private-zone search leakage attempt fails; private-chat search excluded.

## Requirement traceability
§3.3, §10.10, §21; agent rule §29 (#4 — no visibility bypass).
