# Phase 09 — Research Publishing System

**Source sections:** §10 Research Publishing System (10.1–10.10); supports REQ-CORE-009.

## Objectives

Deliver the open, user-published arXiv-style archive: stable immutable identifiers, full submission flow, paper pages, separate review/replication/safety tracks, status lifecycle, automatic-publish-after-safety-checks (no peer-review vouching), versioning, ranking, and research search surfacing.

## Dependencies
- Phase 06 (file pipeline + per-version immutability), Phase 08 (vote/comment engine), Phase 02 (indexing/scan workflows), Phase 12 (research search), Phase 01 (research tables).

## In scope

### Core principle (§10.1)
- Open arXiv-style archive **without platform endorsement or required vouching**. Publication allowed after required automated safety, malware, metadata, and legal checks. Platform does not certify correctness.

### Identifier (§10.2)
- Canonical: `AIOSS:YYYYMM.NNNNN`; each version immutable: `...v1`, `...v2`.
- Each version includes: version number, submission timestamp, submitter user id, file hashes, metadata snapshot, full-text snapshot, license snapshot, withdrawal/supersession status.

### Submission fields (§10.3) — MUST require
Title; abstract; authors; submitter relationship to authors; categories; tags; license; PDF upload or full text; plain-text extraction or user-provided full text; safety/dual-use disclosure; AI model/data disclosure where relevant; optional code repo link; optional dataset link; optional model artifact link; reproducibility checklist; optional conflicts/affiliations; contact preference; terms confirmation of upload rights.

### Research page (§10.4) — MUST show
Identifier; title; authors; version selector; abstract; full text; PDF view/download; file hashes; license; categories/tags; submission date; revision history; code/data/model links; citation export (**BibTeX, RIS/CSL JSON**); votes; comments; reviews; replication reports; safety flags; **"Not peer reviewed / not platform endorsed" label**; report/takedown link; related papers.

### Comments & reviews (§10.5) — separate tracks
1. Comments (open discussion). 2. Structured reviews (scored: clarity, novelty, methodology, reproducibility, safety, evidence). 3. Replication reports (environment, hardware, data, commit hash, result status, notes). 4. Safety reviews (misuse/privacy/harmful-capability/policy concerns). 5. Author responses (verified submitter/author accounts).

### Paper statuses (§10.6)
Draft (local only); submitted; published; under automated scan; quarantined; flagged; withdrawn; removed by moderation/legal; superseded; retracted; redacted. Public pages preserve transparent status history except where privacy/legal/safety prohibits.

### Immediate publishing without vouching (§10.7)
Flow: submit → draft records → upload to quarantine → malware/file validation → metadata validation → copyright/license attestation recorded → CSAM/illegal-content checks where legally/technically appropriate → if pass, auto-publish → if fail/high-risk, quarantine + route to moderation/legal → all audited. ("No vouching" = no peer-review gate, NOT no safety/legal checks.)

### Versioning (§10.8)
New version = new immutable file records; old versions remain accessible unless removed for legal/safety; latest is default; text diffs SHOULD be generated; comments/reviews linkable to specific version or whole paper.

### Research ranking (§10.9)
Separate signals: popularity votes; quality/review; replication; recency; safety flags; author reputation; zone relevance. A paper with many votes but unresolved safety/legal flags SHOULD be demoted/labeled until review.

### Research search (§10.10)
Searchable by title, abstract, full text, authors, tags, categories, identifier, code/data/model links, license, status, date, zone, review/replication status; **keyword + semantic** (Phase 12).

## Out of scope (deferred)
- File scanning internals → Phase 06. Search engine internals → Phase 12. Legal takedown/DMCA/CSAM escalation handling → Phase 18. Vote engine → Phase 08.

## Data model
`papers`, `paper_versions`, `paper_authors`, `paper_files`, `paper_links`, `paper_reviews`, `replication_reports`; `votes`/`comments` (shared).

## Routes / APIs
- Pages: `/research`, `/research/submit`, `/research/[paperId]`, `/research/[paperId]/v/[version]`, `/research/[paperId]/comments`, `/research/[paperId]/reviews`, `/research/[paperId]/replications`, `/research/[paperId]/edit`, `/research/[paperId]/withdraw`, `/research/tags/[tag]`, `/research/authors/[authorSlug]`.
- APIs: `/api/research/papers`, `/api/research/papers/[paperId]`, `.../versions`, `.../files`, `.../reviews`, `.../replications`, `.../withdraw`, `/api/research/import/arxiv-metadata-optional`.

## Work items
1. Identifier service issuing `AIOSS:YYYYMM.NNNNN` + immutable version suffixes with full per-version snapshots.
2. Submission flow capturing all §10.3 fields with rights/terms confirmation + reproducibility checklist.
3. Publishing pipeline (§10.7) on Phase 02/06: quarantine → validations → license attestation → safety checks → auto-publish or quarantine+route, fully audited.
4. Research page (§10.4) with version selector, citation export (BibTeX/RIS/CSL-JSON), file hashes, mandatory not-endorsed label, related papers.
5. Separate tracks: comments, structured scored reviews, replication reports, safety reviews, verified author responses.
6. Status lifecycle + transparent public status history (with privacy/legal/safety redaction).
7. Versioning with immutable files, default-latest, text diffs, version-scoped comments/reviews.
8. Research ranking with separated signals + demotion/labeling for unresolved safety/legal flags.
9. Optional arXiv metadata import; research search surfacing fields (Phase 12).

## Acceptance criteria
- Papers get stable canonical IDs; each version is immutable with complete snapshots.
- Submission requires all §10.3 fields; publishing is automatic only after safety/malware/metadata/legal checks; failures quarantine + route + audit.
- Paper page shows everything in §10.4 including the not-peer-reviewed/not-endorsed label and citation exports.
- All five comment/review tracks function; author responses require verified authorship.
- New versions never overwrite prior versions; old versions remain accessible unless legally/safety-removed.
- Ranking demotes/labels papers with unresolved safety/legal flags; research is keyword + semantic searchable.

## Tests (§27.1, §27.2, §27.3)
- Unit: research versioning (immutability, default-latest).
- Integration: research submission/publish/version; file scan workflow.
- E2E: submit paper; review paper.

## Requirement traceability
REQ-CORE-009; §10; agent rule §29 (#2, #8 — never silently overwrite published versions; safety scope not deferred).
