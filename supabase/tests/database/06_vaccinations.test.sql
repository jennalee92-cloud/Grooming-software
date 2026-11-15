-- Vaccination records (Phase 2 step 4).
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('60000000-0000-0000-0000-000000000001', 'owner@test.invalid',   'authenticated', 'authenticated', now()),
  ('60000000-0000-0000-0000-000000000002', 'desk@test.invalid',    'authenticated', 'authenticated', now()),
  ('60000000-0000-0000-0000-000000000003', 'bather@test.invalid',  'authenticated', 'authenticated', now()),
  ('60000000-0000-0000-0000-000000000005', 'owner-b@test.invalid', 'authenticated', 'authenticated', now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.org', public.create_organization('Salon A', 'Main Street')::text, true);
end $$;
set local request.jwt.claims to '{"sub":"60000000-0000-0000-0000-000000000005","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor')::text, true);
end $$;

reset role;
insert into public.organization_members (organization_id, user_id, role, display_name, all_locations) values
  (current_setting('test.org')::uuid, '60000000-0000-0000-0000-000000000002', 'front_desk', 'Dee', true),
  (current_setting('test.org')::uuid, '60000000-0000-0000-0000-000000000003', 'bather',     'Ben', true);

insert into public.clients (id, organization_id, first_name) values
  ('6a000000-0000-0000-0000-000000000001', current_setting('test.org')::uuid,   'Maria'),
  ('6b000000-0000-0000-0000-000000000001', current_setting('test.org_b')::uuid, 'Bea');
insert into public.pets (id, organization_id, client_id, name) values
  ('6a000000-0000-0000-0000-0000000000d1', current_setting('test.org')::uuid,   '6a000000-0000-0000-0000-000000000001', 'Biscuit'),
  ('6a000000-0000-0000-0000-0000000000d2', current_setting('test.org')::uuid,   '6a000000-0000-0000-0000-000000000001', 'Pepper'),
  ('6b000000-0000-0000-0000-0000000000d1', current_setting('test.org_b')::uuid, '6b000000-0000-0000-0000-000000000001', 'Bolt');

set local role authenticated;

-- ---------------------------------------------------------------------
-- Front desk adds records
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"60000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  format($$insert into public.pet_vaccinations (organization_id, pet_id, vaccine, given_on, expires_on, verified)
           values (%L, '6a000000-0000-0000-0000-0000000000d1', 'Rabies', current_date - 1000, current_date - 5, true)$$,
         current_setting('test.org')),
  'front desk can add a vaccination record');

select lives_ok(
  format($$insert into public.pet_vaccinations (organization_id, pet_id, vaccine, given_on, expires_on)
           values (%L, '6a000000-0000-0000-0000-0000000000d1', 'Bordetella', current_date - 300, current_date + 10),
                  (%L, '6a000000-0000-0000-0000-0000000000d2', 'Rabies', current_date - 30, current_date + 1000)$$,
         current_setting('test.org'), current_setting('test.org')),
  'records can be added for several pets');

select is((select created_by::text from public.pet_vaccinations where vaccine = 'Bordetella'),
  '60000000-0000-0000-0000-000000000002', 'a record notes who added it');

select throws_ok(
  format($$insert into public.pet_vaccinations (organization_id, pet_id, vaccine, given_on, expires_on)
           values (%L, '6a000000-0000-0000-0000-0000000000d1', 'Rabies', current_date + 20, current_date + 400)$$,
         current_setting('test.org')),
  '22023', null, 'the date given cannot be in the future');

select throws_ok(
  format($$insert into public.pet_vaccinations (organization_id, pet_id, vaccine, given_on, expires_on)
           values (%L, '6a000000-0000-0000-0000-0000000000d1', 'Rabies', current_date - 10, current_date - 20)$$,
         current_setting('test.org')),
  '23514', null, 'a vaccine cannot expire before it was given');

select throws_ok(
  format($$insert into public.pet_vaccinations (organization_id, pet_id, vaccine, expires_on)
           values (%L, '6b000000-0000-0000-0000-0000000000d1', 'Rabies', current_date + 100)$$,
         current_setting('test.org')),
  '23503', null, 'a record cannot be attached to another business''s pet');

select throws_ok(
  $$delete from public.pet_vaccinations where vaccine = 'Bordetella'$$,
  '42501', null, 'vaccination records cannot be deleted');

-- ---------------------------------------------------------------------
-- What's due
-- ---------------------------------------------------------------------
select is(
  (select array_agg(pet_name || ':' || vaccine order by expires_on) from public.vaccines_due(current_setting('test.org')::uuid, 30)),
  array['Biscuit:Rabies', 'Biscuit:Bordetella'],
  'vaccines_due lists expired and soon-expiring vaccines, soonest first');

-- A renewal: the newer record replaces the expired one in the due list
select lives_ok(
  format($$insert into public.pet_vaccinations (organization_id, pet_id, vaccine, given_on, expires_on)
           values (%L, '6a000000-0000-0000-0000-0000000000d1', 'rabies ', current_date, current_date + 1095)$$,
         current_setting('test.org')),
  'a renewal is added as a new record');

select is(
  (select array_agg(vaccine) from public.vaccines_due(current_setting('test.org')::uuid, 30)),
  array['Bordetella'],
  'a renewed vaccine is no longer listed as due');

select is((select count(*)::int from public.pet_vaccinations where pet_id = '6a000000-0000-0000-0000-0000000000d1'), 3,
  'the expired record stays in the history');

-- Fixing a mistake
select lives_ok(
  $$update public.pet_vaccinations set removed_at = now() where vaccine = 'Bordetella'$$,
  'a mistaken record can be marked removed');

select is((select count(*)::int from public.vaccines_due(current_setting('test.org')::uuid, 30)), 0,
  'removed records are not listed as due');

-- ---------------------------------------------------------------------
-- Bather, another business, anonymous
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"60000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  format($$insert into public.pet_vaccinations (organization_id, pet_id, vaccine, expires_on)
           values (%L, '6a000000-0000-0000-0000-0000000000d1', 'Lepto', current_date + 100)$$,
         current_setting('test.org')),
  '42501', null, 'a bather can view but not add vaccination records');

set local request.jwt.claims to '{"sub":"60000000-0000-0000-0000-000000000005","role":"authenticated"}';

select is(
  (select count(*)::int from public.pet_vaccinations)
    + (select count(*)::int from public.vaccines_due(current_setting('test.org')::uuid, 365)),
  0, 'another business cannot see Salon A''s vaccination records');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select count(*) from public.pet_vaccinations$$, '42501', null, 'anonymous visitors cannot read vaccinations');

reset role;
select * from finish();
rollback;
