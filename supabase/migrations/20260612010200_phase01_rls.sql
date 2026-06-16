-- Phase 01: Row Level Security and client grants.
-- Source: phases/PHASE-01-data-architecture-rls.md

grant usage on schema public to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_security_state enable row level security;
alter table public.consent_events enable row level security;
alter table public.roles enable row level security;
alter table public.role_bindings enable row level security;
alter table public.permission_audit enable row level security;
alter table public.zones enable row level security;
alter table public.zone_members enable row level security;
alter table public.zone_flairs enable row level security;
alter table public.zone_wiki_pages enable row level security;
alter table public.zone_settings enable row level security;
alter table public.zone_governance_settings enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.votes enable row level security;
alter table public.papers enable row level security;
alter table public.paper_versions enable row level security;
alter table public.paper_authors enable row level security;
alter table public.paper_files enable row level security;
alter table public.paper_links enable row level security;
alter table public.paper_reviews enable row level security;
alter table public.replication_reports enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.voice_rooms enable row level security;
alter table public.voice_participants enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.appeals enable row level security;
alter table public.automod_rules enable row level security;
alter table public.automod_runs enable row level security;
alter table public.mod_removal_petitions enable row level security;
alter table public.mod_removal_petition_support enable row level security;
alter table public.governance_votes enable row level security;
alter table public.governance_ballots enable row level security;
alter table public.files enable row level security;
alter table public.search_documents enable row level security;
alter table public.donations enable row level security;
alter table public.stripe_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.legal_requests enable row level security;
alter table public.transparency_report_events enable row level security;

grant select on public.profiles to anon, authenticated;
grant select on public.zones to anon, authenticated;
grant select on public.zone_flairs to anon, authenticated;
grant select on public.zone_wiki_pages to anon, authenticated;
grant select on public.posts to anon, authenticated;
grant select on public.comments to anon, authenticated;
grant select on public.papers to anon, authenticated;
grant select on public.paper_versions to anon, authenticated;
grant select on public.paper_authors to anon, authenticated;
grant select on public.paper_files to anon, authenticated;
grant select on public.paper_links to anon, authenticated;
grant select on public.paper_reviews to anon, authenticated;
grant select on public.replication_reports to anon, authenticated;
grant select on public.search_documents to anon, authenticated;

grant select on public.user_settings to authenticated;
grant select on public.user_security_state to authenticated;
grant select on public.consent_events to authenticated;
grant select on public.roles to authenticated;
grant select on public.role_bindings to authenticated;
grant select on public.zone_members to authenticated;
grant select on public.zone_settings to authenticated;
grant select on public.zone_governance_settings to authenticated;
grant select on public.votes to authenticated;
grant select on public.chat_rooms to authenticated;
grant select on public.chat_room_members to authenticated;
grant select on public.chat_messages to authenticated;
grant select on public.voice_rooms to authenticated;
grant select on public.voice_participants to authenticated;
grant select on public.reports to authenticated;
grant select on public.appeals to authenticated;
grant select on public.automod_rules to authenticated;
grant select on public.mod_removal_petitions to authenticated;
grant select on public.mod_removal_petition_support to authenticated;
grant select on public.governance_votes to authenticated;
grant select on public.governance_ballots to authenticated;
grant select on public.files to authenticated;
grant select on public.donations to authenticated;
grant select on public.privacy_requests to authenticated;

grant insert (
  id, username, display_name, avatar_file_id, bio, website_url, github_username,
  orcid, affiliation, research_interests, profile_visibility, email_visibility,
  contact_permission, search_indexing_enabled, donor_badge_visible
) on public.profiles to authenticated;
grant update (
  username, display_name, avatar_file_id, bio, website_url, github_username,
  orcid, affiliation, research_interests, profile_visibility, email_visibility,
  contact_permission, search_indexing_enabled, donor_badge_visible, updated_at
) on public.profiles to authenticated;

grant insert, update on public.user_settings to authenticated;
grant insert on public.consent_events to authenticated;

grant insert (
  slug, name, description, visibility, created_by, default_post_visibility
) on public.zones to authenticated;
grant update (
  name, description, visibility, default_post_visibility, deleted_at, updated_at
) on public.zones to authenticated;

