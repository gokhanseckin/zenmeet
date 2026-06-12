create table pending_checkout_sessions (
  student_id uuid not null references students(id) on delete cascade,
  classroom_id uuid not null references classrooms(id) on delete cascade,
  stripe_checkout_session_id text,
  url text,
  expires_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, classroom_id)
);

create index pending_checkout_sessions_expires_at
  on pending_checkout_sessions (expires_at);

alter table pending_checkout_sessions enable row level security;
