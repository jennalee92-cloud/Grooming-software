-- Staff invitations, role changes, and location access (Phase 1 step 3).
-- Runs inside a transaction and rolls back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-- ---------------------------------------------------------------------
-- Fixtures (created as the database owner)
-- ---------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('10000000-0000-0000-0000-000000000001', 'owner@test.invalid',       'authenticated', 'authenticated', now()),
  ('10000000-0000-0000-0000-000000000002', 'admin@test.invalid',       'authenticated', 'authenticated', now()),
  ('10000000-0000-0000-0000-000000000003', 'groomer@test.invalid',     'authenticated', 'authenticated', now()),
  ('10000000-0000-0000-0000-000000000004', 'unconfirmed@test.invalid', 'authenticated', 'authenticated', null),
  ('10000000-0000-0000-0000-000000000005', 'outsider@test.invalid',    'authenticated', 'authenticated', now()),
  ('10000000-0000-0000-0000-000000000006', 'owner-b@test.invalid',     'authenticated', 'authenticated', now());

set local role authenticated;

-- Owner creates Salon A with two locations
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.org', public.create_organization('Salon A', 'Main Street', 'America/New_York', 'Olivia Owner')::text, true);
end $$;
insert into public.locations (organization_id, name) values (current_setting('test.org')::uuid, 'Second Street');
do $$ begin
  perform set_config('test.loc_main',   (select id::text from public.locations where name = 'Main Street'), true);
  perform set_config('test.loc_second', (select id::text from public.locations where name = 'Second Street'), true);
end $$;

-- Owner B creates Salon B
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}';
do $$ begin
  perform set_config('test.org_b', public.create_organization('Salon B', 'Harbor')::text, true);
  perform set_config('test.loc_b', (select id::text from public.locations), true);
end $$;

-- ---------------------------------------------------------------------
-- Owner sends invitations
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.inv_admin',
    public.invite_member(current_setting('test.org')::uuid, 'admin@test.invalid', 'admin')::text, true);
  perform set_config('test.inv_groomer',
    public.invite_member(current_setting('test.org')::uuid, '  Groomer@Test.invalid ', 'groomer',
                         array[current_setting('test.loc_main')::uuid], false, 'Gina Groomer')::text, true);
  perform set_config('test.inv_unconfirmed',
    public.invite_member(current_setting('test.org')::uuid, 'unconfirmed@test.invalid', 'bather', '{}', true)::text, true);
  perform public.invite_member(current_setting('test.org')::uuid, 'outsider@test.invalid', 'bather', '{}', true);
  perform set_config('test.inv_outsider',
    public.invite_member(current_setting('test.org')::uuid, 'outsider@test.invalid', 'front_desk', '{}', true)::text, true);
end $$;

select is((select email from public.invitations where id = current_setting('test.inv_groomer')::uuid),
  'groomer@test.invalid', 'invitation emails are stored trimmed and lowercase');

select is((select all_locations from public.invitations where id = current_setting('test.inv_admin')::uuid),
  true, 'admin invitations always cover every location');

select is((select count(*)::int from public.invitations
           where email = 'outsider@test.invalid' and revoked_at is null),
  1, 're-inviting the same email replaces the earlier invitation');

select throws_ok(
  format($$select public.invite_member(%L, 'new@test.invalid', 'owner', '{}', true)$$, current_setting('test.org')),
  '22023', null, 'nobody can be invited as an owner');

select throws_ok(
  format($$select public.invite_member(%L, 'new@test.invalid', 'groomer')$$, current_setting('test.org')),
  '22023', 'Choose at least one location, or all locations.', 'a non-admin invitation needs at least one location');

select throws_ok(
  format($$select public.invite_member(%L, 'new@test.invalid', 'groomer', array[%L]::uuid[])$$,
         current_setting('test.org'), current_setting('test.loc_b')),
  '22023', null, 'an invitation cannot include another business''s location');

select throws_ok(
  format($$select public.invite_member(%L, 'owner@test.invalid', 'groomer', '{}', true)$$, current_setting('test.org')),
  '23505', null, 'someone already on the team cannot be invited again');

select throws_ok(
  format($$select public.invite_member(%L, 'not-an-email', 'groomer', '{}', true)$$, current_setting('test.org')),
  '22023', 'Enter a valid email address.', 'invalid emails are rejected');

select throws_ok(
  format($$insert into public.invitations (organization_id, email, role) values (%L, 'x@test.invalid', 'groomer')$$, current_setting('test.org')),
  '42501', null, 'invitations cannot be written directly');

select throws_ok(
  $$update public.organization_members set role = 'admin'$$,
  '42501', null, 'member roles cannot be changed directly');

select lives_ok(
  format($$select public.revoke_invitation(%L)$$, current_setting('test.inv_outsider')),
  'the owner can cancel an invitation');

select throws_ok(
  format($$select public.revoke_invitation(%L)$$, current_setting('test.inv_outsider')),
  'P0001', null, 'a cancelled invitation cannot be cancelled twice');

select ok((select count(*) from public.audit_events where table_name = 'invitations') >= 5,
  'invitations are recorded in the audit log');

-- ---------------------------------------------------------------------
-- Another business's owner
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}';

select is((select count(*)::int from public.invitations), 0, 'another business cannot see Salon A invitations');

select throws_ok(
  format($$select public.revoke_invitation(%L)$$, current_setting('test.inv_groomer')),
  'P0002', null, 'another business cannot cancel Salon A invitations');

select throws_ok(
  format($$select * from public.team_directory(%L)$$, current_setting('test.org')),
  '42501', null, 'another business cannot read the Salon A team list');

