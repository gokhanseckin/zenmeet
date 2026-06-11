create extension if not exists pgcrypto;

create table teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  timezone text not null default 'UTC',
  stripe_account_id text,
  zoom_tokens_enc text,
  google_tokens_enc text,
  zoom_needs_reconnect boolean not null default false,
  google_needs_reconnect boolean not null default false,
  onboarding_step text not null default 'classroom',
  created_at timestamptz not null default now()
);

create table classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text not null default '',
  provider text not null default 'meet' check (provider in ('zoom','meet')),
  price_amount integer,
  currency text not null default 'usd',
  trial_days integer not null default 7,
  stripe_product_id text,
  stripe_price_id text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

create table class_schedules (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references classrooms(id) on delete cascade,
  kind text not null check (kind in ('one_off','weekly')),
  starts_at timestamptz,
  weekday smallint check (weekday between 0 and 6),
  local_time text,
  duration_minutes integer not null,
  until date,
  created_at timestamptz not null default now(),
  constraint one_off_fields check (kind <> 'one_off' or starts_at is not null),
  constraint weekly_fields check (kind <> 'weekly' or (weekday is not null and local_time is not null))
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references classrooms(id) on delete cascade,
  schedule_id uuid not null references class_schedules(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','done','canceled')),
  join_url text,
  provider_meeting_id text,
  provision_attempts integer not null default 0,
  unique (schedule_id, starts_at)
);
create index sessions_classroom_start on sessions (classroom_id, starts_at);

create table students (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  classroom_id uuid not null references classrooms(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, classroom_id)
);

create table stripe_events (
  id text primary key,
  received_at timestamptz not null default now()
);

-- RLS: server uses service-role (bypasses RLS). Lock tables down for anon/auth keys;
-- allow the narrow direct reads the client needs.
alter table teachers enable row level security;
alter table classrooms enable row level security;
alter table class_schedules enable row level security;
alter table sessions enable row level security;
alter table students enable row level security;
alter table memberships enable row level security;
alter table stripe_events enable row level security;

create policy "own teacher row" on teachers for select using (auth.uid() = id);
create policy "own student row" on students for select using (auth.uid() = id);
create policy "published classrooms readable" on classrooms for select using (status = 'published' or teacher_id = auth.uid());
create policy "schedules of readable classrooms" on class_schedules for select
  using (exists (select 1 from classrooms c where c.id = classroom_id and (c.status = 'published' or c.teacher_id = auth.uid())));
create policy "sessions of readable classrooms" on sessions for select
  using (exists (select 1 from classrooms c where c.id = classroom_id and (c.status = 'published' or c.teacher_id = auth.uid())));
create policy "own memberships" on memberships for select using (student_id = auth.uid());
