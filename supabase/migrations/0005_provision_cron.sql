-- Production scheduler for session link provisioning.
--
-- Nothing else triggers /api/cron/tick in production (Vercel Hobby crons run
-- only once/day, which is unusable against the 60-minute provisioning window),
-- so we drive it from Supabase: pg_cron fires every 10 minutes and pg_net POSTs
-- to the tick endpoint. The endpoint authorizes with `Bearer <CRON_SECRET>`.
--
-- PREREQUISITE (manual, kept out of version control because it is a secret):
-- the bearer token is read from Vault by name at runtime. Create it once per
-- environment in the Supabase SQL editor, matching the Vercel CRON_SECRET:
--
--   select vault.create_secret(
--     '<CRON_SECRET>', 'zenmeet_cron_secret',
--     'Bearer token for /api/cron/tick (matches Vercel CRON_SECRET)');
--
-- NOTE: the URL targets production. Do not apply this migration to a local or
-- preview database without changing the target, or it will POST to prod.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- cron.schedule upserts by job name, so re-applying this migration is safe.
select cron.schedule(
  'zenmeet-provision-tick',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://www.zenmeet.me/api/cron/tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zenmeet_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  );
  $job$
);
