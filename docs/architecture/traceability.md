# Requirement-ID Traceability Convention (§29)

> Established in Phase 00 (work item 8). Every non-trivial change must trace
> back to a requirement in the source-of-truth architecture document.

## Requirement IDs

Core non-negotiable requirements use the `REQ-CORE-NNN` namespace (§2):

| ID | Requirement | Status after Phase 00 |
| --- | --- | --- |
| REQ-CORE-001 | Production site at `https://www.ai-oss.net/` | Deploy wired; goes live when domain is attached |
| REQ-CORE-002 | Apex → `www` permanent **308** redirect | ✅ implemented (middleware + test) |
| REQ-CORE-003 | Desktop/tablet/mobile layouts from first build | Budgeted here; delivered P05 |
| REQ-CORE-004 | Stack = React + TypeScript + Tailwind + Next.js on Vercel | ✅ scaffolded |
| REQ-CORE-005 | Prefer Vercel first-party / Marketplace services | ✅ documented in services.md |
| REQ-CORE-006 | Architecture supports distributed-lab behavior | Tracked across feature phases |
| REQ-CORE-007..010 | Routed to owning phases (03, 08–17) | Tracked |

Feature-specific requirements use their section number from the architecture
doc (e.g. `§5.3`, `§24.4`) until promoted to a stable `REQ-<AREA>-NNN` id by
the owning phase.

## How to reference requirements

- **Branches:** `phase-NN/<short-slug>` (e.g. `phase-00/foundation`).
- **Commits:** include the requirement/section id in the body, e.g.
  `Implements REQ-CORE-002 (apex→www 308).`
- **Pull requests:** the PR description MUST list the requirement IDs it
  satisfies and link the owning phase. Use the checklist in
  [`.github/pull_request_template.md`](../../.github/pull_request_template.md).
- **Issues:** title or labels carry the requirement/section id.
- **Code:** where a file enforces a requirement, cite it in a comment
  (e.g. `// REQ-CORE-002:` in `apps/web/src/lib/canonical.ts`).

## Agent rules (§29) established here

- **#1** Trace all work to the architecture document.
- **#3** Requirement IDs referenced in issues/PRs.
- **#10** No silent weakening of MUST/MUST NOT requirements without a versioned
  architecture amendment.
