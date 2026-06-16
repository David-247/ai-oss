-- Security hardening: restrict direct PostgREST RPC execution of privileged
-- SECURITY DEFINER mutation/trigger helper functions.
--
-- The Supabase database linter (lints 0028/0029) flagged that these functions
-- were callable by the `anon` and `authenticated` roles via /rest/v1/rpc/*.
-- Because they run as SECURITY DEFINER (or are invoked from triggers), direct
-- client invocation would bypass row level security -- e.g. anonymizing or
-- soft-deleting arbitrary rows, or manipulating vote scores.
--
-- RLS *predicate* functions (has_global_permission, can_read_zone,
-- is_zone_member, etc.) are intentionally left executable: row level security
-- policies must be able to evaluate them for the querying role.
--
-- Server-side code continues to use the service role, which is granted execute
-- explicitly below. Triggers invoke these functions as the owner and do not
-- depend on caller EXECUTE privilege.

do $$
declare
  fn text;
  fns text[] := array[
    'public.anonymize_profile(uuid)',
    'public.soft_delete_post(uuid)',
    'public.soft_delete_comment(uuid)',
    'public.phase21_apply_vote_delta(text, uuid, integer, integer)',
    'public.phase21_sync_post_comment_count()',
    'public.phase21_sync_vote_scores()',
    'public.phase21_comment_visible(text, text, timestamptz)',
    'public.set_updated_at()',
    'public.prevent_row_update_or_delete()'
  ];
begin
  foreach fn in array fns loop
    execute format('revoke execute on function %s from public, anon, authenticated;', fn);
    execute format('grant execute on function %s to service_role;', fn);
  end loop;
end $$;
