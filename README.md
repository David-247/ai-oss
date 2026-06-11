# AI-OSS.net

Open research-coordination platform for independent AI researchers,
open-source AI developers, safety researchers, and evaluators — a public,
community-run research lab (forum + arXiv-style archive + realtime rooms +
moderation + governance + donations).

> **Controlling spec:** [`docs/architecture/AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md`](docs/architecture/AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md).
> All work traces back to it — see [traceability](docs/architecture/traceability.md).

## Status

**Phase 00 — Foundation, Platform & Project Setup.** This repo scaffolds the
monorepo, the Next.js app (placeholder landing), `/api/*` 501 stubs, the
apex→www 308 redirect, CI/supply-chain gates, and architecture docs. Live
infrastructure (Vercel project, domain, Supabase/LiveKit/Stripe accounts) is
provisioned via [the runbook](docs/runbooks/provisioning.md).

## Repository layout (§5.1)

```
apps/web/            # Next.js App Router app (React + TS + Tailwind)
packages/db/         # schema, SQL migrations, typed DB access     (P01)
packages/auth/       # Supabase auth wrappers, session helpers     (P03)
packages/permissions/# RBAC/ABAC policy engine
packages/moderation/ # AutoMod engine + safety classifiers
packages/search/     # FTS + vector search helpers
packages/design-system/ # Tailwind config, shadcn/radix components (P05)
packages/shared/     # Zod schemas, constants, utilities
supabase/            # migrations / policies / seed                (P01)
docs/                # architecture / policies / runbooks / admin / moderation
tests/               # e2e / integration / security / rls
```

## Prerequisites

- Node `>= 22` (see `.nvmrc`)
- pnpm `>= 9` (`corepack enable && corepack prepare pnpm@9 --activate`)

## Commands

```bash
pnpm install        # install workspace deps
pnpm dev            # run the web app locally
pnpm lint           # eslint across the workspace
pnpm typecheck      # tsc --noEmit across the workspace
pnpm test           # vitest (integration + security suites)
pnpm build          # turbo build (incl. next build)
```

## Environment

Copy [`.env.example`](.env.example) to `.env.local` and fill values from the
[provisioning runbook](docs/runbooks/provisioning.md). Secrets must never carry
the `NEXT_PUBLIC_` prefix — enforced by `tests/security/env-hygiene.test.ts`.

## Contributing

PRs must reference the requirement ID(s) / architecture section they satisfy
(see the [PR template](.github/pull_request_template.md)) and pass CI
(lint, typecheck, test, build, secret-scan, SAST, license-scan).
