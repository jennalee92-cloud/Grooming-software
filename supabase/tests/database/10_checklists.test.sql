-- Cleaning, sanitation and maintenance checklists.
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test.invalid',   'authenticated', 'authenticated', now()),
  ('a0000000-0000-0000-0000-000000000002', 'bather@test.invalid',  'authenticated', 'authenticated', now()),
  ('a0000000-0000-0000-0000-000000000003', 'groomer@test.invalid', 'authenticated', 'authenticated', now()),
  ('a0000000-0000-0000-0000-000000000005', 'owner-b@test.invalid', 'authenticated', 'authenticated', now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.org', public.create_organization('Salon A', 'Main Street')::text, true);
end $$;
insert into public.locations (organization_id, name) values (current_setting('test.org')::uuid, 'Second Street');
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor')::text, true);
end $$;

reset role;
do $$ begin
  perform set_config('test.main',   (select id::text from public.locations where name = 'Main Street'), true);
  perform set_config('test.second', (select id::text from public.locations where name = 'Second Street'), true);
end $$;
-- Bather and groomer work at Main Street only
insert into public.organization_members (organization_id, user_id, role, display_name) values
  (current_setting('test.org')::uuid, 'a0000000-0000-0000-0000-000000000002', 'bather',  'Ben'),
  (current_setting('test.org')::uuid, 'a0000000-0000-0000-0000-000000000003', 'groomer', 'Gina');
insert into public.member_locations (organization_id, member_id, location_id)
select organization_id, id, current_setting('test.main')::uuid from public.organization_members
where user_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003');
set local role authenticated;

-- ---------------------------------------------------------------------
-- Owner builds checklists
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  format($$select set_config('test.daily', public.save_checklist(%L, null, 'Closing sanitation', null, 'daily', null,
           '[{"label":"Disinfect tables"},{"label":"Clean tubs"},{"label":"Sweep hair"}]'::jsonb)::text, true)$$,
         current_setting('test.org')),
  'an owner can create a daily checklist for every location');

select lives_ok(
  format($$select set_config('test.weekly', public.save_checklist(%L, null, 'Deep clean', null, 'weekly', %L,
           '[{"label":"Descale dryers"}]'::jsonb)::text, true)$$,
         current_setting('test.org'), current_setting('test.second')),
  'an owner can create a weekly checklist for one location');

select is((select count(*)::int from public.checklist_tasks where checklist_id = current_setting('test.daily')::uuid), 3,
  'the tasks are saved in order');

reset role;
do $$ begin
  perform set_config('test.task1', (select id::text from public.checklist_tasks where label = 'Disinfect tables'), true);
  perform set_config('test.task2', (select id::text from public.checklist_tasks where label = 'Clean tubs'), true);
  perform set_config('test.weekly_task', (select id::text from public.checklist_tasks where label = 'Descale dryers'), true);
end $$;
set local role authenticated;

-- ---------------------------------------------------------------------
-- Staff tick tasks
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  format($$select public.save_checklist(%L, null, 'Mine', null, 'daily', null, '[{"label":"x"}]'::jsonb)$$, current_setting('test.org')),
  '42501', null, 'a bather cannot create checklists');

select lives_ok(
  format($$insert into public.checklist_checks (organization_id, task_id, location_id, period_start) values (%L, %L, %L, current_date)$$,
         current_setting('test.org'), current_setting('test.task1'), current_setting('test.main')),
  'a bather can tick a task at their location');

select is((select checked_by::text from public.checklist_checks), 'a0000000-0000-0000-0000-000000000002', 'a tick records who did it');

select throws_ok(
  format($$insert into public.checklist_checks (organization_id, task_id, location_id, period_start) values (%L, %L, %L, current_date)$$,
         current_setting('test.org'), current_setting('test.task1'), current_setting('test.main')),
  '23505', null, 'a task can only be ticked once per period');

select throws_ok(
  format($$insert into public.checklist_checks (organization_id, task_id, location_id, period_start) values (%L, %L, %L, current_date)$$,
         current_setting('test.org'), current_setting('test.task2'), current_setting('test.second')),
  '42501', null, 'staff cannot tick tasks at a location they don''t work at');

select throws_ok(
  format($$insert into public.checklist_checks (organization_id, task_id, location_id, period_start) values (%L, %L, %L, current_date - 10)$$,
         current_setting('test.org'), current_setting('test.task2'), current_setting('test.main')),
  '22023', null, 'old days cannot be ticked after the fact');

select throws_ok(
  format($$insert into public.checklist_checks (organization_id, task_id, location_id, period_start) values (%L, %L, %L, date_trunc('week', current_date)::date)$$,
         current_setting('test.org'), current_setting('test.weekly_task'), current_setting('test.main')),
  '22023', null, 'a checklist for one location cannot be ticked at another');

-- Someone else can't untick the bather's tick
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
delete from public.checklist_checks;
select is((select count(*)::int from public.checklist_checks), 1, 'a groomer cannot untick someone else''s tick');

-- ---------------------------------------------------------------------
-- Editing a checklist retires removed tasks but keeps their history
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  format($$select public.save_checklist(%L, %L, 'Closing sanitation', 'End of day', 'daily', null,
           jsonb_build_array(jsonb_build_object('id', %L, 'label', 'Disinfect all tables'), jsonb_build_object('label', 'Empty bins')))$$,
         current_setting('test.org'), current_setting('test.daily'), current_setting('test.task1')),
  'an owner can rename, add and drop tasks');

select is(
  (select array_agg(label order by position) from public.checklist_tasks where checklist_id = current_setting('test.daily')::uuid and archived_at is null),
  array['Disinfect all tables', 'Empty bins'], 'the checklist now has the new tasks in order');

select is((select count(*)::int from public.checklist_tasks where checklist_id = current_setting('test.daily')::uuid and archived_at is not null), 2,
  'dropped tasks are retired, not deleted');

select throws_ok(
  format($$insert into public.checklist_checks (organization_id, task_id, location_id, period_start) values (%L, %L, %L, current_date)$$,
         current_setting('test.org'), current_setting('test.task2'), current_setting('test.main')),
  'P0002', null, 'a retired task cannot be ticked');

-- ---------------------------------------------------------------------
-- Another business
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
  (select count(*)::int from public.checklists) + (select count(*)::int from public.checklist_checks),
  0, 'another business cannot see Salon A''s checklists or ticks');

reset role;
select * from finish();
rollback;
