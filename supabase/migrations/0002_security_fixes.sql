-- C1: the sessions select policy exposed join_url to anon clients via PostgREST.
-- All app reads of sessions go through the service role; clients get nothing.
drop policy "sessions of readable classrooms" on sessions;

-- I1: teacher dashboard lists members by classroom.
create index memberships_classroom_id on memberships (classroom_id);

-- I2: a classroom cannot be published without pricing configured.
alter table classrooms add constraint published_requires_pricing
  check (status = 'draft' or (price_amount is not null and stripe_price_id is not null));

-- I3: deleting a schedule must not silently destroy session history.
alter table sessions drop constraint sessions_schedule_id_fkey;
alter table sessions add constraint sessions_schedule_id_fkey
  foreign key (schedule_id) references class_schedules(id) on delete restrict;
