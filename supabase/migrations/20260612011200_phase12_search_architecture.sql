-- Phase 12 — Search architecture
-- Adds indexing freshness/embedding state used by the search workflow without
-- changing the Phase 01 visibility-first RLS model.

alter table public.search_documents
  add column if not exists embedding_status text not null default 'pending'
    check (embedding_status in ('pending', 'ready', 'failed', 'not_required')),
  add column if not exists indexed_at timestamptz not null default now(),
  add column if not exists is_fresh boolean not null default true;

create index if not exists search_documents_freshness_idx
on public.search_documents (is_fresh, embedding_status, indexed_at desc)
where deleted_at is null;

create index if not exists search_documents_type_visibility_idx
on public.search_documents (target_type, visibility, zone_id)
where deleted_at is null;

insert into public.roles (role_key, name, description, role_type, permissions, system_role)
values
  (
    'search_indexer',
    'Search Indexer',
    'Internal indexing role for search document upserts, embedding refreshes, and stale document purges.',
    'global',
    array['search.index'],
    true
  )
on conflict (role_key) do update
set
  name = excluded.name,
  description = excluded.description,
  role_type = excluded.role_type,
  permissions = excluded.permissions,
  system_role = excluded.system_role;
