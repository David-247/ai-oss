-- Phase 13: AutoMod lifecycle, unified moderation queues, and appeal evidence.

alter table public.reports
  add column if not exists severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  add column if not exists source text not null default 'user_report',
  add column if not exists report_count integer not null default 1 check (report_count >= 1),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.moderation_actions
  add column if not exists appealable boolean not null default true,
  add column if not exists statement_of_reasons jsonb not null default '{}'::jsonb;

alter table public.appeals
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists decision text,
  add column if not exists decision_reason text,
  add column if not exists audit_trail jsonb not null default '[]'::jsonb;

alter table public.automod_rules
  add column if not exists rule_key text,
  add column if not exists description text,
  add column if not exists yaml text,
  add column if not exists version integer not null default 1 check (version >= 1),
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'valid', 'dry_run', 'published', 'disabled', 'archived')),
  add column if not exists published_at timestamptz,
  add column if not exists last_validated_at timestamptz,
  add column if not exists rollback_of uuid references public.automod_rules(id) on delete set null;

update public.automod_rules
set
  rule_key = coalesce(
    rule_key,
    lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
  ),
  yaml = coalesce(yaml, config::text),
  status = case
    when enabled then 'published'
    else 'disabled'
  end,
  published_at = case
    when enabled then coalesce(published_at, updated_at)
    else published_at
  end,
  last_validated_at = coalesce(last_validated_at, updated_at)
where rule_key is null
   or yaml is null
   or last_validated_at is null;

alter table public.automod_runs
  add column if not exists zone_id uuid references public.zones(id) on delete set null,
  add column if not exists input_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists result jsonb not null default '{}'::jsonb;

create index if not exists reports_zone_status_severity_idx
on public.reports (zone_id, status, severity, created_at desc);

create index if not exists reports_target_reason_idx
on public.reports (target_type, target_id, reason, created_at desc);

create unique index if not exists automod_rules_global_key_version_idx
on public.automod_rules (rule_key, version)
where zone_id is null and rule_key is not null;

create unique index if not exists automod_rules_zone_key_version_idx
on public.automod_rules (zone_id, rule_key, version)
where zone_id is not null and rule_key is not null;

create index if not exists automod_rules_status_idx
on public.automod_rules (status, enabled, updated_at desc);

create index if not exists automod_runs_zone_status_idx
on public.automod_runs (zone_id, status, created_at desc);

create index if not exists appeals_status_review_idx
on public.appeals (status, reviewed_at, created_at desc);
