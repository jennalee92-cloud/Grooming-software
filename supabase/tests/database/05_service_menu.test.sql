-- Service menu and visit charges (Phase 2 step 3).
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('50000000-0000-0000-0000-000000000001', 'owner@test.invalid',   'authenticated', 'authenticated', now()),
  ('50000000-0000-0000-0000-000000000002', 'manager@test.invalid', 'authenticated', 'authenticated', now()),
  ('50000000-0000-0000-0000-000000000003', 'groomer@test.invalid', 'authenticated', 'authenticated', now()),
  ('50000000-0000-0000-0000-000000000005', 'owner-b@test.invalid', 'authenticated', 'authenticated', now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.org', public.create_organization('Salon A', 'Main Street')::text, true);
end $$;

set local request.jwt.claims to '{"sub":"50000000-0000-0000-0000-000000000005","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor')::text, true);
end $$;

reset role;
do $$ begin
  perform set_config('test.loc_main', (select id::text from public.locations where name = 'Main Street'), true);
  perform set_config('test.loc_b',    (select id::text from public.locations where name = 'Harbor'), true);
end $$;

insert into public.organization_members (organization_id, user_id, role, display_name, all_locations) values
  (current_setting('test.org')::uuid, '50000000-0000-0000-0000-000000000002', 'manager', 'Mia', true),
  (current_setting('test.org')::uuid, '50000000-0000-0000-0000-000000000003', 'groomer', 'Gina', true);

insert into public.clients (id, organization_id, first_name) values
  ('5a000000-0000-0000-0000-000000000001', current_setting('test.org')::uuid,   'Maria'),
  ('5b000000-0000-0000-0000-000000000001', current_setting('test.org_b')::uuid, 'Bea');
insert into public.pets (id, organization_id, client_id, name) values
  ('5a000000-0000-0000-0000-0000000000d1', current_setting('test.org')::uuid,   '5a000000-0000-0000-0000-000000000001', 'Biscuit'),
  ('5b000000-0000-0000-0000-0000000000d1', current_setting('test.org_b')::uuid, '5b000000-0000-0000-0000-000000000001', 'Bolt');

set local role authenticated;

-- ---------------------------------------------------------------------
-- Managing the menu
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"50000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  format($$insert into public.services (organization_id, name, pricing, price_cents) values (%L, 'Nail trim', 'flat', 1500)$$,
         current_setting('test.org')),
  'a manager can add a flat-priced service');

select lives_ok(
  format($$insert into public.services (organization_id, name, pricing, small_price_cents, medium_price_cents, large_price_cents, xlarge_price_cents, duration_minutes)
           values (%L, 'Full groom', 'by_size', 5500, 7000, 8500, 10000, 120)$$,
         current_setting('test.org')),
  'a manager can add a service priced by size');

select throws_ok(
  format($$insert into public.services (organization_id, name, pricing) values (%L, 'Teeth', 'flat')$$, current_setting('test.org')),
  '23514', null, 'a flat-priced service needs a price');

select throws_ok(
  format($$insert into public.services (organization_id, name, pricing, small_price_cents) values (%L, 'Bath', 'by_size', 3000)$$,
         current_setting('test.org')),
  '23514', null, 'a service priced by size needs a price for every size');

select throws_ok(
  format($$insert into public.services (organization_id, name, pricing, price_cents) values (%L, ' nail TRIM ', 'flat', 1000)$$,
         current_setting('test.org')),
  '23505', null, 'two services on the menu cannot share a name');

select throws_ok(
  format($$insert into public.services (organization_id, name, pricing, price_cents) values (%L, 'Bargain', 'flat', -100)$$,
         current_setting('test.org')),
  '23514', null, 'a price cannot be negative');

select throws_ok(
  $$delete from public.services where name = 'Nail trim'$$,
  '42501', null, 'services cannot be deleted');

reset role;
do $$ begin
  perform set_config('test.svc_nails', (select id::text from public.services where name = 'Nail trim'), true);
  perform set_config('test.svc_groom', (select id::text from public.services where name = 'Full groom'), true);
end $$;
set local role authenticated;

-- Groomer: reads but can't change the menu
set local request.jwt.claims to '{"sub":"50000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select count(*)::int from public.services), 2, 'everyone on the team can see the menu');

select throws_ok(
  format($$insert into public.services (organization_id, name, pricing, price_cents) values (%L, 'Teeth', 'flat', 1000)$$,
         current_setting('test.org')),
  '42501', null, 'a groomer cannot add services');

update public.services set price_cents = 1 where name = 'Nail trim';
select is((select price_cents from public.services where name = 'Nail trim'), 1500, 'a groomer cannot change prices');

