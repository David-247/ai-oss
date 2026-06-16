-- Phase 14: trust scoring, anti-abuse signals, vote certification, and rate-limit events.

alter table public.user_security_state
  add column if not exists trust_score numeric(12, 4) not null default 0,
  add column if not exists risk_score numeric(12, 4) not null default 0,
  add column if not exists risk_factors jsonb not null default '{}'::jsonb,
  add column if not exists device_risk jsonb not null default '{}'::jsonb,
  add column if not exists bot_challenge_until timestamptz;

alter table public.profiles
  add column if not exists public_reputation jsonb not null default '{}'::jsonb;

alter table public.votes
  add column if not exists certification_status text not null default 'pending'
    check (certification_status in ('pending', 'certified', 'rejected', 'delayed')),
  add column if not exists anomaly_reasons text[] not null default '{}';

alter table public.governance_ballots
  add column if not exists suspicious_score numeric(6, 4) not null default 0,
  add column if not exists certification_reason text,
  add column if not exists anomaly_reasons text[] not null default '{}';

alter table public.governance_votes
  add column if not exists brigading_mitigation jsonb not null default '{}'::jsonb,
  add column if not exists quorum_adjustment_percent numeric(5, 2) not null default 0;

create table if not exists public.abuse_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  bucket text not null,
  allowed boolean not null,
  reason text,
  ip_hash text,
  device_hash text,
  bot_score numeric(6, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_security_state_risk_idx
on public.user_security_state (risk_level, risk_score desc, updated_at desc);

create index if not exists votes_certification_status_idx
on public.votes (certification_status, suspicious_score desc, created_at);

create index if not exists abuse_rate_limit_events_actor_action_idx
on public.abuse_rate_limit_events (actor_id, action, created_at desc);

create index if not exists abuse_rate_limit_events_bucket_idx
on public.abuse_rate_limit_events (action, bucket, created_at desc);
