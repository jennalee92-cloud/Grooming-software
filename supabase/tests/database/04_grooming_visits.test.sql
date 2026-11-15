-- Grooming visit history (Phase 2 step 2).
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('30000000-0000-0000-0000-000000000001', 'owner@test.invalid',    'authenticated', 'authenticated', now()),
  ('30000000-0000-0000-0000-000000000002', 'groomer@test.invalid',  'authenticated', 'authenticated', now()),
  ('30000000-0000-0000-0000-000000000003', 'bather@test.invalid',   'authenticated', 'authenticated', now()),
  ('30000000-0000-0000-0000-000000000004', 'groomer2@test.invalid', 'authenticated', 'authenticated', now()),
  ('30000000-0000-0000-0000-000000000005', 'owner-b@test.invalid',  'authenticated', 'authenticated', now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.org', public.create_organization('Salon A', 'Main Street')::text, true);
end $$;
insert into public.locations (organization_id, name) values (current_setting('test.org')::uuid, 'Second Street');

set local request.jwt.claims to '{"sub":"30000000-0000-0000-0000-000000000005","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor')::text, true);
end $$;

reset role;
do $$ begin
  perform set_config('test.loc_main',   (select id::text from public.locations where name = 'Main Street'), true);
  perform set_config('test.loc_second', (select id::text from public.locations where name = 'Second Street'), true);
  perform set_config('test.loc_b',      (select id::text from public.locations where name = 'Harbor'), true);
end $$;

-- Staff: groomer and bather at Main Street; a second groomer at Second Street
insert into public.organization_members (organization_id, user_id, role, display_name) values
  (current_setting('test.org')::uuid, '30000000-0000-0000-0000-000000000002', 'groomer', 'Gina'),
  (current_setting('test.org')::uuid, '30000000-0000-0000-0000-000000000003', 'bather',  'Ben'),
  (current_setting('test.org')::uuid, '30000000-0000-0000-0000-000000000004', 'groomer', 'Gus');
insert into public.member_locations (organization_id, member_id, location_id)
select organization_id, id,
       case when user_id = '30000000-0000-0000-0000-000000000004' then current_setting('test.loc_second')::uuid
            else current_setting('test.loc_main')::uuid end
from public.organization_members
where user_id in ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004');

do $$ begin
  perform set_config('test.m_gina', (select id::text from public.organization_members where display_name = 'Gina'), true);
end $$;

-- A household with two pets in each salon
insert into public.clients (id, organization_id, first_name) values
  ('3a000000-0000-0000-0000-000000000001', current_setting('test.org')::uuid,   'Maria'),
  ('3b000000-0000-0000-0000-000000000001', current_setting('test.org_b')::uuid, 'Bea');
insert into public.pets (id, organization_id, client_id, name) values
  ('3a000000-0000-0000-0000-0000000000d1', current_setting('test.org')::uuid,   '3a000000-0000-0000-0000-000000000001', 'Biscuit'),
  ('3a000000-0000-0000-0000-0000000000d2', current_setting('test.org')::uuid,   '3a000000-0000-0000-0000-000000000001', 'Pepper'),
  ('3b000000-0000-0000-0000-0000000000d1', current_setting('test.org_b')::uuid, '3b000000-0000-0000-0000-000000000001', 'Bolt');

set local role authenticated;

-- ---------------------------------------------------------------------
-- Groomer records a visit
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, groomer_member_id, services, behavior, notes)
           values (%L, %L, '3a000000-0000-0000-0000-0000000000d1', current_date, %L, 'Full groom', 'good', 'Matting behind ears')$$,
         current_setting('test.org'), current_setting('test.loc_main'), current_setting('test.m_gina')),
  'a groomer can record a visit at their location');

-- Pin a known id (API users can't choose ids)
reset role;
update public.grooming_visits set id = '3a000000-0000-0000-0000-00000000aa01' where notes = 'Matting behind ears';
set local role authenticated;

select is((select created_by::text from public.grooming_visits where id = '3a000000-0000-0000-0000-00000000aa01'),
  '30000000-0000-0000-0000-000000000002', 'a visit records who entered it');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, created_by)
           values (%L, %L, '3a000000-0000-0000-0000-0000000000d1', current_date, '30000000-0000-0000-0000-000000000001')$$,
         current_setting('test.org'), current_setting('test.loc_main')),
  '42501', null, 'nobody can record a visit as someone else');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on)
           values (%L, %L, '3a000000-0000-0000-0000-0000000000d1', current_date)$$,
         current_setting('test.org'), current_setting('test.loc_second')),
  '42501', null, 'a groomer cannot record a visit at a location they don''t work at');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on)
           values (%L, %L, '3b000000-0000-0000-0000-0000000000d1', current_date)$$,
         current_setting('test.org'), current_setting('test.loc_main')),
  '23503', null, 'a visit cannot be recorded for another business''s pet');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on)
           values (%L, %L, '3a000000-0000-0000-0000-0000000000d1', current_date + 30)$$,
         current_setting('test.org'), current_setting('test.loc_main')),
  '22023', null, 'a visit date cannot be in the future');