grant insert, update on public.zone_members to authenticated;
grant insert, update, delete on public.zone_flairs to authenticated;
grant insert, update, delete on public.zone_wiki_pages to authenticated;
grant update on public.zone_settings to authenticated;
grant update on public.zone_governance_settings to authenticated;

grant insert (
  zone_id, author_id, post_type, title, url, body, markdown, flair_id, tags,
  visibility, status
) on public.posts to authenticated;
grant update (
  title, url, body, markdown, flair_id, tags, visibility, status, is_locked,
  deleted_at, anonymized_at, updated_at
) on public.posts to authenticated;
grant delete on public.posts to authenticated;

grant insert (
  post_id, paper_id, paper_version_id, parent_comment_id, author_id, body,
  markdown, status
) on public.comments to authenticated;
grant update (
  body, markdown, edit_history, status, is_locked, deleted_at, anonymized_at,
  updated_at
) on public.comments to authenticated;
grant delete on public.comments to authenticated;

grant insert (user_id, target_type, target_id, value) on public.votes to authenticated;
grant update (value, updated_at) on public.votes to authenticated;
grant delete on public.votes to authenticated;

grant insert (
  identifier, submitter_id, zone_id, title, abstract, categories, tags, license,
  status, not_peer_reviewed_label_acknowledged
) on public.papers to authenticated;
grant update (
  title, abstract, categories, tags, license, status, current_version_number,
  withdrawn_at, deleted_at, anonymized_at, updated_at
) on public.papers to authenticated;
grant insert on public.paper_versions to authenticated;
grant insert, update, delete on public.paper_authors to authenticated;
grant insert, delete on public.paper_files to authenticated;
grant insert, update, delete on public.paper_links to authenticated;
grant insert, update, delete on public.paper_reviews to authenticated;
grant insert, update, delete on public.replication_reports to authenticated;

grant insert, update on public.chat_rooms to authenticated;
grant insert, update, delete on public.chat_room_members to authenticated;
grant insert (
  room_id, author_id, parent_message_id, body, markdown, attachment_file_ids
) on public.chat_messages to authenticated;
grant update (
  body, markdown, edit_history, status, deleted_at, anonymized_at, updated_at
) on public.chat_messages to authenticated;
grant delete on public.chat_messages to authenticated;
grant insert, update on public.voice_rooms to authenticated;
grant insert, update on public.voice_participants to authenticated;

grant insert, update on public.reports to authenticated;
grant insert, update on public.appeals to authenticated;
grant insert, update on public.automod_rules to authenticated;
grant insert on public.mod_removal_petitions to authenticated;
grant insert on public.mod_removal_petition_support to authenticated;
grant insert on public.governance_ballots to authenticated;

grant insert (
  owner_id, provider, storage_key, filename, content_type, size_bytes, sha256,
  visibility, zone_id, metadata
) on public.files to authenticated;
grant update (
  filename, visibility, metadata, deleted_at, anonymized_at, updated_at
) on public.files to authenticated;

grant insert, update on public.privacy_requests to authenticated;

create policy profiles_read_visible
on public.profiles for select
using (
  deleted_at is null and (
    profile_visibility = 'public'
    or id = auth.uid()
    or (profile_visibility = 'authenticated' and auth.uid() is not null)
    or public.has_global_permission('users.read')
  )
);

create policy profiles_insert_own
on public.profiles for insert
with check (id = auth.uid());

create policy profiles_update_own_safe_columns
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy user_settings_own
on public.user_settings for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy user_security_state_read_own
on public.user_security_state for select
using (user_id = auth.uid() or public.has_global_permission('security.read'));

create policy consent_events_read_own
on public.consent_events for select
using (user_id = auth.uid() or public.has_global_permission('privacy.read'));

create policy consent_events_insert_own
on public.consent_events for insert
with check (user_id = auth.uid());

create policy roles_read_authenticated
on public.roles for select
using (auth.uid() is not null);

create policy role_bindings_read_self_or_admin
on public.role_bindings for select
using (user_id = auth.uid() or public.has_global_permission('roles.read'));

create policy permission_audit_read_admin
on public.permission_audit for select
using (public.has_global_permission('roles.read') or public.has_global_permission('audit.read'));

