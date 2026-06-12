-- Production scheduler for session link provisioning.
--
-- We drive production ticks from Supabase: pg_cron fires every 10 minutes and
-- pg_net POSTs to the tick endpoint. The endpoint authorizes with
-- `Bearer <CRON_SECRET>`. The GitHub Actions workflow is manual-only so there
-- is a single automatic production scheduler.
--
-- PREREQUISITE (manual, kept out of version control because it is a secret):
-- the bearer token and target URL are read from Vault by name at runtime.
-- Create them once per environment in the Supabase SQL editor, matching Vercel:
--
--   select vault.create_secret(
--     '<CRON_SECRET>', 'zenmeet_cron_secret',
--     'Bearer token for /api/cron/tick (matches Vercel CRON_SECRET)');
--   select vault.create_secret(
--     'https://<app-host>/api/cron/tick', 'zenmeet_cron_target_url',
--     'Absolute URL for this environment''s /api/cron/tick endpoint');
--
-- Do not reuse production Vault secrets in preview/local databases.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- cron.schedule upserts by job name, so re-applying this migration is safe.
select cron.schedule(
  'zenmeet-provision-tick',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'zenmeet_cron_target_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zenmeet_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  );
  $job$
);