select throws_ok(
  $$update public.grooming_visits set notes = 'rewritten' where id = '3a000000-0000-0000-0000-00000000aa01'$$,
  '42501', null, 'a visit cannot be edited in place');

select throws_ok(
  $$delete from public.grooming_visits where id = '3a000000-0000-0000-0000-00000000aa01'$$,
  '42501', null, 'a visit cannot be deleted');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, corrects_visit_id)
           values (%L, %L, '3a000000-0000-0000-0000-0000000000d1', current_date, '3a000000-0000-0000-0000-00000000aa01')$$,
         current_setting('test.org'), current_setting('test.loc_main')),
  '23514', null, 'a correction must give a reason');

select lives_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, groomer_member_id, services, behavior, notes,
                                              corrects_visit_id, correction_reason)
           values (%L, %L, '3a000000-0000-0000-0000-0000000000d1', current_date, %L, 'Full groom', 'good', 'Matting behind both ears',
                   '3a000000-0000-0000-0000-00000000aa01', 'Added the other ear')$$,
         current_setting('test.org'), current_setting('test.loc_main'), current_setting('test.m_gina')),
  'the groomer can correct their own visit');

select is((select notes from public.grooming_visits where id = '3a000000-0000-0000-0000-00000000aa01'),
  'Matting behind ears', 'the original visit is kept unchanged after a correction');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, corrects_visit_id, correction_reason)
           values (%L, %L, '3a000000-0000-0000-0000-0000000000d1', current_date, '3a000000-0000-0000-0000-00000000aa01', 'Second fork')$$,
         current_setting('test.org'), current_setting('test.loc_main')),
  '23505', null, 'a version can only be corrected once, so history never forks');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, corrects_visit_id, correction_reason)
           select %L, %L, '3a000000-0000-0000-0000-0000000000d2', current_date, id, 'Wrong pet'
           from public.grooming_visits where corrects_visit_id = '3a000000-0000-0000-0000-00000000aa01'$$,
         current_setting('test.org'), current_setting('test.loc_main')),
  '22023', null, 'a correction cannot move a visit to a different pet');

-- ---------------------------------------------------------------------
-- Bather and a second groomer
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}';

select lives_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, services)
           values (%L, %L, '3a000000-0000-0000-0000-0000000000d2', current_date, 'Bath and nails')$$,
         current_setting('test.org'), current_setting('test.loc_main')),
  'a bather can record a visit');

select is((select count(*)::int from public.grooming_visits), 3, 'a bather can read the visit history');

set local request.jwt.claims to '{"sub":"30000000-0000-0000-0000-000000000004","role":"authenticated"}';

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, corrects_visit_id, correction_reason)
           select %L, %L, pet_id, current_date, id, 'Not mine to fix'
           from public.grooming_visits where corrects_visit_id = '3a000000-0000-0000-0000-00000000aa01'$$,
         current_setting('test.org'), current_setting('test.loc_second')),
  '42501', null, 'another groomer cannot correct someone else''s visit');

-- ---------------------------------------------------------------------
-- Owner removes a visit with a correction
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, corrects_visit_id, correction_reason, voided)
           select %L, location_id, pet_id, visited_on, id, 'Entered on the wrong day', true
           from public.grooming_visits where services = 'Bath and nails'$$,
         current_setting('test.org')),
  'an owner can remove any visit with a reason');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, corrects_visit_id, correction_reason)
           select %L, location_id, pet_id, visited_on, id, 'Bring it back'
           from public.grooming_visits where voided$$,
         current_setting('test.org')),
  'P0001', null, 'a removed visit cannot be corrected again');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, voided)
           values (%L, %L, '3a000000-0000-0000-0000-0000000000d1', current_date, true)$$,
         current_setting('test.org'), current_setting('test.loc_main')),
  '23514', null, 'a visit can only be removed by a correction');

select is((select count(*)::int from public.grooming_visits), 4, 'all versions stay in the history');

select ok((select count(*) from public.audit_events where table_name = 'grooming_visits') >= 4,
  'visits and corrections are recorded in the audit log');

-- ---------------------------------------------------------------------
-- Another business, and visitors who aren't logged in
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"30000000-0000-0000-0000-000000000005","role":"authenticated"}';

select is((select count(*)::int from public.grooming_visits), 0, 'another business cannot see Salon A visits');

select throws_ok(
  format($$insert into public.grooming_visits (organization_id, location_id, pet_id, visited_on, corrects_visit_id, correction_reason)
           values (%L, %L, '3b000000-0000-0000-0000-0000000000d1', current_date, '3a000000-0000-0000-0000-00000000aa01', 'Hijack')$$,
         current_setting('test.org_b'), current_setting('test.loc_b')),
  'P0002', null, 'another business cannot correct Salon A visits');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select count(*) from public.grooming_visits$$, '42501', null, 'anonymous visitors cannot read visits');

reset role;
select * from finish();
rollback;
