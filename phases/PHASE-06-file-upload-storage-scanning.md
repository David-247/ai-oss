# Phase 06 — File Upload, Storage, Scanning & Safety

**Source sections:** §3.4 Object Storage Decision, §22 File Upload, Scanning, and Safety (22.1–22.3); supports avatars (§7.3) and paper files (§10).

## Objectives

Deliver the end-to-end upload pipeline: permissioned upload-URL issuance, quarantine-first storage, malware/type validation, content extraction, safety classification, and publish/quarantine routing — with immutable per-version paper files and full integrity metadata.

## Dependencies
- Phase 01 (`files`, `paper_files`), Phase 02 (scan workflow framework), Phase 04 (permission checks).

## In scope

### Storage decision (§3.4)
- **Vercel Blob** for public/CDN-friendly immutable files (published paper PDFs, paper source archives, avatars, public attachments **after** scanning).
- **Supabase Storage** MAY hold private/quarantined uploads when RLS is needed pre-publication.
- Every uploaded file MUST have a `files` record: owner, uploader, entity relationship, original filename, content type, size, sha256, storage provider, storage key, scan status, moderation status, visibility, retention status.
- **Published paper files MUST be immutable per version**; a new version creates new file records + new hashes and MUST NOT overwrite an earlier published version.

### Upload pipeline (§22.1)
1. Request upload URL from server.
2. Server checks permissions, file type, size, rate limits.
3. File uploads to quarantine/private storage.
4. File record created.
5. Scan workflow starts (Phase 02).
6. Malware/file-type validation.
7. Content extraction where appropriate.
8. Moderation/safety classification.
9. If clean → move/mark public or attach to entity.
10. If suspicious → quarantine + route to moderation/legal (Phase 13/18).

### File types (§22.2)
- Allowed SHOULD include: PDF, Markdown, plain text, LaTeX/source archive, figure images, small supplementary archives, dataset manifests (not large raw datasets), CSV/JSON small supplements.
- Large datasets SHOULD be linked externally with metadata rather than hosted, unless storage/cost policy approves (Phase 21).

### File integrity (§22.3)
- Every file stores: SHA256, size, **server-side detected MIME type**, original filename, storage key, scan status, publication status, associated entity/version.

## Out of scope (deferred)
- Paper version semantics/UX → Phase 09 (this phase guarantees immutability primitives). CSAM/illegal-content legal escalation routing → Phase 18. Storage quotas by trust level → Phase 21. AutoMod file-condition rules → Phase 13.

## Data model
`files`, `paper_files` (linkage), references from `profiles.avatar_file_id`.

## Routes / APIs
- `/api/files/upload-url`, `/api/files/complete`.
- `/api/research/papers/[paperId]/files` (consumed by Phase 09).

## Work items
1. Implement signed upload-URL issuance with server-side permission/type/size/rate-limit checks.
2. Upload to quarantine (Supabase Storage private) first; create `files` record with full integrity metadata + server-detected MIME.
3. Implement scan workflow (on Phase 02 framework): malware + file-type validation, content extraction, safety classification.
4. On clean: promote public files to Vercel Blob (immutable); attach to entity. On suspicious: quarantine + route to moderation/legal queue.
5. Enforce per-version immutability for paper files (no overwrite; new hash per version).
6. Wire avatar uploads (Phase 03) and paper-file uploads (Phase 09) through this pipeline.

## Acceptance criteria
- Uploads require permission and pass type/size/rate checks; unscanned files never publicly accessible.
- Every file has complete integrity metadata incl. server-detected MIME + SHA256.
- Clean files become CDN-served immutable Blob objects; suspicious files quarantine and route to moderation/legal.
- Publishing a new paper version never overwrites a prior version's files/hashes.

## Tests (§27.1, §27.2, §27.4)
- Unit: integrity metadata computation; immutability guard.
- Integration: file scan workflow happy + quarantine paths.
- Security: malicious-file upload simulation; type-spoofing (MIME mismatch) rejected; signed-URL scope enforcement.

## Requirement traceability
§3.4, §22; agent rule §29 (#8 — never overwrite published versions).
