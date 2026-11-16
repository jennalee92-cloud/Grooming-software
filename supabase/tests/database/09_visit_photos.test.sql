-- Before and after photos on visits.
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('90000000-0000-0000-0000-000000000001', 'owner@test.invalid',   'authenticated', 'authenticated', now()),
  ('90000000-0000-0000-0000-000000000002', 'bather@test.invalid',  'authenticated', 'authenticated', now()),
  ('90000000-0000-0000-0000-000000000003', 'groomer@test.invalid', 'authenticated', 'authenticated', now()),
  ('90000000-0000-0000-0000-000000000005', 'owner-b@test.invalid', 'authenticated', 'authenticated', now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.org', public.create_organization('Salon A', 'Main Street')::text, true);
end $$;
set local request.jwt.claims to '{"sub":"90000000-0000-0000-0000-000000000005","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor')::text, true);
end $$;

reset role;
insert into public.organization_members (organization_id, user_id, role, display_name, all_locations) values
  (current_setting('test.org')::uuid, '90000000-0000-0000-0000-000000000002', 'bather',  'Ben',  true),
  (current_setting('test.org')::uuid, '90000000-0000-0000-0000-000000000003', 'groomer', 'Gina', true);
insert into public.clients (id, organization_id, first_name) values
  ('9a000000-0000-0000-0000-000000000001', current_setting('test.org')::uuid,   'Maria'),
  ('9b000000-0000-0000-0000-000000000001', current_setting('test.org_b')::uuid, 'Bea');
insert into public.pets (id, organization_id, client_id, name) values
  ('9a000000-0000-0000-0000-0000000000d1', current_setting('test.org')::uuid,   '9a000000-0000-0000-0000-000000000001', 'Biscuit'),
  ('9a000000-0000-0000-0000-0000000000d2', current_setting('test.org')::uuid,   '9a000000-0000-0000-0000-000000000001', 'Pepper'),
  ('9b000000-0000-0000-0000-0000000000d1', current_setting('test.org_b')::uuid, '9b000000-0000-0000-0000-000000000001', 'Bolt');
insert into public.grooming_visits (id, organization_id, location_id, pet_id, visited_on, created_by)
select '9a000000-0000-0000-0000-0000000000a1', current_setting('test.org')::uuid, l.id, '9a000000-0000-0000-0000-0000000000d1',
       current_date, '90000000-0000-0000-0000-000000000003'
from public.locations l where l.name = 'Main Street';

do $$ begin
  perform set_config('test.path', current_setting('test.org') || '/9a000000-0000-0000-0000-0000000000d1/before.jpg', true);
end $$;
set local role authenticated;

-- ---------------------------------------------------------------------
-- A bather adds a before photo
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"90000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('visit-photos', %L)$$, current_setting('test.path')),
  'a bather can upload a visit photo for their business''s pet');

select lives_ok(
  format($$insert into public.visit_photos (organization_id, pet_id, visit_id, kind, storage_path, content_type, size_bytes)
           values (%L, '9a000000-0000-0000-0000-0000000000d1', '9a000000-0000-0000-0000-0000000000a1', 'before', %L, 'image/jpeg', 250000)$$,
         current_setting('test.org'), current_setting('test.path')),
  'the uploaded photo can be added to the visit');

select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('visit-photos', %L)$$,
         current_setting('test.org_b') || '/9b000000-0000-0000-0000-0000000000d1/x.jpg'),
  '42501', null, 'nobody can upload into another business''s folder');

select throws_ok(
  format($$insert into public.visit_photos (organization_id, pet_id, visit_id, kind, storage_path, content_type, size_bytes)
           values (%L, '9a000000-0000-0000-0000-0000000000d1', '9a000000-0000-0000-0000-0000000000a1', 'after', %L, 'image/jpeg', 100)$$,
         current_setting('test.org'), current_setting('test.org') || '/9a000000-0000-0000-0000-0000000000d1/ghost.jpg'),
  '42501', null, 'a photo that was never uploaded cannot be added');

select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('visit-photos', %L)$$,
         current_setting('test.org') || '/9a000000-0000-0000-0000-0000000000d2/pepper.jpg'),
  'a photo for another pet in the same business uploads');
select throws_ok(
  format($$insert into public.visit_photos (organization_id, pet_id, visit_id, kind, storage_path, content_type, size_bytes)
           values (%L, '9a000000-0000-0000-0000-0000000000d2', '9a000000-0000-0000-0000-0000000000a1', 'after', %L, 'image/jpeg', 100)$$,
         current_setting('test.org'), current_setting('test.org') || '/9a000000-0000-0000-0000-0000000000d2/pepper.jpg'),
  '22023', null, 'a photo cannot be attached to another pet''s visit');

-- ---------------------------------------------------------------------
-- Removing
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated"}';
update public.visit_photos set removed_at = now();
select is((select count(*)::int from public.visit_photos where removed_at is not null), 0,
  'another groomer cannot remove someone else''s photo');

set local request.jwt.claims to '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$update public.visit_photos set removed_at = now()$$, 'an owner can remove a photo');
select is((select count(*)::int from public.visit_photos where removed_at is not null), 1, 'the photo is marked removed, not deleted');

-- ---------------------------------------------------------------------
-- Another business, anonymous
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"90000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
  (select count(*)::int from storage.objects where bucket_id = 'visit-photos') + (select count(*)::int from public.visit_photos),
  0, 'another business cannot see Salon A''s visit photos');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select count(*) from public.visit_photos$$, '42501', null, 'anonymous visitors cannot list visit photos');

reset role;
select * from finish();
rollback;
