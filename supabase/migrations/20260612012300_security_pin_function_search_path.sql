-- Security hardening: pin an explicit search_path on helper/trigger functions.
--
-- The Supabase database linter (lint 0011 function_search_path_mutable) flagged
-- these functions as having a role-mutable search_path. A mutable search_path
-- lets a caller's session settings influence how unqualified names resolve,
-- which is a privilege-escalation vector for functions invoked from triggers or
-- RLS evaluation. Pinning a fixed search_path removes that vector.
--
-- pg_catalog is listed first so built-in functions/operators cannot be shadowed
-- by a same-named object in public; public is retained so existing unqualified
-- references inside the function bodies keep resolving (behavior-preserving).

alter function public.set_updated_at() set search_path = pg_catalog, public;
alter function public.prevent_row_update_or_delete() set search_path = pg_catalog, public;
alter function public.current_user_id() set search_path = pg_catalog, public;
alter function public.is_service_role() set search_path = pg_catalog, public;
alter function public.phase21_comment_visible(text, text, timestamptz) set search_path = pg_catalog, public;

-- rls_auto_enable() is an event-trigger function (fires on CREATE TABLE). It is
-- never a legitimate PostgREST RPC target, so remove it from the exposed API by
-- revoking caller EXECUTE. Event triggers run in DDL context and do not depend
-- on the caller holding EXECUTE, so this does not affect auto-RLS behavior.
-- (Silences linter 0028/0029 for this function; the remaining flagged functions
-- are RLS predicate helpers that must stay caller-executable for RLS to work.)
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
