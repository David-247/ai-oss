-- Phase 15: moderator tiers, community governance, and emergency overrides.

alter table public.zone_members
  add column if not exists moderator_tier text,
  add column if not exists moderator_selection_source text,
  add column if not exists moderator_status text,
  add column if not exists moderator_status_reason text,
  add column if not exists moderator_since timestamptz,
  add column if not exists moderator_updated_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'zone_members_moderator_tier_check'
  ) then
    alter table public.zone_members
      add constraint zone_members_moderator_tier_check
      check (
        moderator_tier is null
        or moderator_tier in (
          'lead_moderator',
          'content_moderator',
          'chat_moderator',
          'junior_moderator',
          'research_reviewer',
          'automod_editor'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'zone_members_moderator_selection_source_check'
  ) then
    alter table public.zone_members
      add constraint zone_members_moderator_selection_source_check
      check (
        moderator_selection_source is null
        or moderator_selection_source in (
          'founder_appointment',
          'lead_invitation',
          'community_nomination',
          'zone_election',
          'admin_emergency_appointment',
          'moderator_resignation',
          'community_removal',
          'admin_emergency_removal'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'zone_members_moderator_status_check'
  ) then
    alter table public.zone_members
      add constraint zone_members_moderator_status_check
      check (
        moderator_status is null
        or moderator_status in ('active', 'suspended', 'removed', 'restored')
      );
  end if;
end $$;

alter table public.mod_removal_petitions
  add column if not exists support_threshold integer not null default 10 check (support_threshold >= 1),
  add column if not exists eligibility_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists public_reason text,
  add column if not exists outcome_reason text,
  add column if not exists qualified_at timestamptz,
  add column if not exists opened_vote_id uuid references public.governance_votes(id) on delete set null;

alter table public.mod_removal_petition_support
  add column if not exists eligibility_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists risk_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists suspicious_score numeric(8, 4) not null default 0;

alter table public.governance_votes
  add column if not exists certification_status text not null default 'pending',
  add column if not exists certification_reason text,
  add column if not exists aggregate_tally jsonb not null default '{}'::jsonb,
  add column if not exists public_result jsonb,
  add column if not exists quorum_percent numeric(5, 2) not null default 10,
  add column if not exists removal_threshold_percent numeric(5, 2) not null default 60,
  add column if not exists certification_required boolean not null default true,
  add column if not exists admin_review_reason text,
  add column if not exists frozen_at timestamptz,
  add column if not exists frozen_by uuid references public.profiles(id) on delete set null,
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidated_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'governance_votes_certification_status_check'
  ) then
    alter table public.governance_votes
      add constraint governance_votes_certification_status_check
      check (certification_status in (
        'pending',
        'not_required',
        'certifying',
        'certified',
        'admin_review',
        'invalidated'
      ));
  end if;
end $$;

alter table public.governance_ballots
  add column if not exists ballot_hash text,
  add column if not exists eligibility_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists risk_snapshot jsonb not null default '{}'::jsonb;

create index if not exists zone_members_moderator_tier_idx
  on public.zone_members (zone_id, moderator_tier, moderator_status)
  where member_role in ('moderator', 'admin');

create index if not exists mod_removal_petitions_zone_status_idx
  on public.mod_removal_petitions (zone_id, status, updated_at desc);

create index if not exists governance_ballots_vote_certified_idx
  on public.governance_ballots (governance_vote_id, is_certified, choice);

create unique index if not exists governance_ballots_vote_hash_idx
  on public.governance_ballots (governance_vote_id, ballot_hash)
  where ballot_hash is not null;

insert into public.roles (role_key, name, description, role_type, permissions, system_role)
values
  (
    'zone:zone_owner_founder',
    'Zone Owner / Founder',
    'Founder-level zone role scoped to community operations and never global legal, privacy, security, finance, or audit powers.',
    'zone',
    array[
      'zones.*', 'content.*', 'chat.*', 'voice.*',
      'moderation.read', 'moderation.update'
    ],
    true
  ),
  (
    'zone:lead_moderator',
    'Lead Moderator',
    'Lead moderator tier for settings, moderators, appeals, AutoMod publication, and removal certification starts.',
    'zone',
    array[
      'zones.members.read', 'zones.members.update',
      'zones.settings_read', 'zones.settings_update',
      'zones.governance_read', 'zones.governance_update',
      'content.*', 'chat.*', 'voice.*',
      'moderation.read', 'moderation.update', 'moderation.automod_manage'
    ],
    true
  ),
  (
    'zone:content_moderator',
    'Content Moderator',
    'Content moderator tier for post/comment reports, locks, removals, and restores within zone scope.',
    'zone',
    array['content.read', 'content.update', 'content.remove', 'moderation.read'],
    true
  ),
  (
    'zone:chat_moderator',
    'Chat Moderator',
    'Chat and voice moderator tier for room moderation, mute, kick, locks, and emergency voice-room endings.',
    'zone',
    array['chat.read', 'chat.update', 'chat.moderate', 'voice.read', 'voice.moderate'],
    true
  ),
  (
    'zone:junior_moderator',
    'Junior Moderator',
    'Junior moderator tier for report triage, spam marking, and recommended actions without permanent bans or moderator removal.',
    'zone',
    array['content.read', 'moderation.read'],
    true
  ),
  (
    'zone:research_reviewer',
    'Research Reviewer',
    'Research reviewer tier for structured review metadata without independent content-removal authority.',
    'zone',
    array['research.read', 'research.update', 'content.read'],
    true
  ),
  (
    'zone:automod_editor',
    'AutoMod Editor',
    'AutoMod editor tier for drafting rule changes that require lead moderator or admin approval before publication.',
    'zone',
    array['moderation.read', 'moderation.automod_manage'],
    true
  )
on conflict (role_key) do update
set
  name = excluded.name,
  description = excluded.description,
  role_type = excluded.role_type,
  permissions = excluded.permissions,
  system_role = excluded.system_role,
  updated_at = now();
