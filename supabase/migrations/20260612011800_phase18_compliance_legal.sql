-- Phase 18: compliance/legal baseline, privacy request SLAs, legal intake
-- metadata, transparency rollups, cookie consent, and AI metadata capture.

alter table public.user_settings
  add column if not exists cookie_consent_updated_at timestamptz,
  add column if not exists gpc_signal boolean not null default false,
  add column if not exists do_not_sell_share boolean not null default true,
  add column if not exists limit_sensitive_data boolean not null default false;

alter table public.privacy_requests
  add column if not exists jurisdiction text not null default 'platform',
  add column if not exists due_at timestamptz,
  add column if not exists verification_status text not null default 'authenticated',
  add column if not exists gpc_signal boolean not null default false,
  add column if not exists do_not_sell_share boolean not null default true,
  add column if not exists limit_sensitive_data boolean not null default false,
  add column if not exists outcome_summary text,
  add column if not exists denied_reason text,
  add column if not exists completed_by uuid references public.profiles(id) on delete set null;

update public.privacy_requests
set due_at = coalesce(due_at, requested_at + interval '30 days')
where due_at is null;

alter table public.privacy_requests
  alter column due_at set not null;

alter table public.privacy_requests
  drop constraint if exists privacy_requests_request_type_check;

alter table public.privacy_requests
  add constraint privacy_requests_request_type_check
  check (
    request_type in (
      'export',
      'delete',
      'rectify',
      'restrict_processing',
      'objection',
      'opt_out_sale_share',
      'limit_sensitive_data',
      'automated_decision_review'
    )
  );

alter table public.legal_requests
  add column if not exists requester_email text,
  add column if not exists target_url text,
  add column if not exists due_at timestamptz,
  add column if not exists source text not null default 'public_intake',
  add column if not exists priority text not null default 'normal',
  add column if not exists notice_category text,
  add column if not exists statement_of_reasons jsonb,
  add column if not exists notification_status text not null default 'pending',
  add column if not exists audit_metadata jsonb not null default '{}'::jsonb,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists child_safety_escalation boolean not null default false;

update public.legal_requests
set due_at = coalesce(due_at, received_at + interval '14 days')
where due_at is null;

alter table public.legal_requests
  alter column due_at set not null;

alter table public.legal_requests
  drop constraint if exists legal_requests_status_check;

alter table public.legal_requests
  add constraint legal_requests_status_check
  check (status in ('received', 'reviewing', 'actioned', 'rejected', 'closed', 'escalated'));

alter table public.transparency_report_events
  add column if not exists privacy_request_id uuid references public.privacy_requests(id) on delete set null,
  add column if not exists legal_request_id uuid references public.legal_requests(id) on delete set null,
  add column if not exists moderation_action_id uuid references public.moderation_actions(id) on delete set null,
  add column if not exists region text,
  add column if not exists outcome text,
  add column if not exists published_at timestamptz;

alter table public.papers
  add column if not exists ai_metadata jsonb not null default '{}'::jsonb;

create index if not exists privacy_requests_due_idx
  on public.privacy_requests (status, due_at);

create index if not exists privacy_requests_jurisdiction_idx
  on public.privacy_requests (jurisdiction, requested_at desc);

create index if not exists legal_requests_due_idx
  on public.legal_requests (status, due_at);

create index if not exists legal_requests_type_idx
  on public.legal_requests (request_type, received_at desc);

create index if not exists transparency_report_events_legal_idx
  on public.transparency_report_events (legal_request_id, occurred_at desc);

create index if not exists papers_ai_metadata_idx
  on public.papers using gin (ai_metadata);
