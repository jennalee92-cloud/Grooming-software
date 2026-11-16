-- Vet record uploads (Phase 2 step 4b).
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('70000000-0000-0000-0000-000000000001', 'owner@test.invalid',   'authenticated', 'authenticated', now()),
  ('70000000-0000-0000-0000-000000000002', 'desk@test.invalid',    'authenticated', 'authenticated', now()),
  ('70000000-0000-0000-0000-000000000003', 'bather@test.invalid',  'authenticated', 'authenticated', now()),
  ('70000000-0000-0000-0000-000000000005', 'owner-b@test.invalid', 'authenticated', 'authenticated', now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.org', public.create_organization('Salon A', 'Main Street')::text, true);
end $$;
set local request.jwt.claims to '{"sub":"70000000-0000-0000-0000-000000000005","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor')::text, true);
end $$;

reset role;
insert into public.organization_members (organization_id, user_id, role, display_name, all_locations) values
  (current_setting('test.org')::uuid, '70000000-0000-0000-0000-000000000002', 'front_desk', 'Dee', true),
  (current_setting('test.org')::uuid, '70000000-0000-0000-0000-000000000003', 'bather',     'Ben', true);

insert into public.clients (id, organization_id, first_name) values
  ('7a000000-0000-0000-0000-000000000001', current_setting('test.org')::uuid,   'Maria'),
  ('7b000000-0000-0000-0000-000000000001', current_setting('test.org_b')::uuid, 'Bea');
insert into public.pets (id, organization_id, client_id, name) values
  ('7a000000-0000-0000-0000-0000000000d1', current_setting('test.org')::uuid,   '7a000000-0000-0000-0000-000000000001', 'Biscuit'),
  ('7a000000-0000-0000-0000-0000000000d2', current_setting('test.org')::uuid,   '7a000000-0000-0000-0000-000000000001', 'Pepper'),
  ('7b000000-0000-0000-0000-0000000000d1', current_setting('test.org_b')::uuid, '7b000000-0000-0000-0000-000000000001', 'Bolt');
insert into public.pet_vaccinations (id, organization_id, pet_id, vaccine, expires_on) values
  ('7a000000-0000-0000-0000-0000000000f1', current_setting('test.org')::uuid, '7a000000-0000-0000-0000-0000000000d1', 'Rabies', current_date + 300),
  ('7a000000-0000-0000-0000-0000000000f2', current_setting('test.org')::uuid, '7a000000-0000-0000-0000-0000000000d2', 'Rabies', current_date + 300);

do $$ begin
  perform set_config('test.path', current_setting('test.org') || '/7a000000-0000-0000-0000-0000000000d1/rabies.jpg', true);
end $$;

set local role authenticated;

-- ---------------------------------------------------------------------
-- Uploading files
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vaccination-records', %L)$$, current_setting('test.path')),
  'front desk can upload a vet record for their business''s pet');

select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vaccination-records', %L)$$,
         current_setting('test.org_b') || '/7b000000-0000-0000-0000-0000000000d1/x.jpg'),
  '42501', null, 'nobody can upload into another business''s folder');

select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vaccination-records', %L)$$,
         current_setting('test.org') || '/7b000000-0000-0000-0000-0000000000d1/x.jpg'),
  '42501', null, 'nobody can upload a file for another business''s pet');

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('vaccination-records', 'not-a-uuid/also-not/x.jpg')$$,
  '42501', null, 'uploads must use the business and pet folder layout');

-- ---------------------------------------------------------------------
-- Listing them
-- ---------------------------------------------------------------------
select lives_ok(
  format($$insert into public.vaccination_documents (organization_id, pet_id, vaccination_id, storage_path, file_name, content_type, size_bytes)
           values (%L, '7a000000-0000-0000-0000-0000000000d1', '7a000000-0000-0000-0000-0000000000f1', %L, 'rabies.jpg', 'image/jpeg', 120000)$$,
         current_setting('test.org'), current_setting('test.path')),
  'an uploaded file can be listed and linked to a vaccination');

select throws_ok(
  format($$insert into public.vaccination_documents (organization_id, pet_id, storage_path, file_name, content_type, size_bytes)
           values (%L, '7a000000-0000-0000-0000-0000000000d1', %L, 'ghost.jpg', 'image/jpeg', 100)$$,
         current_setting('test.org'), current_setting('test.org') || '/7a000000-0000-0000-0000-0000000000d1/ghost.jpg'),
  '42501', null, 'a file that was never uploaded cannot be listed');

select throws_ok(
  format($$insert into public.vaccination_documents (organization_id, pet_id, storage_path, file_name, content_type, size_bytes)
           values (%L, '7a000000-0000-0000-0000-0000000000d2', %L, 'rabies.jpg', 'image/jpeg', 100)$$,
         current_setting('test.org'), current_setting('test.path')),
  '23514', null, 'a file can only be listed for the pet whose folder it is in');

-- Upload a second file for Pepper, then try to link it to Biscuit's record
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vaccination-records', %L)$$,
         current_setting('test.org') || '/7a000000-0000-0000-0000-0000000000d2/p.jpg'),
  'a second file uploads');
select throws_ok(
  format($$insert into public.vaccination_documents (organization_id, pet_id, vaccination_id, storage_path, file_name, content_type, size_bytes)
           values (%L, '7a000000-0000-0000-0000-0000000000d2', '7a000000-0000-0000-0000-0000000000f1', %L, 'p.jpg', 'image/jpeg', 100)$$,
         current_setting('test.org'), current_setting('test.org') || '/7a000000-0000-0000-0000-0000000000d2/p.jpg'),
  '22023', null, 'a file cannot be linked to another pet''s vaccination');

-- Files can't be deleted by app users
do $$ begin
  delete from storage.objects where bucket_id = 'vaccination-records';
exception when others then null;
end $$;
select is((select count(*)::int from storage.objects where bucket_id = 'vaccination-records'), 2,
  'uploaded files cannot be deleted');

-- ---------------------------------------------------------------------
-- Bather, another business, anonymous
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"70000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('vaccination-records', %L)$$,
         current_setting('test.org') || '/7a000000-0000-0000-0000-0000000000d1/b.jpg'),
  '42501', null, 'a bather can view but not upload vet records');

set local request.jwt.claims to '{"sub":"70000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
  (select count(*)::int from storage.objects where bucket_id = 'vaccination-records')
    + (select count(*)::int from public.vaccination_documents),
  0, 'another business cannot see Salon A''s vet record files');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select count(*) from public.vaccination_documents$$, '42501', null, 'anonymous visitors cannot list vet records');

reset role;
select * from finish();
rollback;
