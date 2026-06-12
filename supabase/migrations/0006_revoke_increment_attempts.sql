-- Lock down increment_provision_attempts (defined in 0003_increment_attempts.sql).
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, and PostgREST
-- exposes any function in the `public` schema as an RPC. That means anon and
-- authenticated callers can invoke this function over the REST API. It is a
-- no-op for them today (only the service role mutates `sessions` meaningfully
-- under RLS), but the public grant is a latent abuse vector one policy change
-- away from letting clients bump provision_attempts arbitrarily. The cron tick
-- runs with the service role, which is exempt from these revokes, so its use is
-- unaffected.
--
-- Signature must match 0003 exactly: increment_provision_attempts(uuid).
revoke execute on function public.increment_provision_attempts(uuid) from public, anon, authenticated;

-- Pin search_path so the function body always resolves objects from `public`,
-- which also clears the Supabase "function_search_path_mutable" advisor.
alter function public.increment_provision_attempts(uuid) set search_path = public;
