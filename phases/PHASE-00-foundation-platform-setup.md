# Phase 00 — Foundation, Platform & Project Setup

**Source sections:** §1 Mission, §2 Non-Negotiable Requirements, §3 Platform Findings & Chosen Services, §4 System Architecture Overview, §5.1 Monorepo Structure, §5.3 API Route scaffolding, §24.4 Supply Chain.

## Objectives

Stand up the project skeleton, hosting, domains, and the provider accounts that every later phase builds on. After this phase the repo deploys a "hello platform" Next.js app on Vercel at the canonical domain, with all chosen services provisioned and wired into environment configuration, and CI/branch protection enforcing the supply-chain rules.

## Dependencies

None. This is the root phase.

## In scope

### Mission & product framing (§1)
- Record the product definition (open research-coordination platform = forum + arXiv-style archive + realtime rooms + moderation + governance + donations) in `docs/` so downstream phases share intent.

### Non-negotiable requirements (§2) — establish and track
- **REQ-CORE-001** Production site available at `https://www.ai-oss.net/`.
- **REQ-CORE-002** Apex `https://ai-oss.net/` permanently redirects (HTTP **308**) to `www`.
- **REQ-CORE-003** Desktop, tablet, mobile layouts from first build (delivered in Phase 05; budgeted here).
- **REQ-CORE-004** Frontend stack = React + TypeScript + Tailwind + Next.js on Vercel.
- **REQ-CORE-005** Prefer Vercel first-party / Marketplace services.
- **REQ-CORE-006** Architecture supports distributed-lab behavior (delivered across feature phases).
- **REQ-CORE-007..010** tracked and routed to owning phases (03, 08–17).

### Platform decisions to provision (§3)
- **§3.1** Vercel project: Next.js App Router, RSC where appropriate, Route Handlers, Server Actions, Vercel Functions. Document that long-lived WebSocket processes are NOT run inside functions.
- **§3.2** Provision **Supabase Auth** (public users) via Vercel Marketplace integration (wired in Phase 03).
- **§3.3** Provision **Supabase Postgres** as primary DB via Marketplace (schema in Phase 01).
- **§3.4** Provision **Vercel Blob** + **Supabase Storage** (pipeline in Phase 06).
- **§3.5** Provision **Supabase Realtime** (Phase 10).
- **§3.6** Provision **LiveKit Cloud** project + keys (Phase 11).
- **§3.7** Provision **Stripe** via Marketplace (Phase 17).
- **§3.8** Provision Vercel WAF, rate limiting, **BotID**, and Redis/Upstash for app rate limits (Phases 14/19).
- **§3.9** Provision Vercel Workflows / Queues / Cron (Phase 02).

### System architecture (§4)
- Capture the high-level component diagram (Users → Edge/WAF/BotID → Next.js → Auth/DB/Realtime/Blob/LiveKit/Stripe/Jobs) and the runtime responsibility table as living docs under `docs/architecture/`.
- Configure Vercel Edge responsibilities: TLS, CDN caching of public assets, WAF rules placeholder, rate limiting placeholder, bot challenge placeholder, **apex→www 308 redirect** (implement here).

### Monorepo structure (§5.1)
Create the exact layout:
```
ai-oss/
  apps/web/                      # Next.js app
  packages/db/                   # schema, SQL migrations, typed DB access
  packages/auth/                 # Supabase auth wrappers, session helpers
  packages/permissions/          # RBAC/ABAC policy engine
  packages/moderation/           # AutoMod engine + safety classifiers
  packages/search/               # FTS + vector search helpers
  packages/design-system/        # Tailwind config, shadcn/radix components
  packages/shared/               # Zod schemas, constants, utilities
  supabase/{migrations,policies,seed}/
  docs/{architecture,policies,runbooks,admin,moderation}/
  tests/{e2e,integration,security,rls}/
```
- Place the source-of-truth doc at `docs/architecture/AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md`.

### API surface scaffold (§5.3)
- Scaffold the top-level `/api/*` route groups (`auth`, `account`, `zones`, `posts`, `comments`, `votes`, `reports`, `research`, `chat`, `voice`, `search`, `moderation`, `admin`, `stripe`, `files`, `cron`, `workflows`) as stubs returning 501, so owning phases fill them in. Full per-route detail lives in each feature phase.

### Supply chain & CI (§24.4)
- GitHub branch protection on the deploy branch; required PR reviews; required CI (lint, typecheck, unit tests).
- Dependency lockfile committed; Dependabot/Renovate enabled.
- Secret scanning + SAST + license scanning in CI.
- Production deploys only from the protected branch.
- Environment variables scoped per environment (Preview/Production), no secrets in client bundles.

## Out of scope (deferred)
- DB schema & RLS → Phase 01. Auth flows → Phase 03. UI/design → Phase 05. All feature endpoints' bodies → owning phases. Full security headers/WAF rules → Phase 19.

## Routes / APIs
- `/` placeholder landing (real version in Phase 05).
- Apex→www 308 redirect (edge/middleware).
- `/api/*` 501 stubs.

## Work items
1. Initialize monorepo (pnpm/turbo or equivalent) with the §5.1 tree.
2. Create Vercel project; connect Git; configure Production branch + environments.
3. Register domain; set `www` as canonical; implement apex→www **308** redirect; enable HSTS-ready TLS.
4. Provision each Marketplace/first-party service (Supabase, Blob, Realtime, LiveKit, Stripe, BotID, Upstash) and store credentials as scoped env vars; document them in `docs/architecture/`.
5. Commit architecture docs + component diagram + runtime responsibilities.
6. Scaffold `/api/*` route groups as 501 stubs.
7. Configure CI pipeline (lint/typecheck/test/SAST/secret-scan/license-scan) and branch protection.
8. Establish requirement-ID traceability convention (REQ-CORE-xxx referenced in issues/PRs) per §29.

## Acceptance criteria
- `https://www.ai-oss.net/` serves the deployed app; `https://ai-oss.net/` returns **308** to `www`.
- All §3 services are provisioned with credentials in scoped env vars (no client exposure).
- Monorepo matches §5.1 exactly; architecture docs committed.
- CI blocks merges on failing lint/typecheck/tests; production deploys only from protected branch.
- `/api/*` groups exist as stubs.

## Tests
- CI smoke: build + deploy preview succeeds.
- Redirect test: apex → `www` is 308.
- Env hygiene test: no service-role/secret keys present in the client bundle.

## Requirement traceability
REQ-CORE-001, -002, -004, -005; agent rules §29 (#1, #3, #10 conventions established).
