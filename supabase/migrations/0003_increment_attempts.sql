create or replace function increment_provision_attempts(session_id uuid)
returns void language sql as $$
  update sessions set provision_attempts = provision_attempts + 1 where id = session_id;
$$;
