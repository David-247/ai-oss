-- Phase 17: Stripe-backed donations, verified webhooks, accounting retention,
-- and explicit no-influence donation guardrails.

alter table public.donations
  add column if not exists mode text not null default 'payment',
  add column if not exists checkout_url text,
  add column if not exists receipt_email text,
  add column if not exists donor_badge_issued_at timestamptz,
  add column if not exists retention_reason text not null default 'financial_tax_fraud_chargeback_accounting_obligation',
  add column if not exists accounting_exported_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists chargeback_status text,
  add column if not exists stripe_last_event_id text,
  add column if not exists stripe_last_event_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'donations_mode_check'
      and conrelid = 'public.donations'::regclass
  ) then
    alter table public.donations
      add constraint donations_mode_check
      check (mode in ('payment', 'subscription'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'donations_retention_reason_check'
      and conrelid = 'public.donations'::regclass
  ) then
    alter table public.donations
      add constraint donations_retention_reason_check
      check (retention_reason = 'financial_tax_fraud_chargeback_accounting_obligation');
  end if;
end $$;

alter table public.stripe_events
  add column if not exists donation_id uuid references public.donations(id) on delete set null,
  add column if not exists idempotency_key text;

create index if not exists donations_status_idx
  on public.donations (status, created_at desc);

create index if not exists donations_mode_idx
  on public.donations (mode, created_at desc);

create index if not exists donations_accounting_export_idx
  on public.donations (accounting_exported_at, created_at desc);

create index if not exists stripe_events_donation_idx
  on public.stripe_events (donation_id, created_at desc);

create unique index if not exists stripe_events_idempotency_key_idx
  on public.stripe_events (idempotency_key)
  where idempotency_key is not null;