-- ---------------------------------------------------------------------
-- Recording a visit with services
-- ---------------------------------------------------------------------
select lives_ok(
  format($$select public.record_visit(
             p_organization_id => %L, p_location_id => %L, p_pet_id => '5a000000-0000-0000-0000-0000000000d1',
             p_visited_on => current_date, p_pet_size => 'medium', p_notes => 'first visit',
             p_lines => jsonb_build_array(
               jsonb_build_object('service_id', %L),
               jsonb_build_object('service_id', %L, 'price_cents', 1000),
               jsonb_build_object('name', 'Matting fee', 'price_cents', 2000)))$$,
         current_setting('test.org'), current_setting('test.loc_main'),
         current_setting('test.svc_groom'), current_setting('test.svc_nails')),
  'a groomer can record a visit with menu services and an extra charge');

select is(
  (select array_agg(name || ':' || coalesce(list_price_cents::text, '-') || ':' || price_cents order by position)
   from public.visit_services),
  array['Full groom:7000:7000', 'Nail trim:1500:1000', 'Matting fee:-:2000'],
  'lines keep the menu name, the menu price for the size, and the price charged');

select throws_ok(
  format($$select public.record_visit(
             p_organization_id => %L, p_location_id => %L, p_pet_id => '5a000000-0000-0000-0000-0000000000d1',
             p_visited_on => current_date, p_notes => 'no size',
             p_lines => jsonb_build_array(jsonb_build_object('service_id', %L)))$$,
         current_setting('test.org'), current_setting('test.loc_main'), current_setting('test.svc_groom')),
  '22023', null, 'a size-priced service needs the pet''s size or a price');

select is((select count(*)::int from public.grooming_visits where notes = 'no size'), 0,
  'a visit whose services fail is not saved at all');

select throws_ok(
  format($$select public.record_visit(
             p_organization_id => %L, p_location_id => %L, p_pet_id => '5a000000-0000-0000-0000-0000000000d1',
             p_visited_on => current_date, p_lines => jsonb_build_array(jsonb_build_object('name', 'Mystery')))$$,
         current_setting('test.org'), current_setting('test.loc_main')),
  '22023', null, 'an extra charge needs a price');

-- Menu changes don't touch past visits
set local request.jwt.claims to '{"sub":"50000000-0000-0000-0000-000000000002","role":"authenticated"}';
update public.services set name = 'Pedicure', price_cents = 2500 where id = current_setting('test.svc_nails')::uuid;

select is((select price_cents from public.visit_services where service_id = current_setting('test.svc_nails')::uuid), 1000,
  'changing the menu does not change what past visits were charged');
select is((select name from public.visit_services where service_id = current_setting('test.svc_nails')::uuid), 'Nail trim',
  'past visits keep the service name they had');

select lives_ok(
  $$update public.services set retired_at = now() where name = 'Pedicure'$$,
  'a manager can retire a service');

-- ---------------------------------------------------------------------
-- Lines can't be added later or changed
-- ---------------------------------------------------------------------
reset role;
update public.grooming_visits set created_at = now() - interval '1 hour' where notes = 'first visit';
set local role authenticated;
set local request.jwt.claims to '{"sub":"50000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$insert into public.visit_services (organization_id, visit_id, name, price_cents)
    select organization_id, id, 'Sneaky add-on', 500 from public.grooming_visits where notes = 'first visit'$$,
  '42501', null, 'charges cannot be added to a visit after it was recorded');

select throws_ok(
  $$update public.visit_services set price_cents = 0$$,
  '42501', null, 'charges cannot be edited');

select throws_ok(
  $$delete from public.visit_services$$,
  '42501', null, 'charges cannot be deleted');

-- A correction brings its own lines
select lives_ok(
  format($$select public.record_visit(
             p_organization_id => %L, p_location_id => %L, p_pet_id => '5a000000-0000-0000-0000-0000000000d1',
             p_visited_on => current_date, p_pet_size => 'large', p_notes => 'first visit, corrected',
             p_corrects_visit_id => (select id from public.grooming_visits where notes = 'first visit'),
             p_correction_reason => 'Biscuit is a large',
             p_lines => jsonb_build_array(jsonb_build_object('service_id', %L)))$$,
         current_setting('test.org'), current_setting('test.loc_main'), current_setting('test.svc_groom')),
  'a correction can carry its own services');

select is(
  (select price_cents from public.visit_services s join public.grooming_visits v on v.id = s.visit_id
   where v.notes = 'first visit, corrected'),
  8500, 'the corrected visit is charged the large price');

-- ---------------------------------------------------------------------
-- Another business
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"50000000-0000-0000-0000-000000000005","role":"authenticated"}';

select is((select count(*)::int from public.services) + (select count(*)::int from public.visit_services), 0,
  'another business cannot see Salon A''s menu or charges');

select throws_ok(
  format($$select public.record_visit(
             p_organization_id => %L, p_location_id => %L, p_pet_id => '5b000000-0000-0000-0000-0000000000d1',
             p_visited_on => current_date, p_lines => jsonb_build_array(jsonb_build_object('service_id', %L)))$$,
         current_setting('test.org_b'), current_setting('test.loc_b'), current_setting('test.svc_groom')),
  'P0002', null, 'another business cannot charge for Salon A''s services');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select count(*) from public.services$$, '42501', null, 'anonymous visitors cannot read the menu');

reset role;
select * from finish();
rollback;
