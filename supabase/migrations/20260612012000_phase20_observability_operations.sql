-- Phase 20: observability, alerting, health snapshots, and operational
-- readiness records. These records are append-only and must only contain
-- redacted metadata.

create table if not exists public.observability_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('metric', 'log', 'web_vital')),
  metric_key text,
  value numeric,
  unit text,
  log_level text
    check (log_level is null or log_level in ('debug', 'info', 'warn', 'error', 'critical')),
  event_name text,
  message text,
  tags jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  redaction_applied boolean not null default true,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (event_type in ('metric', 'web_vital') and metric_key is not null and value is not null)
    or (event_type = 'log' and log_level is not null and event_name is not null)
  )
);

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  severity text not null
    check (severity in ('info', 'warning', 'critical')),
  status text not null default 'firing'
    check (status in ('firing', 'resolved', 'test')),
  threshold numeric not null,
  observed_value numeric not null,
  runbook_slug text not null,
  correlation_id text,
  metadata jsonb not null default '{}'::jsonb,
  fired_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.system_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  overall_status text not null
    check (overall_status in ('operational', 'degraded', 'down', 'unknown')),
  components jsonb not null default '[]'::jsonb,
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger observability_events_append_only
before update or delete on public.observability_events
for each row execute function public.prevent_row_update_or_delete();

create trigger alert_events_append_only
before update or delete on public.alert_events
for each row execute function public.prevent_row_update_or_delete();

create trigger system_health_snapshots_append_only
before update or delete on public.system_health_snapshots
for each row execute function public.prevent_row_update_or_delete();

alter table public.observability_events enable row level security;
alter table public.alert_events enable row level security;
alter table public.system_health_snapshots enable row level security;

grant select, insert on public.observability_events to authenticated, service_role;
grant select, insert on public.alert_events to authenticated, service_role;
grant select, insert on public.system_health_snapshots to authenticated, service_role;

create policy observability_events_read_admin
on public.observability_events for select
using (
  public.has_global_permission('system.settings_read')
  or public.has_global_permission('security.read')
  or public.has_global_permission('audit.read')
);

create policy observability_events_insert_admin
on public.observability_events for insert
with check (
  redaction_applied = true
  and (
    public.has_global_permission('system.settings_update')
    or public.has_global_permission('security.update')
    or public.has_global_permission('audit.read')
  )
);

create policy alert_events_read_admin
on public.alert_events for select
using (
  public.has_global_permission('system.settings_read')
  or public.has_global_permission('security.read')
  or public.has_global_permission('audit.read')
);

create policy alert_events_insert_admin
on public.alert_events for insert
with check (
  public.has_global_permission('system.settings_update')
  or public.has_global_permission('security.update')
  or public.has_global_permission('audit.read')
);

create policy system_health_snapshots_read_admin
on public.system_health_snapshots for select
using (
  public.has_global_permission('system.settings_read')
  or public.has_global_permission('security.read')
  or public.has_global_permission('audit.read')
);

create policy system_health_snapshots_insert_admin
on public.system_health_snapshots for insert
with check (
  public.has_global_permission('system.settings_update')
  or public.has_global_permission('security.update')
  or public.has_global_permission('audit.read')
);

create index if not exists observability_events_metric_created_idx
on public.observability_events (metric_key, occurred_at desc)
where event_type in ('metric', 'web_vital');

create index if not exists observability_events_log_created_idx
on public.observability_events (event_name, occurred_at desc)
where event_type = 'log';

create index if not exists observability_events_correlation_idx
on public.observability_events (correlation_id, occurred_at desc)
where correlation_id is not null;

create index if not exists alert_events_key_status_idx
on public.alert_events (alert_key, status, fired_at desc);

create index if not exists alert_events_severity_created_idx
on public.alert_events (severity, fired_at desc);

create index if not exists system_health_snapshots_created_idx
on public.system_health_snapshots (created_at desc, overall_status);
