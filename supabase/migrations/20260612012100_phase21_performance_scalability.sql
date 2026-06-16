-- Phase 21: performance/scalability indexes and safe materialized counters
-- for feed, search, moderation queue, realtime, and cost-control hot paths.

create index if not exists posts_public_feed_phase21_idx
on public.posts (visibility, status, moderation_status, created_at desc, id desc)
where deleted_at is null;

create index if not exists posts_zone_feed_phase21_idx
on public.posts (zone_id, visibility, status, moderation_status, created_at desc, id desc)
where deleted_at is null;

create index if not exists posts_rank_phase21_idx
on public.posts (zone_id, certified_score desc, score desc, comment_count desc, created_at desc)
where deleted_at is null and status = 'published' and moderation_status <> 'removed';

create index if not exists comments_post_cursor_phase21_idx
on public.comments (post_id, created_at desc, id desc)
where deleted_at is null and status = 'published' and moderation_status <> 'removed';

create index if not exists comments_paper_cursor_phase21_idx
on public.comments (paper_id, created_at desc, id desc)
where deleted_at is null and status = 'published' and moderation_status <> 'removed';

create index if not exists search_documents_query_phase21_idx
on public.search_documents (target_type, is_fresh, indexed_at desc, id desc)
where deleted_at is null;

create index if not exists search_documents_zone_query_phase21_idx
on public.search_documents (zone_id, target_type, is_fresh, indexed_at desc, id desc)
where deleted_at is null;

create index if not exists reports_queue_phase21_idx
on public.reports (status, zone_id, created_at desc, id desc);

create index if not exists automod_runs_queue_phase21_idx
on public.automod_runs (status, zone_id, created_at desc, id desc);

create index if not exists appeals_queue_phase21_idx
on public.appeals (status, created_at desc, id desc);

create index if not exists governance_votes_queue_phase21_idx
on public.governance_votes (zone_id, status, created_at desc, id desc);

create index if not exists voice_rooms_active_phase21_idx
on public.voice_rooms (is_active, visibility, created_at desc, id desc);

create index if not exists voice_rooms_zone_active_phase21_idx
on public.voice_rooms (zone_id, is_active, created_at desc, id desc);

create index if not exists chat_messages_room_cursor_phase21_idx
on public.chat_messages (room_id, created_at desc, id desc)
where deleted_at is null;

create index if not exists files_owner_cost_phase21_idx
on public.files (owner_id, created_at desc, size_bytes);

create index if not exists abuse_rate_limit_actor_action_phase21_idx
on public.abuse_rate_limit_events (actor_id, action, created_at desc);

create or replace function public.phase21_comment_visible(row_status text, row_moderation text, row_deleted_at timestamptz)
returns boolean
language sql
stable
as $$
  select row_deleted_at is null and row_status = 'published' and row_moderation <> 'removed';
$$;

create or replace function public.phase21_sync_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.post_id is not null and public.phase21_comment_visible(new.status, new.moderation_status, new.deleted_at) then
      update public.posts
      set comment_count = greatest(0, comment_count + 1), updated_at = now()
      where id = new.post_id;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.post_id is not null and public.phase21_comment_visible(old.status, old.moderation_status, old.deleted_at) then
      update public.posts
      set comment_count = greatest(0, comment_count - 1), updated_at = now()
      where id = old.post_id;
    end if;
    return old;
  end if;

  if old.post_id is not null and public.phase21_comment_visible(old.status, old.moderation_status, old.deleted_at) then
    update public.posts
    set comment_count = greatest(0, comment_count - 1), updated_at = now()
    where id = old.post_id;
  end if;

  if new.post_id is not null and public.phase21_comment_visible(new.status, new.moderation_status, new.deleted_at) then
    update public.posts
    set comment_count = greatest(0, comment_count + 1), updated_at = now()
    where id = new.post_id;
  end if;

  return new;
end;
$$;

drop trigger if exists phase21_comments_counter_sync on public.comments;
create trigger phase21_comments_counter_sync
after insert or update or delete
on public.comments
for each row execute function public.phase21_sync_post_comment_count();

create or replace function public.phase21_apply_vote_delta(
  vote_target_type text,
  vote_target_id uuid,
  score_delta integer,
  certified_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if vote_target_type = 'post' then
    update public.posts
    set
      score = score + score_delta,
      certified_score = certified_score + certified_delta,
      updated_at = now()
    where id = vote_target_id;
  elsif vote_target_type = 'comment' then
    update public.comments
    set
      score = score + score_delta,
      certified_score = certified_score + certified_delta,
      updated_at = now()
    where id = vote_target_id;
  end if;
end;
$$;

create or replace function public.phase21_sync_vote_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.phase21_apply_vote_delta(
      new.target_type,
      new.target_id,
      new.value,
      case when new.is_certified then new.value else 0 end
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.phase21_apply_vote_delta(
      old.target_type,
      old.target_id,
      -old.value,
      case when old.is_certified then -old.value else 0 end
    );
    return old;
  end if;

  perform public.phase21_apply_vote_delta(
    old.target_type,
    old.target_id,
    -old.value,
    case when old.is_certified then -old.value else 0 end
  );
  perform public.phase21_apply_vote_delta(
    new.target_type,
    new.target_id,
    new.value,
    case when new.is_certified then new.value else 0 end
  );
  return new;
end;
$$;

drop trigger if exists phase21_votes_score_sync on public.votes;
create trigger phase21_votes_score_sync
after insert or update or delete
on public.votes
for each row execute function public.phase21_sync_vote_scores();