create policy zones_read_authorized
on public.zones for select
using (
  deleted_at is null and (
    visibility = 'public'
    or public.is_zone_member(id)
    or public.has_zone_permission(id, 'zones.read')
  )
);

create policy zones_insert_authenticated
on public.zones for insert
with check (created_by = auth.uid());

create policy zones_update_admin
on public.zones for update
using (public.has_zone_permission(id, 'zones.update') or created_by = auth.uid())
with check (public.has_zone_permission(id, 'zones.update') or created_by = auth.uid());

create policy zone_members_read_authorized
on public.zone_members for select
using (public.can_read_zone(zone_id));

create policy zone_members_join_public_zone
on public.zone_members for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.zones z
    where z.id = zone_id and z.visibility = 'public' and z.status = 'active'
  )
);

create policy zone_members_manage_zone
on public.zone_members for update
using (public.has_zone_permission(zone_id, 'zones.members.update'))
with check (public.has_zone_permission(zone_id, 'zones.members.update'));

create policy zone_flairs_read_zone
on public.zone_flairs for select
using (public.can_read_zone(zone_id));

create policy zone_flairs_manage_zone
on public.zone_flairs for all
using (public.has_zone_permission(zone_id, 'zones.update'))
with check (public.has_zone_permission(zone_id, 'zones.update'));

create policy zone_wiki_pages_read_authorized
on public.zone_wiki_pages for select
using (
  deleted_at is null and (
    visibility = 'public'
    or (visibility = 'members' and public.is_zone_member(zone_id))
    or (visibility = 'mods' and public.can_moderate_zone(zone_id))
  )
);

create policy zone_wiki_pages_manage_zone
on public.zone_wiki_pages for all
using (public.has_zone_permission(zone_id, 'zones.update'))
with check (public.has_zone_permission(zone_id, 'zones.update'));

create policy zone_settings_read_authorized
on public.zone_settings for select
using (public.can_read_zone(zone_id));

create policy zone_settings_update_admin
on public.zone_settings for update
using (public.has_zone_permission(zone_id, 'zones.settings_update'))
with check (public.has_zone_permission(zone_id, 'zones.settings_update'));

create policy zone_governance_settings_read_authorized
on public.zone_governance_settings for select
using (public.can_read_zone(zone_id));

create policy zone_governance_settings_update_admin
on public.zone_governance_settings for update
using (public.has_zone_permission(zone_id, 'zones.governance_update'))
with check (public.has_zone_permission(zone_id, 'zones.governance_update'));

create policy posts_read_authorized
on public.posts for select
using (
  deleted_at is null
  and status = 'published'
  and moderation_status <> 'removed'
  and (
    visibility = 'public'
    or author_id = auth.uid()
    or public.can_read_zone(zone_id)
    or public.can_moderate_zone(zone_id)
  )
);

create policy posts_insert_own
on public.posts for insert
with check (
  author_id = auth.uid()
  and (zone_id is null or public.can_read_zone(zone_id))
);

create policy posts_update_own_or_mod
on public.posts for update
using (author_id = auth.uid() or public.can_moderate_zone(zone_id))
with check (author_id = auth.uid() or public.can_moderate_zone(zone_id));

create policy posts_delete_own_or_mod
on public.posts for delete
using (author_id = auth.uid() or public.can_moderate_zone(zone_id));

create policy papers_read_published_or_authorized
on public.papers for select
using (
  deleted_at is null and (
    status in ('published', 'withdrawn', 'superseded', 'retracted', 'redacted')
    or submitter_id = auth.uid()
    or public.can_moderate_zone(zone_id)
    or public.has_global_permission('research.read')
  )
);

create policy papers_insert_submitter
on public.papers for insert
with check (submitter_id = auth.uid());

create policy papers_update_submitter_or_research_admin
on public.papers for update
using (submitter_id = auth.uid() or public.has_global_permission('research.update'))
with check (submitter_id = auth.uid() or public.has_global_permission('research.update'));

create policy paper_versions_read_published_or_submitter
on public.paper_versions for select
using (
  exists (
    select 1 from public.papers p
    where p.id = paper_id
      and (
        p.status in ('published', 'withdrawn', 'superseded', 'retracted', 'redacted')
        or p.submitter_id = auth.uid()
        or public.has_global_permission('research.read')
      )
  )
);

