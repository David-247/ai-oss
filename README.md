# AI-OSS.net

An open research-coordination platform for independent AI researchers,
open-source AI developers, safety researchers, and evaluators — a public,
community-run research lab combining forum-style discussion, an arXiv-style
research archive, realtime text and voice rooms, community moderation,
governance, and donations.

Production: **https://www.ai-oss.net/**

## Tech stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind CSS**
- **Supabase** (Postgres, Auth, Realtime, Storage)
- **pnpm** workspaces + **Turborepo**
- Deployed on **Vercel**

## Repository layout

```
apps/web/                 # Next.js application
packages/db/              # database schema, migrations, typed access
packages/auth/            # auth wrappers & session helpers
packages/permissions/     # RBAC/ABAC policy engine
packages/moderation/      # automoderation engine & safety classifiers
packages/search/          # full-text & vector search helpers
packages/design-system/   # Tailwind config & shared UI components
packages/shared/          # shared schemas, constants, utilities
supabase/                 # migrations / policies / seed
tests/                    # e2e / integration / security / rls
```

## Getting started

Requirements: **Node ≥ 22**, **pnpm ≥ 9** (`corepack enable`).

```bash
pnpm install        # install workspace dependencies
pnpm dev            # run the web app locally
pnpm lint           # lint the workspace
pnpm typecheck      # type-check the workspace
pnpm test           # run the test suites
pnpm build          # production build
```

Copy [`.env.example`](.env.example) to `.env.local` and fill in your own
values. Variables prefixed `NEXT_PUBLIC_` are exposed to the browser — never
put secrets behind that prefix.

## Contributing

Pull requests run CI (lint, type-check, tests, build, secret scanning, SAST,
and license checks) and require review before merging to `main`.

## License

[MIT](LICENSE)
