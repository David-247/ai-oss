-- Phase 01: Data architecture for AI-OSS.net.
-- Source: phases/PHASE-01-data-architecture-rls.md

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_row_update_or_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'table % is append-only', tg_table_name;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique,
  display_name text,
  avatar_file_id uuid,
  bio text,
  website_url text,
  github_username text,
  orcid text,
  affiliation text,
  research_interests text[] not null default '{}',
  profile_visibility text not null default 'public' check (profile_visibility in ('public', 'authenticated', 'private')),
  email_visibility text not null default 'private' check (email_visibility in ('public', 'authenticated', 'private')),
  contact_permission text not null default 'members' check (contact_permission in ('everyone', 'members', 'none')),
  search_indexing_enabled boolean not null default true,
  contribution_summary jsonb not null default '{}'::jsonb,
  reputation_score integer not null default 0,
  trust_score numeric(12, 4) not null default 0,
  donor_badge_visible boolean not null default false,
  moderator_badge_visible boolean not null default false,
  admin_badge_visible boolean not null default false,
  suspended_at timestamptz,
  deleted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  privacy jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  cookie_consent jsonb not null default '{}'::jsonb,
  analytics_consent boolean not null default false,
  email_digest_frequency text not null default 'weekly' check (email_digest_frequency in ('never', 'daily', 'weekly', 'monthly')),
  public_donor_badge_opt_in boolean not null default false,
  dm_permissions text not null default 'members' check (dm_permissions in ('everyone', 'members', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create table public.user_security_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mfa_enrolled boolean not null default false,
  passkey_enrolled boolean not null default false,
  elevated_mfa_required boolean not null default false,
  suspicious_login_count integer not null default 0,
  last_login_at timestamptz,
  last_login_ip inet,
  session_revoked_before timestamptz,
  risk_level text not null default 'normal' check (risk_level in ('normal', 'elevated', 'restricted', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_security_state_set_updated_at
before update on public.user_security_state
for each row execute function public.set_updated_at();

create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  policy_key text not null,
  policy_version text not null,
  accepted boolean not null,
  age_attested boolean,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger consent_events_append_only
before update or delete on public.consent_events
for each row execute function public.prevent_row_update_or_delete();

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  name text not null,
  description text,
  role_type text not null default 'global' check (role_type in ('global', 'zone', 'custom')),
  permissions text[] not null default '{}',
  system_role boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  description text,
  visibility text not null default 'public' check (visibility in ('public', 'restricted', 'private')),
  status text not null default 'active' check (status in ('active', 'archived', 'quarantined', 'removed')),
  created_by uuid references public.profiles(id) on delete set null,
  default_post_visibility text not null default 'public' check (default_post_visibility in ('public', 'zone', 'private')),
  moderation_status text not null default 'clear' check (moderation_status in ('clear', 'flagged', 'quarantined', 'removed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger zones_set_updated_at
before update on public.zones
for each row execute function public.set_updated_at();

create table public.role_bindings (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  zone_id uuid references public.zones(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  grant_reason text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (role_id, user_id, zone_id)
);

create trigger role_bindings_set_updated_at
before update on public.role_bindings
for each row execute function public.set_updated_at();

create table public.permission_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  role_id uuid references public.roles(id) on delete set null,
  zone_id uuid references public.zones(id) on delete set null,
  action text not null,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  correlation_id text,
  created_at timestamptz not null default now()
);

create trigger permission_audit_append_only
before update or delete on public.permission_audit
for each row execute function public.prevent_row_update_or_delete();

create table public.zone_members (
  zone_id uuid not null references public.zones(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('member', 'contributor', 'moderator', 'admin')),
  status text not null default 'active' check (status in ('invited', 'active', 'muted', 'banned', 'left')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (zone_id, user_id)
);

create trigger zone_members_set_updated_at
before update on public.zone_members
for each row execute function public.set_updated_at();

create table public.zone_flairs (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  label text not null,
  color text,
  description text,
  applies_to text not null default 'post' check (applies_to in ('post', 'user', 'paper')),
  created_at timestamptz not null default now(),
  unique (zone_id, label, applies_to)
);

create table public.zone_wiki_pages (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  slug citext not null,
  title text not null,
  body text not null,
  version integer not null default 1,
  edited_by uuid references public.profiles(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public', 'members', 'mods')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (zone_id, slug)
);

create trigger zone_wiki_pages_set_updated_at
before update on public.zone_wiki_pages
for each row execute function public.set_updated_at();

create table public.zone_settings (
  zone_id uuid primary key references public.zones(id) on delete cascade,
  post_permissions jsonb not null default '{}'::jsonb,
  automod_config jsonb not null default '{}'::jsonb,
  ranking_config jsonb not null default '{}'::jsonb,
  chat_config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.zone_governance_settings (
  zone_id uuid primary key references public.zones(id) on delete cascade,
  petition_threshold integer not null default 10 check (petition_threshold >= 1),
  vote_duration interval not null default interval '7 days',
  quorum_percent numeric(5, 2) not null default 10 check (quorum_percent >= 0 and quorum_percent <= 100),
  removal_threshold_percent numeric(5, 2) not null default 60 check (removal_threshold_percent >= 0 and removal_threshold_percent <= 100),
  certification_required boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  provider text not null check (provider in ('supabase', 'vercel_blob', 'external')),
  storage_key text not null,
  filename text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null,
  visibility text not null default 'private' check (visibility in ('public', 'authenticated', 'zone', 'private', 'moderator', 'admin')),
  zone_id uuid references public.zones(id) on delete set null,
  scan_status text not null default 'pending' check (scan_status in ('pending', 'scanning', 'clean', 'suspicious', 'infected', 'failed')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'quarantined', 'removed')),
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, storage_key)
);

create trigger files_set_updated_at
before update on public.files
for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_avatar_file_id_fkey
  foreign key (avatar_file_id) references public.files(id) on delete set null;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.zones(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  post_type text not null default 'text' check (post_type in ('text', 'link', 'research_discussion', 'question', 'announcement', 'poll', 'project_update', 'reproducibility_note', 'safety_notice', 'meta')),
  title text not null,
  url text,
  body text,
  markdown jsonb not null default '{}'::jsonb,
  flair_id uuid references public.zone_flairs(id) on delete set null,
  tags text[] not null default '{}',
  visibility text not null default 'public' check (visibility in ('public', 'zone', 'private')),
  status text not null default 'published' check (status in ('draft', 'published', 'locked', 'deleted', 'removed')),
  moderation_status text not null default 'clear' check (moderation_status in ('clear', 'flagged', 'quarantined', 'removed')),
  removal_reason text,
  is_locked boolean not null default false,
  score integer not null default 0,
  certified_score integer not null default 0,
  comment_count integer not null default 0,
  vote_visibility_until timestamptz,
  deleted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tsv tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored
);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  identifier text not null unique,
  submitter_id uuid references public.profiles(id) on delete set null,
  zone_id uuid references public.zones(id) on delete set null,
  title text not null,
  abstract text not null,
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  license text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'published', 'under_automated_scan', 'quarantined', 'flagged', 'withdrawn', 'removed_by_moderation', 'removed_by_legal', 'superseded', 'retracted', 'redacted')),
  current_version_number integer not null default 0 check (current_version_number >= 0),
  safety_status text not null default 'pending' check (safety_status in ('pending', 'clear', 'flagged', 'blocked')),
  moderation_status text not null default 'clear' check (moderation_status in ('clear', 'flagged', 'quarantined', 'removed')),
  not_peer_reviewed_label_acknowledged boolean not null default false,
  legal_hold boolean not null default false,
  withdrawn_at timestamptz,
  removed_at timestamptz,
  deleted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tsv tsvector generated always as (
    to_tsvector('english', coalesce(identifier, '') || ' ' || coalesce(title, '') || ' ' || coalesce(abstract, ''))
  ) stored
);

create trigger papers_set_updated_at
before update on public.papers
for each row execute function public.set_updated_at();

create table public.paper_versions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  submitter_id uuid references public.profiles(id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted', 'published', 'under_automated_scan', 'quarantined', 'flagged', 'withdrawn', 'removed_by_moderation', 'removed_by_legal', 'superseded', 'retracted', 'redacted')),
  title_snapshot text not null,
  abstract_snapshot text not null,
  full_text_snapshot text,
  metadata_snapshot jsonb not null default '{}'::jsonb,
  license_snapshot text not null,
  file_hashes jsonb not null default '[]'::jsonb,
  text_diff_from_previous text,
  submitted_at timestamptz not null default now(),
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  unique (paper_id, version_number)
);

create table public.paper_authors (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  author_slug citext,
  author_order integer not null check (author_order >= 1),
  affiliation text,
  orcid text,
  is_submitter boolean not null default false,
  is_corresponding boolean not null default false,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (paper_id, author_order)
);

create table public.paper_files (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  paper_version_id uuid not null references public.paper_versions(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  file_kind text not null check (file_kind in ('pdf', 'source', 'supplement', 'dataset', 'model', 'code', 'other')),
  immutable boolean not null default true,
  created_at timestamptz not null default now(),
  unique (paper_version_id, file_id)
);

create table public.paper_links (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  link_type text not null check (link_type in ('code', 'dataset', 'model', 'demo', 'project', 'arxiv', 'doi', 'other')),
  url text not null,
  label text,
  created_at timestamptz not null default now()
);

create table public.paper_reviews (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  paper_version_id uuid references public.paper_versions(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_type text not null default 'structured' check (review_type in ('structured', 'safety', 'author_response')),
  clarity_score smallint check (clarity_score between 1 and 5),
  novelty_score smallint check (novelty_score between 1 and 5),
  methodology_score smallint check (methodology_score between 1 and 5),
  reproducibility_score smallint check (reproducibility_score between 1 and 5),
  safety_score smallint check (safety_score between 1 and 5),
  evidence_score smallint check (evidence_score between 1 and 5),
  body text not null,
  status text not null default 'published' check (status in ('draft', 'published', 'removed')),
  moderation_status text not null default 'clear' check (moderation_status in ('clear', 'flagged', 'quarantined', 'removed')),
  deleted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger paper_reviews_set_updated_at
before update on public.paper_reviews
for each row execute function public.set_updated_at();

create table public.replication_reports (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  paper_version_id uuid references public.paper_versions(id) on delete set null,
  reporter_id uuid references public.profiles(id) on delete set null,
  environment text,
  hardware text,
  data_snapshot text,
  commit_hash text,
  result_status text not null check (result_status in ('replicated', 'partially_replicated', 'not_replicated', 'inconclusive')),
  notes text not null,
  status text not null default 'published' check (status in ('draft', 'published', 'removed')),
  moderation_status text not null default 'clear' check (moderation_status in ('clear', 'flagged', 'quarantined', 'removed')),
  deleted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger replication_reports_set_updated_at
before update on public.replication_reports
for each row execute function public.set_updated_at();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  paper_id uuid references public.papers(id) on delete cascade,
  paper_version_id uuid references public.paper_versions(id) on delete set null,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  markdown jsonb not null default '{}'::jsonb,
  edit_history jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published', 'locked', 'deleted', 'removed')),
  moderation_status text not null default 'clear' check (moderation_status in ('clear', 'flagged', 'quarantined', 'removed')),
  removal_reason text,
  is_locked boolean not null default false,
  score integer not null default 0,
  certified_score integer not null default 0,
  deleted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (post_id is not null or paper_id is not null),
  tsv tsvector generated always as (to_tsvector('english', coalesce(body, ''))) stored
);

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'paper', 'paper_review', 'replication_report')),
  target_id uuid not null,
  value smallint not null check (value in (-1, 1)),
  is_certified boolean not null default false,
  certified_at timestamptz,
  certification_reason text,
  suspicious_score numeric(6, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create trigger votes_set_updated_at
before update on public.votes
for each row execute function public.set_updated_at();

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.zones(id) on delete set null,
  room_type text not null check (room_type in ('zone_general', 'zone_project', 'paper_discussion', 'post_linked', 'moderator', 'admin_security', 'temporary', 'private')),
  title text not null,
  description text,
  visibility text not null default 'zone' check (visibility in ('public', 'zone', 'private', 'moderator', 'admin')),
  is_private boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  linked_post_id uuid references public.posts(id) on delete set null,
  linked_paper_id uuid references public.papers(id) on delete set null,
  locked_at timestamptz,
  slow_mode_seconds integer not null default 0 check (slow_mode_seconds >= 0),
  rules text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger chat_rooms_set_updated_at
before update on public.chat_rooms
for each row execute function public.set_updated_at();

create table public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('member', 'moderator', 'admin')),
  status text not null default 'active' check (status in ('invited', 'active', 'muted', 'kicked', 'banned', 'left')),
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create trigger chat_room_members_set_updated_at
before update on public.chat_room_members
for each row execute function public.set_updated_at();

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  parent_message_id uuid references public.chat_messages(id) on delete set null,
  body text not null,
  markdown jsonb not null default '{}'::jsonb,
  attachment_file_ids uuid[] not null default '{}',
  edit_history jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('published', 'edited', 'deleted', 'removed')),
  moderation_status text not null default 'clear' check (moderation_status in ('clear', 'flagged', 'quarantined', 'removed')),
  deleted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger chat_messages_set_updated_at
before update on public.chat_messages
for each row execute function public.set_updated_at();

create table public.voice_rooms (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.zones(id) on delete set null,
  chat_room_id uuid references public.chat_rooms(id) on delete set null,
  title text not null,
  visibility text not null default 'zone' check (visibility in ('public', 'zone', 'private', 'moderator', 'admin')),
  created_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  recording_enabled boolean not null default false,
  transcription_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger voice_rooms_set_updated_at
before update on public.voice_rooms
for each row execute function public.set_updated_at();

create table public.voice_participants (
  id uuid primary key default gen_random_uuid(),
  voice_room_id uuid not null references public.voice_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  participant_role text not null default 'speaker' check (participant_role in ('listener', 'speaker', 'moderator', 'host')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  muted_at timestamptz,
  banned_at timestamptz,
  unique (voice_room_id, user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  zone_id uuid references public.zones(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'triaged', 'actioned', 'dismissed', 'duplicate')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  zone_id uuid references public.zones(id) on delete set null,
  action_type text not null,
  reason text not null,
  previous_state jsonb,
  new_state jsonb,
  expires_at timestamptz,
  automated boolean not null default false,
  correlation_id text,
  created_at timestamptz not null default now()
);

create trigger moderation_actions_append_only
before update or delete on public.moderation_actions
for each row execute function public.prevent_row_update_or_delete();

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  moderation_action_id uuid not null references public.moderation_actions(id) on delete cascade,
  appellant_id uuid references public.profiles(id) on delete set null,
  body text not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'closed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger appeals_set_updated_at
before update on public.appeals
for each row execute function public.set_updated_at();

create table public.automod_rules (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.zones(id) on delete cascade,
  name text not null,
  rule_type text not null,
  config jsonb not null default '{}'::jsonb,
  action text not null,
  enabled boolean not null default true,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger automod_rules_set_updated_at
before update on public.automod_rules
for each row execute function public.set_updated_at();

create table public.automod_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.automod_rules(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  status text not null check (status in ('matched', 'not_matched', 'errored', 'skipped')),
  action_taken text,
  score numeric(8, 4),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.mod_removal_petitions (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'qualified', 'vote_open', 'passed', 'failed', 'dismissed')),
  support_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mod_removal_petitions_set_updated_at
before update on public.mod_removal_petitions
for each row execute function public.set_updated_at();

create table public.mod_removal_petition_support (
  petition_id uuid not null references public.mod_removal_petitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (petition_id, user_id)
);

create table public.governance_votes (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'open', 'certifying', 'passed', 'failed', 'void')),
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  certified_by uuid references public.profiles(id) on delete set null,
  certified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger governance_votes_set_updated_at
before update on public.governance_votes
for each row execute function public.set_updated_at();

create table public.governance_ballots (
  id uuid primary key default gen_random_uuid(),
  governance_vote_id uuid not null references public.governance_votes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  choice text not null,
  weight numeric(12, 4) not null default 1,
  is_certified boolean not null default false,
  certified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (governance_vote_id, user_id)
);

create table public.search_documents (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  visibility text not null default 'public' check (visibility in ('public', 'authenticated', 'zone', 'private', 'moderator', 'admin')),
  zone_id uuid references public.zones(id) on delete cascade,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  source_updated_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_type, target_id),
  tsv tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored
);

create trigger search_documents_set_updated_at
before update on public.search_documents
for each row execute function public.set_updated_at();

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_subscription_id text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded', 'charged_back', 'canceled')),
  anonymous boolean not null default false,
  donor_badge_opt_in boolean not null default false,
  accounting_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger donations_set_updated_at
before update on public.donations
for each row execute function public.set_updated_at();

create table public.stripe_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  zone_id uuid references public.zones(id) on delete set null,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  request_ip inet,
  device_metadata jsonb not null default '{}'::jsonb,
  correlation_id text,
  automated boolean not null default false,
  created_at timestamptz not null default now()
);

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.prevent_row_update_or_delete();

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  request_type text not null check (request_type in ('export', 'delete', 'rectify', 'restrict_processing', 'objection')),
  status text not null default 'submitted' check (status in ('submitted', 'verifying', 'processing', 'completed', 'rejected', 'canceled')),
  details jsonb not null default '{}'::jsonb,
  export_file_id uuid references public.files(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger privacy_requests_set_updated_at
before update on public.privacy_requests
for each row execute function public.set_updated_at();

create table public.legal_requests (
  id uuid primary key default gen_random_uuid(),
  requester text not null,
  request_type text not null,
  target_type text,
  target_id uuid,
  status text not null default 'received' check (status in ('received', 'reviewing', 'actioned', 'rejected', 'closed')),
  jurisdiction text,
  legal_hold boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger legal_requests_set_updated_at
before update on public.legal_requests
for each row execute function public.set_updated_at();

create table public.transparency_report_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  subject_type text,
  subject_id uuid,
  zone_id uuid references public.zones(id) on delete set null,
  public_bucket text,
  count_delta integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create trigger transparency_report_events_append_only
before update or delete on public.transparency_report_events
for each row execute function public.prevent_row_update_or_delete();

create index profiles_username_idx on public.profiles (username);
create index profiles_visibility_idx on public.profiles (profile_visibility) where deleted_at is null;
create index consent_events_user_idx on public.consent_events (user_id, created_at desc);
create index role_bindings_user_idx on public.role_bindings (user_id) where revoked_at is null;
create index role_bindings_zone_idx on public.role_bindings (zone_id) where revoked_at is null;
create index zones_visibility_idx on public.zones (visibility, status);
create index zone_members_user_idx on public.zone_members (user_id, status);
create index posts_feed_idx on public.posts (zone_id, status, created_at desc) where deleted_at is null;
create index posts_score_idx on public.posts (zone_id, certified_score desc, created_at desc) where status = 'published';
create index posts_tsv_idx on public.posts using gin (tsv);
create index comments_post_idx on public.comments (post_id, created_at) where deleted_at is null;
create index comments_paper_idx on public.comments (paper_id, created_at) where deleted_at is null;
create index comments_parent_idx on public.comments (parent_comment_id);
create index comments_tsv_idx on public.comments using gin (tsv);
create index votes_target_idx on public.votes (target_type, target_id);
create index votes_certification_idx on public.votes (is_certified, created_at);
create index papers_identifier_idx on public.papers (identifier);
create index papers_status_idx on public.papers (status, created_at desc);
create index papers_tsv_idx on public.papers using gin (tsv);
create index paper_versions_paper_idx on public.paper_versions (paper_id, version_number desc);
create index paper_authors_slug_idx on public.paper_authors (author_slug);
create index paper_reviews_paper_idx on public.paper_reviews (paper_id, created_at desc);
create index replication_reports_paper_idx on public.replication_reports (paper_id, created_at desc);
create index chat_rooms_zone_idx on public.chat_rooms (zone_id, visibility);
create index chat_room_members_user_idx on public.chat_room_members (user_id, status);
create index chat_messages_room_idx on public.chat_messages (room_id, created_at desc);
create index voice_rooms_active_idx on public.voice_rooms (zone_id, is_active);
create index reports_queue_idx on public.reports (status, created_at);
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id, created_at desc);
create index automod_runs_target_idx on public.automod_runs (target_type, target_id, created_at desc);
create index governance_votes_zone_idx on public.governance_votes (zone_id, status, closes_at);
create index files_owner_idx on public.files (owner_id, created_at desc);
create index files_scan_queue_idx on public.files (scan_status, moderation_status, created_at);
create index search_documents_visibility_idx on public.search_documents (visibility, zone_id) where deleted_at is null;
create index search_documents_tsv_idx on public.search_documents using gin (tsv);
create index search_documents_embedding_idx on public.search_documents using hnsw (embedding vector_cosine_ops);
create index donations_user_idx on public.donations (user_id, created_at desc);
create index audit_events_resource_idx on public.audit_events (resource_type, resource_id, created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id, created_at desc);
create index privacy_requests_user_idx on public.privacy_requests (user_id, requested_at desc);
create index legal_requests_status_idx on public.legal_requests (status, received_at desc);
create index transparency_report_events_rollup_idx on public.transparency_report_events (event_type, public_bucket, occurred_at);

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), '') = 'service_role';
$$;

create or replace function public.has_global_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_service_role()
    or exists (
      select 1
      from public.role_bindings rb
      join public.roles r on r.id = rb.role_id
      where rb.user_id = auth.uid()
        and rb.zone_id is null
        and rb.revoked_at is null
        and (rb.expires_at is null or rb.expires_at > now())
        and r.role_key = required_role
    );
$$;

create or replace function public.has_global_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_service_role()
    or exists (
      select 1
      from public.role_bindings rb
      join public.roles r on r.id = rb.role_id
      where rb.user_id = auth.uid()
        and rb.zone_id is null
        and rb.revoked_at is null
        and (rb.expires_at is null or rb.expires_at > now())
        and (required_permission = any(r.permissions) or '*.*' = any(r.permissions))
    );
$$;

create or replace function public.has_zone_permission(target_zone_id uuid, required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_global_permission(required_permission)
    or exists (
      select 1
      from public.role_bindings rb
      join public.roles r on r.id = rb.role_id
      where rb.user_id = auth.uid()
        and rb.zone_id = target_zone_id
        and rb.revoked_at is null
        and (rb.expires_at is null or rb.expires_at > now())
        and (required_permission = any(r.permissions) or '*.*' = any(r.permissions))
    );
$$;

create or replace function public.is_zone_member(target_zone_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_service_role()
    or exists (
      select 1
      from public.zone_members zm
      where zm.zone_id = target_zone_id
        and zm.user_id = auth.uid()
        and zm.status = 'active'
    );
$$;

create or replace function public.can_read_zone(target_zone_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_service_role()
    or public.has_global_permission('zones.read')
    or exists (
      select 1
      from public.zones z
      where z.id = target_zone_id
        and z.deleted_at is null
        and z.status = 'active'
        and (
          z.visibility = 'public'
          or public.is_zone_member(z.id)
          or public.has_zone_permission(z.id, 'zones.read')
        )
    );
$$;

create or replace function public.can_moderate_zone(target_zone_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_global_permission('moderation.read')
    or public.has_zone_permission(target_zone_id, 'moderation.read')
    or exists (
      select 1
      from public.zone_members zm
      where zm.zone_id = target_zone_id
        and zm.user_id = auth.uid()
        and zm.status = 'active'
        and zm.member_role in ('moderator', 'admin')
    );
$$;

create or replace function public.can_read_chat_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_service_role()
    or exists (
      select 1
      from public.chat_room_members crm
      where crm.room_id = target_room_id
        and crm.user_id = auth.uid()
        and crm.status = 'active'
    )
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = target_room_id
        and (
          cr.visibility = 'public'
          or public.can_moderate_zone(cr.zone_id)
          or public.has_global_permission('chat.read')
        )
    );
$$;

create or replace function public.soft_delete_post(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set deleted_at = coalesce(deleted_at, now()),
      status = 'deleted',
      body = null,
      updated_at = now()
  where id = target_post_id;
end;
$$;

create or replace function public.soft_delete_comment(target_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comments
  set deleted_at = coalesce(deleted_at, now()),
      status = 'deleted',
      body = '[deleted]',
      updated_at = now()
  where id = target_comment_id;
end;
$$;

create or replace function public.anonymize_profile(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set username = ('deleted-' || replace(target_user_id::text, '-', ''))::citext,
      display_name = 'Deleted user',
      bio = null,
      website_url = null,
      github_username = null,
      orcid = null,
      affiliation = null,
      research_interests = '{}',
      avatar_file_id = null,
      profile_visibility = 'private',
      anonymized_at = coalesce(anonymized_at, now()),
      updated_at = now()
  where id = target_user_id;

  update public.posts
  set anonymized_at = coalesce(anonymized_at, now())
  where author_id = target_user_id and anonymized_at is null;

  update public.comments
  set anonymized_at = coalesce(anonymized_at, now())
  where author_id = target_user_id and anonymized_at is null;
end;
$$;

comment on function public.anonymize_profile(uuid) is
  'Public UGC is anonymized/soft-deleted for account deletion. Published research versions are not destroyed; Phase 09 handles withdrawal/redaction records.';
