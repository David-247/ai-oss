-- Phase 19: security architecture hardening for admin sessions, WAF events, and
-- append-only security monitoring.

alter table public.user_security_state
  add column if not exists mfa_verified_at timestamptz,
  add column if not exists passkey_verified_at timestamptz,
  add column if not exists step_up_verified_at timestamptz,
  add column if not exists admin_session_started_at timestamptz,
  add column if not exists admin_session_expires_at timestamptz,
  add column if not exists last_admin_ip_hash text,
  add column if not exists session_risk jsonb not null default '{}'::jsonb,
  add column if not exists break_glass_enabled boolean not null default false,
  add column if not exists break_glass_last_used_at timestamptz,
  add column if not exists break_glass_monitored_at timestamptz,
  add column if not exists waf_bypass_until timestamptz;

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  reason text not null,
  ip_hash text,
  device_hash text,
  user_agent text,
  route text,
  waf_rule_key text,
  metadata jsonb not null default '{}'::jsonb,
  monitoring_required boolean not null default true,
  post_incident_review_required boolean not null default false,
  created_at timestamptz not null default now()
);

create trigger security_events_append_only
before update or delete on public.security_events
for each row execute function public.prevent_row_update_or_delete();

alter table public.security_events enable row level security;

grant select, insert on public.security_events to authenticated;

create policy security_events_read_admin
on public.security_events for select
using (public.has_global_permission('security.read') or public.has_global_permission('audit.read'));

create policy security_events_insert_admin
on public.security_events for insert
with check (public.has_global_permission('security.update') or public.has_global_permission('audit.read'));

create index if not exists user_security_state_admin_session_idx
on public.user_security_state (admin_session_expires_at, step_up_verified_at, risk_level);

create index if not exists security_events_action_created_idx
on public.security_events (action, created_at desc);

create index if not exists security_events_severity_created_idx
on public.security_events (severity, created_at desc);

create index if not exists security_events_actor_created_idx
on public.security_events (actor_id, created_at desc);
