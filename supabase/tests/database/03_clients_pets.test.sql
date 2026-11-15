-- Clients and pets (Phase 2 step 1).
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('20000000-0000-0000-0000-000000000001', 'owner@test.invalid',   'authenticated', 'authenticated', now()),
  ('20000000-0000-0000-0000-000000000002', 'groomer@test.invalid', 'authenticated', 'authenticated', now()),
  ('20000000-0000-0000-0000-000000000003', 'bather@test.invalid',  'authenticated', 'authenticated', now()),
  ('20000000-0000-0000-0000-000000000004', 'owner-b@test.invalid', 'authenticated', 'authenticated', now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.org', public.create_organization('Salon A', 'Main Street')::text, true);
  perform set_config('test.loc', (select id::text from public.locations), true);
end $$;

set local request.jwt.claims to '{"sub":"20000000-0000-0000-0000-000000000004","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor')::text, true);
  perform set_config('test.loc_b', (select id::text from public.locations), true);
end $$;

-- Groomer and bather in Salon A, both assigned to Main Street only
reset role;
insert into public.organization_members (organization_id, user_id, role) values
  (current_setting('test.org')::uuid, '20000000-0000-0000-0000-000000000002', 'groomer'),
  (current_setting('test.org')::uuid, '20000000-0000-0000-0000-000000000003', 'bather');
insert into public.member_locations (organization_id, member_id, location_id)
select organization_id, id, current_setting('test.loc')::uuid from public.organization_members
where user_id in ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003');

-- Salon B has one client of its own
insert into public.clients (id, organization_id, first_name, last_name)
values ('2b000000-0000-0000-0000-00000000000b', current_setting('test.org_b')::uuid, 'Bea', 'Other');

set local role authenticated;

-- ---------------------------------------------------------------------
-- Owner A
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  format($$insert into public.clients (organization_id, home_location_id, first_name, last_name, phone, email)
           values (%L, %L, 'Maria', 'Lopez', '(555) 201-3344', 'maria@test.invalid')$$,
         current_setting('test.org'), current_setting('test.loc')),
  'the owner can add a client');

-- API users can't choose ids; pin a known one (as the database owner) for later checks.
reset role;
update public.clients set id = '2a000000-0000-0000-0000-000000000001' where first_name = 'Maria';
set local role authenticated;

select lives_ok(
  format($$insert into public.pets (organization_id, client_id, name, breed, weight_lbs)
           values (%L, '2a000000-0000-0000-0000-000000000001', 'Biscuit', 'Goldendoodle', 48.5),
                  (%L, '2a000000-0000-0000-0000-000000000001', 'Pepper', 'Mini Schnauzer', 17)$$,
         current_setting('test.org'), current_setting('test.org')),
  'a household can have several pets');

reset role;
update public.pets set id = '2a000000-0000-0000-0000-0000000000d1' where name = 'Biscuit';
set local role authenticated;

select throws_ok(
  format($$insert into public.clients (organization_id, home_location_id, first_name) values (%L, %L, 'Wrong Shop')$$,
         current_setting('test.org'), current_setting('test.loc_b')),
  '23503', null, 'a client''s home location must belong to the same business');

select throws_ok(
  format($$insert into public.pets (organization_id, client_id, name) values (%L, '2b000000-0000-0000-0000-00000000000b', 'Stray')$$,
         current_setting('test.org')),
  '23503', null, 'a pet cannot be attached to another business''s client');

select throws_ok(
  format($$insert into public.clients (organization_id, first_name, email) values (%L, 'Bad', 'not-an-email')$$, current_setting('test.org')),
  '23514', null, 'invalid client emails are rejected');

select throws_ok(
  format($$insert into public.pets (organization_id, client_id, name, weight_lbs) values (%L, '2a000000-0000-0000-0000-000000000001', 'Huge', 900)$$,
         current_setting('test.org')),
  '23514', null, 'impossible pet weights are rejected');

