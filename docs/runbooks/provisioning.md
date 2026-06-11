# Runbook: Platform & Service Provisioning (Phase 00, work items 2–4)

> These steps require the owner's accounts and credentials and **cannot be done
> from the repo alone**. They complete the Phase 00 acceptance criteria that
> depend on live infrastructure. Tick each box as it is done.

## 1. Vercel project (§3.1, work item 2)

- [ ] Create a Vercel project and connect this Git repository.
- [ ] Set the **Production branch** to `main`.
- [ ] Confirm environments exist: **Production** and **Preview**.
- [ ] Framework preset: **Next.js**. Root directory: `apps/web`.
      Build command: `pnpm build` (Turbo). Install: `pnpm install`.
- [ ] Enable Vercel's automatic Preview deployments on PRs.

## 2. Domain & canonical redirect (§2, REQ-CORE-001/002, work item 3)

- [ ] Register / attach `ai-oss.net` and `www.ai-oss.net` to the project.
- [ ] Set **`www.ai-oss.net` as the canonical (primary) domain**.
- [ ] Configure the apex `ai-oss.net` to redirect to `www` — Vercel issues a
      permanent redirect; the app **also** enforces a **308** in
      `apps/web/src/middleware.ts` (defense in depth).
- [ ] Confirm TLS certificates issue for both hosts (HSTS header is already
      asserted in `next.config.mjs`).
- [ ] Verify: `curl -sI https://ai-oss.net/` returns `HTTP/2 308` with
      `location: https://www.ai-oss.net/`.

## 3. Service provisioning (§3, work item 4)

Prefer **Vercel Marketplace** integrations (REQ-CORE-005) so credentials are
injected as managed, environment-scoped variables. For each service, store the
credentials from [`docs/architecture/services.md`](../architecture/services.md)
as scoped env vars (Preview + Production separately). Never expose secrets to
the client (no `NEXT_PUBLIC_` prefix on secrets).

- [ ] **Supabase** (Auth §3.2 + Postgres §3.3 + Realtime §3.5) via Marketplace.
      Capture `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY` 🔒, `DATABASE_URL` 🔒.
- [ ] **Vercel Blob** (§3.4) → `BLOB_READ_WRITE_TOKEN` 🔒.
- [ ] **LiveKit Cloud** (§3.6) project + keys → `NEXT_PUBLIC_LIVEKIT_URL`,
      `LIVEKIT_API_KEY` 🔒, `LIVEKIT_API_SECRET` 🔒.
- [ ] **Stripe** (§3.7) via Marketplace → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
      `STRIPE_SECRET_KEY` 🔒, `STRIPE_WEBHOOK_SECRET` 🔒.
- [ ] **BotID + Vercel WAF + rate limiting** (§3.8) → `BOTID_SECRET` 🔒.
- [ ] **Upstash Redis** (§3.8) → `UPSTASH_REDIS_REST_URL`,
      `UPSTASH_REDIS_REST_TOKEN` 🔒.
- [ ] **Vercel Workflows / Queues / Cron** (§3.9) — enable; no app secrets yet.

## 4. Branch protection & CI (§24.4, work item 7)

See [`branch-protection.md`](./branch-protection.md). CI is defined in
`.github/workflows/ci.yml`; Dependabot in `.github/dependabot.yml`.
