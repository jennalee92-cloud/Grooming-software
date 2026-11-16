-- Breed prices on the service menu.
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('80000000-0000-0000-0000-000000000001', 'owner@test.invalid',   'authenticated', 'authenticated', now()),
  ('80000000-0000-0000-0000-000000000003', 'groomer@test.invalid', 'authenticated', 'authenticated', now()),
  ('80000000-0000-0000-0000-000000000005', 'owner-b@test.invalid', 'authenticated', 'authenticated', now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.org', public.create_organization('Salon A', 'Main Street')::text, true);
end $$;
set local request.jwt.claims to '{"sub":"80000000-0000-0000-0000-000000000005","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor')::text, true);
end $$;

reset role;
insert into public.organization_members (organization_id, user_id, role, display_name, all_locations) values
  (current_setting('test.org')::uuid, '80000000-0000-0000-0000-000000000003', 'groomer', 'Gina', true);
do $$ begin
  perform set_config('test.loc', (select id::text from public.locations where name = 'Main Street'), true);
end $$;
insert into public.clients (id, organization_id, first_name) values
  ('8a000000-0000-0000-0000-000000000001', current_setting('test.org')::uuid, 'Maria');
insert into public.pets (id, organization_id, client_id, name, breed) values
  ('8a000000-0000-0000-0000-0000000000d1', current_setting('test.org')::uuid, '8a000000-0000-0000-0000-000000000001', 'Biscuit', 'goldendoodle (standard) '),
  ('8a000000-0000-0000-0000-0000000000d2', current_setting('test.org')::uuid, '8a000000-0000-0000-0000-000000000001', 'Pepper',  'Beagle');
insert into public.services (id, organization_id, name, pricing, small_price_cents, medium_price_cents, large_price_cents, xlarge_price_cents)
values ('8a000000-0000-0000-0000-0000000000e1', current_setting('test.org')::uuid, 'Full groom', 'by_size', 5000, 7000, 9000, 11000)
on conflict do nothing;
set local role authenticated;

-- ---------------------------------------------------------------------
-- Owner sets breed prices
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.set_service_breed_prices('8a000000-0000-0000-0000-0000000000e1',
      '[{"breed":"Goldendoodle (Standard)","price_cents":14000},{"breed":"Shih Tzu","price_cents":7500}]'::jsonb)$$,
  'the owner can set breed prices on a service');

select is((select count(*)::int from public.service_breed_prices), 2, 'both breed prices are saved');

select throws_ok(
  $$select public.set_service_breed_prices('8a000000-0000-0000-0000-0000000000e1',
      '[{"breed":"Pug","price_cents":5000},{"breed":" pug","price_cents":6000}]'::jsonb)$$,
  '23505', null, 'the same breed cannot be priced twice on one service');

select is((select count(*)::int from public.service_breed_prices), 2, 'a rejected change leaves the old prices in place');

select lives_ok(
  $$select public.set_service_breed_prices('8a000000-0000-0000-0000-0000000000e1',
      '[{"breed":"Goldendoodle (Standard)","price_cents":14500}]'::jsonb)$$,
  'breed prices can be replaced');

-- ---------------------------------------------------------------------
-- Visits use the breed price first
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"80000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$select public.set_service_breed_prices('8a000000-0000-0000-0000-0000000000e1', '[{"breed":"Pug","price_cents":1}]'::jsonb)$$,
  '42501', null, 'a groomer cannot change breed prices');

select lives_ok(
  format($$select public.record_visit(p_organization_id => %L, p_location_id => %L, p_pet_id => '8a000000-0000-0000-0000-0000000000d1',
             p_visited_on => current_date, p_pet_size => 'medium', p_notes => 'doodle',
             p_lines => jsonb_build_array(jsonb_build_object('service_id', '8a000000-0000-0000-0000-0000000000e1')))$$,
         current_setting('test.org'), current_setting('test.loc')),
  'a visit can be recorded for a pet with a breed price');

select is(
  (select s.list_price_cents from public.visit_services s join public.grooming_visits v on v.id = s.visit_id where v.notes = 'doodle'),
  14500, 'the breed price wins over the size price (breed names match regardless of spacing or capitals)');

select lives_ok(
  format($$select public.record_visit(p_organization_id => %L, p_location_id => %L, p_pet_id => '8a000000-0000-0000-0000-0000000000d2',
             p_visited_on => current_date, p_pet_size => 'medium', p_notes => 'beagle',
             p_lines => jsonb_build_array(jsonb_build_object('service_id', '8a000000-0000-0000-0000-0000000000e1')))$$,
         current_setting('test.org'), current_setting('test.loc')),
  'a visit for a breed without a breed price records');

-- ---------------------------------------------------------------------
-- Another business
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"80000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is((select count(*)::int from public.service_breed_prices), 0, 'another business cannot see Salon A''s breed prices');

reset role;
select * from finish();
rollback;