select throws_ok(
  format($$update public.clients set organization_id = %L where id = '2a000000-0000-0000-0000-000000000001'$$, current_setting('test.org_b')),
  '42501', null, 'a client cannot be moved to another business');

select throws_ok(
  $$update public.pets set client_id = '2b000000-0000-0000-0000-00000000000b' where id = '2a000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'a pet cannot be moved to another household directly');

select throws_ok(
  $$delete from public.clients where id = '2a000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'clients cannot be deleted');

select throws_ok(
  $$update public.clients set archived_at = now()$$,
  '42501', null, 'archiving only happens through the archive function');

select is((select count(*)::int from public.clients), 1, 'owner A sees only Salon A clients');

select is(
  (select array_agg(c.first_name) from public.search_clients(current_setting('test.org')::uuid, 'pepp') c),
  array['Maria'], 'search finds a household by pet name');

select is(
  (select count(*)::int from public.search_clients(current_setting('test.org')::uuid, '201-33')),
  1, 'search finds a household by phone digits, ignoring formatting');

select is(
  (select count(*)::int from public.search_clients(current_setting('test.org')::uuid, '%')),
  0, 'a % in the search box is treated as a plain character');

select ok(
  (select count(*) from public.audit_events where table_name in ('clients', 'pets')) >= 3,
  'client and pet changes are recorded in the audit log');

-- ---------------------------------------------------------------------
-- Groomer (assigned to Main Street only)
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is((select count(*)::int from public.clients), 1, 'a groomer sees the business''s clients');

select lives_ok(
  format($$insert into public.clients (organization_id, first_name, last_name) values (%L, 'Sam', 'Chen')$$, current_setting('test.org')),
  'a groomer can add a client');

select lives_ok(
  $$update public.pets set grooming_instructions = 'Teddy bear face, #4 body' where id = '2a000000-0000-0000-0000-0000000000d1'$$,
  'a groomer can update grooming instructions');

select throws_ok(
  $$select public.set_client_archived('2a000000-0000-0000-0000-000000000001', true)$$,
  '42501', null, 'a groomer cannot archive clients');

-- ---------------------------------------------------------------------
-- Bather: view only
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select count(*)::int from public.pets), 2, 'a bather can view pets');

select throws_ok(
  format($$insert into public.clients (organization_id, first_name) values (%L, 'Nope')$$, current_setting('test.org')),
  '42501', null, 'a bather cannot add clients');

-- Bather edit attempt: RLS matches zero rows
update public.pets set allergies = 'changed by bather' where id = '2a000000-0000-0000-0000-0000000000d1';

-- ---------------------------------------------------------------------
-- Another business
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"20000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is((select count(*)::int from public.search_clients(current_setting('test.org')::uuid, '')), 0,
  'another business cannot search Salon A clients');

select throws_ok(
  $$select public.set_pet_archived('2a000000-0000-0000-0000-0000000000d1', true)$$,
  'P0002', null, 'another business cannot archive Salon A pets');

-- ---------------------------------------------------------------------
-- Owner archives
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.set_client_archived('2a000000-0000-0000-0000-000000000001', true)$$,
  'the owner can archive a client');

select is((select count(*)::int from public.search_clients(current_setting('test.org')::uuid, 'Maria')), 0,
  'archived clients are hidden from search by default');

select is((select count(*)::int from public.search_clients(current_setting('test.org')::uuid, 'Maria', true)), 1,
  'archived clients can still be found when asked for');

-- ---------------------------------------------------------------------
-- Checks as database owner, then anonymous visitors
-- ---------------------------------------------------------------------
reset role;
select is((select allergies from public.pets where id = '2a000000-0000-0000-0000-0000000000d1'), null,
  'a bather''s edit attempt changed nothing');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select count(*) from public.clients$$, '42501', null, 'anonymous visitors cannot read clients');

reset role;
select * from finish();
rollback;
