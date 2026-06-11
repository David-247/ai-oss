# Provisioned Services & Environment Mapping (§3)

> Which external services back the platform, the env vars that wire them in,
> and the phase that actually consumes each one. Provisioning steps live in
> [`../runbooks/provisioning.md`](../runbooks/provisioning.md). Variable
> template: [`.env.example`](../../.env.example).

| § | Service | Purpose | Env vars | Client-exposed? | Consumed in |
| --- | --- | --- | --- | --- | --- |
| 3.1 | **Vercel** | Hosting: Next.js App Router, RSC, Route Handlers, Server Actions, Functions | (platform) | — | P00+ |
| 3.2 | **Supabase Auth** | Public user auth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 🔒 | anon only | P03 |
| 3.3 | **Supabase Postgres** | Primary database | `DATABASE_URL` 🔒 | no | P01 |
| 3.4 | **Vercel Blob + Supabase Storage** | File/object storage | `BLOB_READ_WRITE_TOKEN` 🔒 | no | P06 |
| 3.5 | **Supabase Realtime** | Realtime text channels | (Supabase URL/anon, above) | anon only | P10 |
| 3.6 | **LiveKit Cloud** | Voice rooms | `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY` 🔒, `LIVEKIT_API_SECRET` 🔒 | url only | P11 |
| 3.7 | **Stripe** | Donations / payments | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` 🔒, `STRIPE_WEBHOOK_SECRET` 🔒 | publishable only | P17 |
| 3.8 | **Vercel WAF + BotID + Upstash Redis** | Bot resistance & rate limiting | `BOTID_SECRET` 🔒, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 🔒 | no | P14 / P19 |
| 3.9 | **Vercel Workflows / Queues / Cron** | Background jobs | (platform) | — | P02 |

🔒 = secret. MUST be scoped per-environment in Vercel (Preview/Production) and
MUST NOT appear in the client bundle. Prefer Vercel Marketplace integrations
(REQ-CORE-005) so credentials are injected as managed environment variables.

## Environment scoping rules (§24.4)

- Real secrets live only in Vercel project env settings (and local
  `.env.local`, which is git-ignored). `.env.example` ships placeholders only.
- `NEXT_PUBLIC_*` is the **only** prefix bundled to the client. Never give a
  secret that prefix. Enforced by `tests/security/env-hygiene.test.ts`.
- Production secrets differ from Preview secrets; never reuse production
  service-role keys in Preview.