-- ---------------------------------------------------------------------
-- Invitees
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}';

select is((select count(*)::int from public.my_invitations()), 0, 'cancelled invitations are not shown to the invitee');

select throws_ok(
  format($$select public.accept_invitation(%L)$$, current_setting('test.inv_groomer')),
  'P0002', null, 'nobody can accept an invitation sent to a different email');

set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';

select throws_ok(
  format($$select public.accept_invitation(%L)$$, current_setting('test.inv_unconfirmed')),
  '42501', null, 'an unconfirmed email cannot accept an invitation');

set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select organization_name from public.my_invitations()), 'Salon A',
  'the invitee sees the invitation with the business name');

select lives_ok(
  format($$select public.accept_invitation(%L)$$, current_setting('test.inv_groomer')),
  'the invitee can accept their invitation');

select is((select array_agg(name order by name) from public.locations), array['Main Street'],
  'the new groomer sees only the location they were invited to');

select throws_ok(
  format($$select public.accept_invitation(%L)$$, current_setting('test.inv_groomer')),
  'P0001', null, 'an invitation can only be accepted once');

select throws_ok(
  format($$select public.invite_member(%L, 'new@test.invalid', 'groomer', '{}', true)$$, current_setting('test.org')),
  '42501', null, 'groomers cannot invite staff');

select throws_ok(
  format($$select * from public.team_directory(%L)$$, current_setting('test.org')),
  '42501', null, 'groomers cannot read the team list with emails');

select is((select count(*)::int from public.invitations), 0, 'groomers cannot see invitations');

set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  format($$select public.accept_invitation(%L)$$, current_setting('test.inv_admin')),
  'the invited admin can accept');

-- Member ids for the role tests
reset role;
do $$ begin
  perform set_config('test.m_owner',   (select id::text from public.organization_members where user_id = '10000000-0000-0000-0000-000000000001'), true);
  perform set_config('test.m_admin',   (select id::text from public.organization_members where user_id = '10000000-0000-0000-0000-000000000002'), true);
  perform set_config('test.m_groomer', (select id::text from public.organization_members where user_id = '10000000-0000-0000-0000-000000000003'), true);
end $$;
set local role authenticated;

-- ---------------------------------------------------------------------
-- Admin safeguards
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  format($$select public.invite_member(%L, 'admin2@test.invalid', 'admin')$$, current_setting('test.org')),
  '42501', 'Only the owner can invite admins.', 'admins cannot invite other admins');

select throws_ok(
  format($$select public.update_member(%L, 'groomer', '{}', true)$$, current_setting('test.m_owner')),
  '42501', null, 'admins cannot change the owner');

select throws_ok(
  format($$select public.update_member(%L, 'manager', '{}', true)$$, current_setting('test.m_admin')),
  '42501', null, 'nobody can change their own role');

select throws_ok(
  format($$select public.update_member(%L, 'admin', '{}', true)$$, current_setting('test.m_groomer')),
  '42501', null, 'admins cannot promote someone to admin');

select lives_ok(
  format($$select public.update_member(%L, 'manager', array[%L, %L]::uuid[])$$,
         current_setting('test.m_groomer'), current_setting('test.loc_main'), current_setting('test.loc_second')),
  'an admin can change a groomer''s role and locations');

set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is((select count(*)::int from public.locations), 2, 'location changes take effect immediately');

-- ---------------------------------------------------------------------
-- Owner manages access
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  format($$select public.set_member_active(%L, false)$$, current_setting('test.m_owner')),
  '42501', null, 'the owner cannot turn off their own access');

select lives_ok(
  format($$select public.set_member_active(%L, false)$$, current_setting('test.m_groomer')),
  'the owner can turn off a team member''s access');

select is(
  (select status::text from public.team_directory(current_setting('test.org')::uuid) where email = 'groomer@test.invalid'),
  'deactivated', 'the team list shows sign-in emails and access status');

set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.organizations), 0, 'a member whose access is off sees nothing');

set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  format($$select public.set_member_active(%L, true)$$, current_setting('test.m_groomer')),
  'the owner can turn access back on');

select lives_ok(
  format($$select public.update_member(%L, 'manager', array[%L]::uuid[])$$,
         current_setting('test.m_admin'), current_setting('test.loc_main')),
  'the owner can change an admin''s role');

set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.organizations), 1, 'turning access back on restores it');

-- ---------------------------------------------------------------------
-- Declining, expiry, and anonymous visitors
-- ---------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  perform set_config('test.inv_outsider2',
    public.invite_member(current_setting('test.org')::uuid, 'outsider@test.invalid', 'bather', '{}', true)::text, true);
end $$;

set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}';
select lives_ok(
  format($$select public.decline_invitation(%L)$$, current_setting('test.inv_outsider2')),
  'an invitee can decline');

select is((select count(*)::int from public.my_invitations()), 0, 'a declined invitation disappears');

reset role;
update public.invitations set expires_at = now() - interval '1 day' where id = current_setting('test.inv_unconfirmed')::uuid;
update auth.users set email_confirmed_at = now() where id = '10000000-0000-0000-0000-000000000004';

set local role authenticated;
set local request.jwt.claims to '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok(
  format($$select public.accept_invitation(%L)$$, current_setting('test.inv_unconfirmed')),
  'P0001', 'This invitation has expired. Ask for a new one.', 'expired invitations cannot be accepted');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select * from public.my_invitations()$$, '42501', null, 'anonymous visitors cannot list invitations');

reset role;
select * from finish();
rollback;
