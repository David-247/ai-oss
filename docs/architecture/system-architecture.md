# System Architecture Overview (§4)

> Living document. High-level component diagram + runtime responsibility table.
> Source of truth: [`AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md`](./AI_OSS_ARCHITECTURE_SOURCE_OF_TRUTH.md).

## Component diagram

```
                         ┌─────────────────────────────────────────────┐
        Users  ─────────▶│  Vercel Edge                                 │
   (web / mobile)        │  • TLS termination (HSTS-ready)              │
                         │  • CDN caching of public assets              │
                         │  • WAF rules            (placeholder → P19)  │
                         │  • Rate limiting        (placeholder → P19)  │
                         │  • Bot challenge / BotID(placeholder → P14)  │
                         │  • apex → www  HTTP 308 redirect  (Phase 00) │
                         └───────────────────────┬─────────────────────┘
                                                 │
                                                 ▼
                         ┌─────────────────────────────────────────────┐
                         │  Next.js App (App Router) on Vercel          │
                         │  • RSC + Route Handlers + Server Actions     │
                         │  • Vercel Functions (NO long-lived sockets)  │
                         └───────┬───────────┬───────────┬─────────────┘
                                 │           │           │
         ┌───────────────────────┼───────────┼───────────┼───────────────────────┐
         ▼                       ▼           ▼           ▼                       ▼
  ┌────────────┐        ┌──────────────┐ ┌────────┐ ┌──────────┐         ┌──────────────┐
  │ Supabase   │        │ Supabase     │ │ Vercel │ │ LiveKit  │         │ Stripe       │
  │ Auth (P03) │        │ Postgres(P01)│ │ Blob + │ │ Cloud    │         │ (P17)        │
  │            │        │ + Realtime   │ │ Supa   │ │ voice    │         │ donations    │
  │            │        │ (P10)        │ │ Storage│ │ (P11)    │         │              │
  └────────────┘        └──────────────┘ │ (P06)  │ └──────────┘         └──────────────┘
                                         └────────┘
                         ┌─────────────────────────────────────────────┐
                         │  Jobs: Vercel Workflows / Queues / Cron (P02)│
                         │  Rate-limit store: Upstash Redis (P14/P19)   │
                         └─────────────────────────────────────────────┘
```

## Runtime responsibility table

| Layer                     | Responsibility                                                        | Owning phase |
| ------------------------- | -------------------------------------------------------------------- | ------------ |
| Vercel Edge               | TLS, CDN, WAF, rate limiting, bot challenge, **apex→www 308**         | P00 (redirect), P14/P19 (security) |
| Next.js App Router        | UI, RSC, Route Handlers, Server Actions, request orchestration        | P00 scaffold, feature phases |
| Vercel Functions          | Server-side compute. **No long-lived WebSocket processes.**           | feature phases |
| Supabase Auth             | Public user authentication & sessions                                 | P03 |
| Supabase Postgres         | Primary datastore; schema + RLS                                       | P01 |
| Supabase Realtime         | Realtime text channels / presence                                     | P10 |
| Vercel Blob + Supabase Storage | File/object storage (PDFs, uploads)                             | P06 |
| LiveKit Cloud             | Voice rooms (SFU). Long-lived media handled off-Function.             | P11 |
| Stripe                    | Donations / payments                                                  | P17 |
| Vercel Workflows/Queues/Cron | Background jobs, scheduled tasks                                   | P02 |
| Upstash Redis             | Application-level rate limiting                                        | P14/P19 |

## Key architectural constraints

- **§3.1** Long-lived WebSocket processes are **NOT** run inside Vercel
  Functions. Realtime text uses Supabase Realtime; voice uses LiveKit Cloud.
- **REQ-CORE-002** Apex → www is a **308** (permanent, method-preserving)
  redirect, enforced both in edge middleware (`apps/web/src/middleware.ts`)
  and in Vercel domain configuration (defense in depth).
- **§24.4** Secrets never reach the client bundle; only `NEXT_PUBLIC_*` vars
  are client-exposed (enforced by `tests/security/env-hygiene.test.ts`).