create policy paper_versions_insert_submitter
on public.paper_versions for insert
with check (
  submitter_id = auth.uid()
  and exists (select 1 from public.papers p where p.id = paper_id and p.submitter_id = auth.uid())
);

create policy paper_authors_read_visible_paper
on public.paper_authors for select
using (exists (select 1 from public.papers p where p.id = paper_id));

create policy paper_authors_manage_submitter
on public.paper_authors for all
using (exists (select 1 from public.papers p where p.id = paper_id and p.submitter_id = auth.uid()))
with check (exists (select 1 from public.papers p where p.id = paper_id and p.submitter_id = auth.uid()));

create policy paper_files_read_visible_paper
on public.paper_files for select
using (exists (select 1 from public.papers p where p.id = paper_id));

create policy paper_files_manage_submitter
on public.paper_files for all
using (exists (select 1 from public.papers p where p.id = paper_id and p.submitter_id = auth.uid()))
with check (exists (select 1 from public.papers p where p.id = paper_id and p.submitter_id = auth.uid()));

create policy paper_links_read_visible_paper
on public.paper_links for select
using (exists (select 1 from public.papers p where p.id = paper_id));

create policy paper_links_manage_submitter
on public.paper_links for all
using (exists (select 1 from public.papers p where p.id = paper_id and p.submitter_id = auth.uid()))
with check (exists (select 1 from public.papers p where p.id = paper_id and p.submitter_id = auth.uid()));

create policy paper_reviews_read_published
on public.paper_reviews for select
using (deleted_at is null and status = 'published' and moderation_status <> 'removed');

create policy paper_reviews_write_own
on public.paper_reviews for all
using (reviewer_id = auth.uid() or public.has_global_permission('research.update'))
with check (reviewer_id = auth.uid() or public.has_global_permission('research.update'));

create policy replication_reports_read_published
on public.replication_reports for select
using (deleted_at is null and status = 'published' and moderation_status <> 'removed');

create policy replication_reports_write_own
on public.replication_reports for all
using (reporter_id = auth.uid() or public.has_global_permission('research.update'))
with check (reporter_id = auth.uid() or public.has_global_permission('research.update'));

create policy comments_read_authorized
on public.comments for select
using (
  deleted_at is null
  and status = 'published'
  and moderation_status <> 'removed'
  and (
    exists (select 1 from public.posts p where p.id = post_id)
    or exists (select 1 from public.papers p where p.id = paper_id)
    or author_id = auth.uid()
  )
);

create policy comments_insert_own
on public.comments for insert
with check (author_id = auth.uid());

create policy comments_update_own_or_mod
on public.comments for update
using (
  author_id = auth.uid()
  or exists (select 1 from public.posts p where p.id = post_id and public.can_moderate_zone(p.zone_id))
  or public.has_global_permission('moderation.update')
)
with check (
  author_id = auth.uid()
  or exists (select 1 from public.posts p where p.id = post_id and public.can_moderate_zone(p.zone_id))
  or public.has_global_permission('moderation.update')
);

create policy comments_delete_own_or_mod
on public.comments for delete
using (
  author_id = auth.uid()
  or exists (select 1 from public.posts p where p.id = post_id and public.can_moderate_zone(p.zone_id))
  or public.has_global_permission('moderation.update')
);

create policy votes_read_own_only
on public.votes for select
using (user_id = auth.uid() or public.has_global_permission('security.read'));

create policy votes_insert_own
on public.votes for insert
with check (user_id = auth.uid());

create policy votes_update_own_value_only
on public.votes for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy votes_delete_own
on public.votes for delete
using (user_id = auth.uid());

create policy chat_rooms_read_authorized
on public.chat_rooms for select
using (deleted_at is null and public.can_read_chat_room(id));

create policy chat_rooms_insert_authenticated
on public.chat_rooms for insert
with check (created_by = auth.uid() and (zone_id is null or public.can_read_zone(zone_id)));

create policy chat_rooms_update_authorized
on public.chat_rooms for update
using (created_by = auth.uid() or public.can_moderate_zone(zone_id) or public.has_global_permission('chat.update'))
with check (created_by = auth.uid() or public.can_moderate_zone(zone_id) or public.has_global_permission('chat.update'));

