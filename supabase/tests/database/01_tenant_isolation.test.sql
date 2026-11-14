-- Tenant isolation and role tests for the Phase 1 foundation.
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- ---------------------------------------------------------------------
-- Fixtures (created as the database owner)
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner-a@test.invalid',   'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'owner-b@test.invalid',   'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'groomer-a@test.invalid', 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'outsider@test.invalid',  'authenticated', 'authenticated');

-- Owner A creates Salon A
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_a', public.create_organization('Salon A', 'Main Street', 'America/New_York', 'Owner A')::text, true);
end $$;

-- Owner B creates Salon B
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor', 'America/Chicago')::text, true);
end $$;

reset role;

do $$ begin
  perform set_config('test.loc_a_main', (select id::text from public.locations where organization_id = current_setting('test.org_a')::uuid), true);
  perform set_config('test.loc_b',      (select id::text from public.locations where organization_id = current_setting('test.org_b')::uuid), true);
end $$;

-- Second location in Salon A, plus a groomer assigned only to Main Street
insert into public.locations (organization_id, name)
values (current_setting('test.org_a')::uuid, 'Second Street');

insert into public.organization_members (organization_id, user_id, role)
values (current_setting('test.org_a')::uuid, 'c0000000-0000-0000-0000-00000000000c', 'groomer');

insert into public.member_locations (organization_id, member_id, location_id)
select m.organization_id, m.id, current_setting('test.loc_a_main')::uuid
from public.organization_members m
where m.user_id = 'c0000000-0000-0000-0000-00000000000c';

-- ---------------------------------------------------------------------
-- create_organization
-- ---------------------------------------------------------------------
select is(
  (select role::text from public.organization_members
   where organization_id = current_setting('test.org_a')::uuid
     and user_id = 'a0000000-0000-0000-0000-00000000000a'),
  'owner', 'create_organization makes the caller the owner');

select is(
  (select count(*)::int from public.audit_events where organization_id = current_setting('test.org_a')::uuid and table_name = 'organizations'),
  1, 'creating an organization is recorded in the audit log');

-- ---------------------------------------------------------------------
-- Owner A
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.organizations), 1, 'owner A sees exactly one organization');
select is((select count(*)::int from public.organizations where id = current_setting('test.org_b')::uuid), 0, 'owner A cannot see Salon B');
select is((select count(*)::int from public.locations), 2, 'owner A sees both Salon A locations');
select is((select count(*)::int from public.locations where organization_id = current_setting('test.org_b')::uuid), 0, 'owner A cannot see Salon B locations');
select is((select count(*)::int from public.organization_members where organization_id = current_setting('test.org_b')::uuid), 0, 'owner A cannot see Salon B members');
select ok((select count(*) from public.audit_events) > 0, 'owner A can read Salon A audit log');
select is((select count(*)::int from public.audit_events where organization_id = current_setting('test.org_b')::uuid), 0, 'owner A cannot read Salon B audit log');

select lives_ok(
  format($$insert into public.locations (organization_id, name) values (%L, 'Third Street')$$, current_setting('test.org_a')),
  'owner A can add a location to Salon A');

select throws_ok(
  format($$insert into public.locations (organization_id, name) values (%L, 'Sneaky')$$, current_setting('test.org_b')),
  '42501', null, 'owner A cannot add a location to Salon B');

select throws_ok(
  format($$insert into public.organization_members (organization_id, user_id, role) values (%L, 'a0000000-0000-0000-0000-00000000000a', 'owner')$$, current_setting('test.org_b')),
  '42501', null, 'owner A cannot add themselves to Salon B');

select throws_ok(
  $$insert into public.audit_events (organization_id, action, table_name) values (gen_random_uuid(), 'x', 'y')$$,
  '42501', null, 'audit log cannot be written directly');

select throws_ok(
  $$delete from public.audit_events$$,
  '42501', null, 'audit log cannot be deleted');

select throws_ok(
  $$truncate public.organizations cascade$$,
  '42501', null, 'API users cannot truncate tables');

-- Attempt to rename Salon B: RLS silently matches zero rows
update public.organizations set name = 'Hacked' where id = current_setting('test.org_b')::uuid;

select throws_ok(
  $$select public.create_organization('   ', 'Main')$$,
  '22023', 'Business name is required.', 'blank business names are rejected');

select throws_ok(
  $$select public.create_organization('Salon C', 'Main', 'Mars/Olympus')$$,
  '22023', null, 'unknown time zones are rejected');

-- ---------------------------------------------------------------------
-- Groomer in Salon A (assigned to Main Street only)
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select is((select count(*)::int from public.organizations), 1, 'groomer sees Salon A');
select is((select array_agg(name order by name) from public.locations), array['Main Street'], 'groomer sees only their assigned location');
select is((select count(*)::int from public.audit_events), 0, 'groomer cannot read the audit log');

select throws_ok(
  format($$insert into public.locations (organization_id, name) values (%L, 'Groomer Spot')$$, current_setting('test.org_a')),
  '42501', null, 'groomer cannot add locations');

-- Attempt to rename Salon A as a groomer: zero rows
update public.organizations set name = 'Groomer Salon' where id = current_setting('test.org_a')::uuid;

-- ---------------------------------------------------------------------
-- Outsider with no membership, and anonymous visitors
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select is((select count(*)::int from public.organizations) + (select count(*)::int from public.locations) + (select count(*)::int from public.organization_members),
  0, 'a signed-in outsider sees no organizations, locations, or members');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select count(*) from public.organizations$$, '42501', null, 'anonymous visitors cannot read organizations');
select throws_ok($$select public.create_organization('Anon Salon', 'Main')$$, '42501', null, 'anonymous visitors cannot create a business');

-- ---------------------------------------------------------------------
-- Checks as database owner
-- ---------------------------------------------------------------------
reset role;

select is(
  (select name from public.organizations where id = current_setting('test.org_b')::uuid),
  'Salon B', 'Salon B name was not changed by owner A');

select is(
  (select name from public.organizations where id = current_setting('test.org_a')::uuid),
  'Salon A', 'Salon A name was not changed by the groomer');

select throws_ok(
  format($$insert into public.member_locations (organization_id, member_id, location_id)
           select organization_id, id, %L from public.organization_members
           where user_id = 'c0000000-0000-0000-0000-00000000000c'$$, current_setting('test.loc_b')),
  '23503', null, 'a member cannot be assigned to another business''s location');

-- Deactivated members lose access immediately
update public.organization_members set status = 'deactivated', deactivated_at = now()
where user_id = 'c0000000-0000-0000-0000-00000000000c';

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select is((select count(*)::int from public.organizations) + (select count(*)::int from public.locations),
  0, 'a deactivated groomer loses access to Salon A');

reset role;
select * from finish();
rollback;