create policy chat_room_members_read_room_members
on public.chat_room_members for select
using (public.can_read_chat_room(room_id));

create policy chat_room_members_insert_self_or_manager
on public.chat_room_members for insert
with check (
  user_id = auth.uid()
  or exists (select 1 from public.chat_rooms cr where cr.id = room_id and public.can_moderate_zone(cr.zone_id))
);

create policy chat_room_members_update_self_or_manager
on public.chat_room_members for update
using (
  user_id = auth.uid()
  or exists (select 1 from public.chat_rooms cr where cr.id = room_id and public.can_moderate_zone(cr.zone_id))
)
with check (
  user_id = auth.uid()
  or exists (select 1 from public.chat_rooms cr where cr.id = room_id and public.can_moderate_zone(cr.zone_id))
);

create policy chat_messages_read_room_members
on public.chat_messages for select
using (deleted_at is null and public.can_read_chat_room(room_id));

create policy chat_messages_insert_room_members
on public.chat_messages for insert
with check (author_id = auth.uid() and public.can_read_chat_room(room_id));

create policy chat_messages_update_own_or_mod
on public.chat_messages for update
using (
  author_id = auth.uid()
  or exists (select 1 from public.chat_rooms cr where cr.id = room_id and public.can_moderate_zone(cr.zone_id))
)
with check (
  author_id = auth.uid()
  or exists (select 1 from public.chat_rooms cr where cr.id = room_id and public.can_moderate_zone(cr.zone_id))
);

create policy chat_messages_delete_own_or_mod
on public.chat_messages for delete
using (
  author_id = auth.uid()
  or exists (select 1 from public.chat_rooms cr where cr.id = room_id and public.can_moderate_zone(cr.zone_id))
);

create policy voice_rooms_read_authorized
on public.voice_rooms for select
using (
  visibility = 'public'
  or public.can_read_zone(zone_id)
  or exists (select 1 from public.voice_participants vp where vp.voice_room_id = id and vp.user_id = auth.uid())
  or public.has_global_permission('voice.read')
);

create policy voice_rooms_insert_authenticated
on public.voice_rooms for insert
with check (created_by = auth.uid() and coalesce(recording_enabled, false) = false and coalesce(transcription_enabled, false) = false);

create policy voice_rooms_update_authorized
on public.voice_rooms for update
using (created_by = auth.uid() or public.can_moderate_zone(zone_id) or public.has_global_permission('voice.update'))
with check (created_by = auth.uid() or public.can_moderate_zone(zone_id) or public.has_global_permission('voice.update'));

create policy voice_participants_read_authorized
on public.voice_participants for select
using (exists (select 1 from public.voice_rooms vr where vr.id = voice_room_id));

create policy voice_participants_insert_self
on public.voice_participants for insert
with check (user_id = auth.uid());

create policy voice_participants_update_self_or_mod
on public.voice_participants for update
using (
  user_id = auth.uid()
  or exists (select 1 from public.voice_rooms vr where vr.id = voice_room_id and public.can_moderate_zone(vr.zone_id))
)
with check (
  user_id = auth.uid()
  or exists (select 1 from public.voice_rooms vr where vr.id = voice_room_id and public.can_moderate_zone(vr.zone_id))
);

create policy reports_read_own_or_mod
on public.reports for select
using (reporter_id = auth.uid() or public.can_moderate_zone(zone_id) or public.has_global_permission('moderation.read'));

create policy reports_insert_own
on public.reports for insert
with check (reporter_id = auth.uid());

create policy reports_update_mod
on public.reports for update
using (public.can_moderate_zone(zone_id) or public.has_global_permission('moderation.update'))
with check (public.can_moderate_zone(zone_id) or public.has_global_permission('moderation.update'));

create policy moderation_actions_read_authorized
on public.moderation_actions for select
using (public.can_moderate_zone(zone_id) or public.has_global_permission('moderation.read'));

create policy appeals_read_own_or_mod
on public.appeals for select
using (
  appellant_id = auth.uid()
  or exists (
    select 1 from public.moderation_actions ma
    where ma.id = moderation_action_id and public.can_moderate_zone(ma.zone_id)
  )
);

create policy appeals_insert_own
on public.appeals for insert
with check (appellant_id = auth.uid());

create policy appeals_update_mod
on public.appeals for update
using (
  exists (
    select 1 from public.moderation_actions ma
    where ma.id = moderation_action_id and public.can_moderate_zone(ma.zone_id)
  )
)
with check (
  exists (
    select 1 from public.moderation_actions ma
    where ma.id = moderation_action_id and public.can_moderate_zone(ma.zone_id)
  )
);

create policy automod_rules_read_mod
on public.automod_rules for select
using (zone_id is null or public.can_moderate_zone(zone_id) or public.has_global_permission('moderation.read'));

create policy automod_rules_manage_mod
on public.automod_rules for all
using (zone_id is null and public.has_global_permission('moderation.update') or public.can_moderate_zone(zone_id))
with check (zone_id is null and public.has_global_permission('moderation.update') or public.can_moderate_zone(zone_id));

create policy automod_runs_read_mod
on public.automod_runs for select
using (public.has_global_permission('moderation.read'));

create policy mod_removal_petitions_read_zone
on public.mod_removal_petitions for select
using (public.can_read_zone(zone_id));

create policy mod_removal_petitions_insert_member
on public.mod_removal_petitions for insert
with check (created_by = auth.uid() and public.is_zone_member(zone_id));

create policy mod_removal_petition_support_read_zone
on public.mod_removal_petition_support for select
using (exists (select 1 from public.mod_removal_petitions p where p.id = petition_id and public.can_read_zone(p.zone_id)));

create policy mod_removal_petition_support_insert_self
on public.mod_removal_petition_support for insert
with check (user_id = auth.uid());

create policy governance_votes_read_zone
on public.governance_votes for select
using (public.can_read_zone(zone_id));

create policy governance_ballots_read_own_or_admin
on public.governance_ballots for select
using (
  user_id = auth.uid()
  or exists (select 1 from public.governance_votes gv where gv.id = governance_vote_id and public.has_zone_permission(gv.zone_id, 'zones.governance_read'))
);

create policy governance_ballots_insert_self_member
on public.governance_ballots for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.governance_votes gv
    where gv.id = governance_vote_id and public.is_zone_member(gv.zone_id) and gv.status = 'open'
  )
);

create policy files_read_authorized
on public.files for select
using (
  deleted_at is null and (
    visibility = 'public'
    or (visibility = 'authenticated' and auth.uid() is not null)
    or owner_id = auth.uid()
    or (visibility = 'zone' and public.can_read_zone(zone_id))
    or (visibility = 'moderator' and public.can_moderate_zone(zone_id))
    or (visibility = 'admin' and public.has_global_permission('files.read'))
  )
);

create policy files_insert_owner
on public.files for insert
with check (owner_id = auth.uid());

create policy files_update_owner_limited
on public.files for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy search_documents_read_authorized
on public.search_documents for select
using (
  deleted_at is null and (
    visibility = 'public'
    or (visibility = 'authenticated' and auth.uid() is not null)
    or (visibility = 'zone' and public.can_read_zone(zone_id))
    or (visibility = 'moderator' and public.can_moderate_zone(zone_id))
    or (visibility = 'admin' and public.has_global_permission('search.read'))
  )
);

create policy donations_read_own
on public.donations for select
using (user_id = auth.uid() or public.has_global_permission('finance.read'));

create policy audit_events_read_authorized
on public.audit_events for select
using (public.has_global_permission('audit.read'));

create policy privacy_requests_read_own_or_privacy_admin
on public.privacy_requests for select
using (user_id = auth.uid() or public.has_global_permission('privacy.read'));

create policy privacy_requests_insert_own
on public.privacy_requests for insert
with check (user_id = auth.uid());

create policy privacy_requests_update_privacy_admin
on public.privacy_requests for update
using (public.has_global_permission('privacy.update'))
with check (public.has_global_permission('privacy.update'));

create policy legal_requests_read_legal_admin
on public.legal_requests for select
using (public.has_global_permission('legal.read'));

create policy transparency_report_events_read_public_or_admin
on public.transparency_report_events for select
using (is_public = true or public.has_global_permission('audit.read'));
