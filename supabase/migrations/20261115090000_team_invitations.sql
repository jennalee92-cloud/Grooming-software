-- =====================================================================
-- Phase 1 step 3: staff invitations, role changes, and location access.
--
-- Security model
--   * Team changes happen only through the SECURITY DEFINER functions
--     below. API roles get read access to invitations and nothing else.
--   * Owners and admins manage the team. Only the owner can grant or
--     change admin access. Nobody can change their own role, and the
--     owner's role can't be changed or removed here.
--   * An invitation is accepted only by a signed-in user whose CONFIRMED
--     email matches it, so knowing an invitation id is not enough.
--   * Every change is written to the audit log by trigger.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  email            text not null check (
                     email = lower(btrim(email))
                     and char_length(email) between 3 and 254
                     and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role             public.member_role not null check (role <> 'owner'),
  display_name     text check (display_name is null or char_length(display_name) <= 120),
  all_locations    boolean not null default false,
  invited_by       uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at       timestamptz not null default now() + interval '14 days',
  accepted_at      timestamptz,
  accepted_by      uuid references auth.users (id) on delete set null,
  declined_at      timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id)
);

-- At most one open invitation per email per business.
create unique index invitations_one_open_per_email
  on public.invitations (organization_id, email)
  where accepted_at is null and declined_at is null and revoked_at is null;

create index invitations_open_email_idx
  on public.invitations (email)
  where accepted_at is null and declined_at is null and revoked_at is null;

create index invitations_invited_by_idx  on public.invitations (invited_by);
create index invitations_accepted_by_idx on public.invitations (accepted_by);

create table public.invitation_locations (
  organization_id  uuid not null,
  invitation_id    uuid not null,
  location_id      uuid not null,
  primary key (invitation_id, location_id),
  foreign key (organization_id, invitation_id)
    references public.invitations (organization_id, id) on delete cascade,
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete cascade
);

create index invitation_locations_invitation_fk_idx on public.invitation_locations (organization_id, invitation_id);
create index invitation_locations_location_fk_idx   on public.invitation_locations (organization_id, location_id);

create trigger invitations_updated_at before update on public.invitations
  for each row execute function private.set_updated_at();

create trigger invitations_audit after insert or update or delete on public.invitations
  for each row execute function private.audit_row_change();
create trigger invitation_locations_audit after insert or update or delete on public.invitation_locations
  for each row execute function private.audit_row_change();

-- ---------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------
revoke all on public.invitations, public.invitation_locations from anon, authenticated;
grant select on public.invitations, public.invitation_locations to authenticated;

alter table public.invitations          enable row level security;
alter table public.invitation_locations enable row level security;

create policy "Owners and admins can view invitations"
  on public.invitations for select to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy "Owners and admins can view invitation locations"
  on public.invitation_locations for select to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- ---------------------------------------------------------------------
-- Internal helpers (not callable through the API)
-- ---------------------------------------------------------------------

-- The caller's email, only once they have confirmed it.
create function private.confirmed_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null;
$$;

-- Checks a list of location ids belongs to the business and returns it
-- without duplicates.
create function private.checked_location_ids(p_org uuid, p_ids uuid[])
returns uuid[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_ids, '{}'::uuid[])) as t(x));
begin
  if exists (
    select 1 from unnest(v_ids) as t(x)
    where t.x is null
       or not exists (
         select 1 from public.locations l
         where l.organization_id = p_org and l.id = t.x and l.archived_at is null)
  ) then
    raise exception 'One of the chosen locations isn''t part of this business.' using errcode = '22023';
  end if;
  return v_ids;
end;
$$;

revoke all on function private.confirmed_email()                     from public;
revoke all on function private.checked_location_ids(uuid, uuid[])    from public;

-- ---------------------------------------------------------------------
-- invite_member: owners and admins invite someone by email.
-- Re-inviting the same email replaces the earlier open invitation.
-- ---------------------------------------------------------------------
create function public.invite_member(
  p_organization_id  uuid,
  p_email            text,
  p_role             public.member_role,
  p_location_ids     uuid[]  default '{}',
  p_all_locations    boolean default false,
  p_display_name     text    default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_caller  public.member_role := private.active_role(p_organization_id);
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_all     boolean := coalesce(p_all_locations, false) or p_role = 'admin';
  v_locs    uuid[];
  v_status  public.member_status;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if v_caller is null or v_caller not in ('owner', 'admin') then
    raise exception 'Only owners and admins can invite staff.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if p_role is null or p_role = 'owner' then
    raise exception 'Choose a role other than owner.' using errcode = '22023';
  end if;
  if p_role = 'admin' and v_caller <> 'owner' then
    raise exception 'Only the owner can invite admins.' using errcode = '42501';
  end if;
  if p_display_name is not null and char_length(btrim(p_display_name)) > 120 then
    raise exception 'Keep the name under 120 characters.' using errcode = '22023';
  end if;

  select m.status into v_status
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id and lower(u.email) = v_email;

  if v_status = 'active' then
    raise exception 'That person is already on your team.' using errcode = '23505';
  elsif v_status = 'deactivated' then
    raise exception 'That person''s access is turned off. Turn it back on from your team list instead.' using errcode = '23505';
  end if;

  v_locs := case when v_all then '{}'::uuid[]
                 else private.checked_location_ids(p_organization_id, p_location_ids) end;
  if not v_all and cardinality(v_locs) = 0 then
    raise exception 'Choose at least one location, or all locations.' using errcode = '22023';
  end if;

  if (select count(*) from public.invitations i
      where i.organization_id = p_organization_id
        and i.accepted_at is null and i.declined_at is null and i.revoked_at is null
        and i.expires_at > now()) >= 100 then
    raise exception 'This business has 100 open invitations. Cancel some before sending more.' using errcode = 'P0001';
  end if;

  update public.invitations i
  set revoked_at = now()
  where i.organization_id = p_organization_id and i.email = v_email
    and i.accepted_at is null and i.declined_at is null and i.revoked_at is null;

  insert into public.invitations (organization_id, email, role, display_name, all_locations, invited_by)
  values (p_organization_id, v_email, p_role, nullif(btrim(p_display_name), ''), v_all, v_uid)
  returning id into v_id;

  insert into public.invitation_locations (organization_id, invitation_id, location_id)
  select p_organization_id, v_id, x from unnest(v_locs) as t(x);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- revoke_invitation: cancel an open invitation.
-- ---------------------------------------------------------------------
create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv     public.invitations;
  v_caller  public.member_role;
begin
  select * into v_inv from public.invitations where id = p_invitation_id for update;
  v_caller := case when v_inv.id is null then null else private.active_role(v_inv.organization_id) end;

  if v_caller is null or v_caller not in ('owner', 'admin') then
    raise exception 'Invitation not found.' using errcode = 'P0002';
  end if;
  if v_inv.role = 'admin' and v_caller <> 'owner' then
    raise exception 'Only the owner can cancel an admin invitation.' using errcode = '42501';
  end if;
  if v_inv.accepted_at is not null or v_inv.declined_at is not null or v_inv.revoked_at is not null then
    raise exception 'That invitation is no longer open.' using errcode = 'P0001';
  end if;

  update public.invitations set revoked_at = now() where id = v_inv.id;
end;
$$;

-- ---------------------------------------------------------------------
-- my_invitations: open invitations addressed to the caller's confirmed
-- email, with the business name so they know what they're joining.
-- ---------------------------------------------------------------------
create function public.my_invitations()
returns table (
  id                 uuid,
  organization_id    uuid,
  organization_name  text,
  role               public.member_role,
  invited_by_name    text,
  expires_at         timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.organization_id, o.name, i.role,
         (select m.display_name from public.organization_members m
          where m.organization_id = i.organization_id and m.user_id = i.invited_by),
         i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.email = private.confirmed_email()
    and i.accepted_at is null and i.declined_at is null and i.revoked_at is null
    and i.expires_at > now()
  order by i.created_at;
$$;

-- ---------------------------------------------------------------------
-- accept_invitation: join the business with the invited role and
-- locations. Turns a previously deactivated membership back on.
-- ---------------------------------------------------------------------
create function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := private.confirmed_email();
  v_inv     public.invitations;
  v_member  public.organization_members;
begin
  if v_uid is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if v_email is null then
    raise exception 'Confirm your email address before accepting an invitation.' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations
  where id = p_invitation_id and email = v_email
  for update;

  if v_inv.id is null then
    raise exception 'Invitation not found.' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null or v_inv.declined_at is not null or v_inv.revoked_at is not null then
    raise exception 'This invitation is no longer open.' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'This invitation has expired. Ask for a new one.' using errcode = 'P0001';
  end if;

  select * into v_member from public.organization_members
  where organization_id = v_inv.organization_id and user_id = v_uid
  for update;

  if v_member.id is not null and v_member.status = 'active' then
    raise exception 'You''re already part of this business.' using errcode = '23505';
  elsif v_member.id is not null then
    update public.organization_members
    set role = v_inv.role, status = 'active', deactivated_at = null,
        all_locations = v_inv.all_locations,
        display_name = coalesce(display_name, v_inv.display_name)
    where id = v_member.id;
    delete from public.member_locations where member_id = v_member.id;
  else
    insert into public.organization_members (organization_id, user_id, role, all_locations, display_name)
    values (v_inv.organization_id, v_uid, v_inv.role, v_inv.all_locations, v_inv.display_name)
    returning * into v_member;
  end if;

  insert into public.member_locations (organization_id, member_id, location_id, created_by)
  select il.organization_id, v_member.id, il.location_id, v_inv.invited_by
  from public.invitation_locations il
  where il.invitation_id = v_inv.id;

  update public.invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  return v_inv.organization_id;
end;
$$;

-- ---------------------------------------------------------------------
-- decline_invitation
-- ---------------------------------------------------------------------
create function public.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := private.confirmed_email();
begin
  if v_email is null then
    raise exception 'Confirm your email address first.' using errcode = '42501';
  end if;

  update public.invitations
  set declined_at = now()
  where id = p_invitation_id and email = v_email
    and accepted_at is null and declined_at is null and revoked_at is null;

  if not found then
    raise exception 'Invitation not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Shared guard for changing an existing team member. Returns the target
-- row after checking the caller may manage them.
-- ---------------------------------------------------------------------
create function private.manageable_member(p_member_id uuid, p_new_role public.member_role)
returns public.organization_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target  public.organization_members;
  v_caller  public.member_role;
begin
  select * into v_target from public.organization_members where id = p_member_id for update;
  v_caller := case when v_target.id is null then null else private.active_role(v_target.organization_id) end;

  if v_caller is null or v_caller not in ('owner', 'admin') then
    raise exception 'Team member not found.' using errcode = 'P0002';
  end if;
  if v_target.user_id = (select auth.uid()) then
    raise exception 'You can''t change your own role or access.' using errcode = '42501';
  end if;
  if v_target.role = 'owner' then
    raise exception 'The owner''s role and access can''t be changed.' using errcode = '42501';
  end if;
  if p_new_role = 'owner' then
    raise exception 'Choose a role other than owner.' using errcode = '22023';
  end if;
  if v_caller <> 'owner' and (v_target.role = 'admin' or p_new_role = 'admin') then
    raise exception 'Only the owner can change admin access.' using errcode = '42501';
  end if;
  return v_target;
end;
$$;

revoke all on function private.manageable_member(uuid, public.member_role) from public;

-- ---------------------------------------------------------------------
-- update_member: change someone's role and the locations they work at.
-- ---------------------------------------------------------------------
create function public.update_member(
  p_member_id      uuid,
  p_role           public.member_role,
  p_location_ids   uuid[]  default '{}',
  p_all_locations  boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target  public.organization_members;
  v_all     boolean := coalesce(p_all_locations, false) or p_role = 'admin';
  v_locs    uuid[];
begin
  if p_role is null then
    raise exception 'Choose a role.' using errcode = '22023';
  end if;

  v_target := private.manageable_member(p_member_id, p_role);

  v_locs := case when v_all then '{}'::uuid[]
                 else private.checked_location_ids(v_target.organization_id, p_location_ids) end;
  if not v_all and cardinality(v_locs) = 0 then
    raise exception 'Choose at least one location, or all locations.' using errcode = '22023';
  end if;

  update public.organization_members
  set role = p_role, all_locations = v_all
  where id = v_target.id
    and (role, all_locations) is distinct from (p_role, v_all);

  delete from public.member_locations ml
  where ml.member_id = v_target.id
    and not (ml.location_id = any (v_locs));

  insert into public.member_locations (organization_id, member_id, location_id)
  select v_target.organization_id, v_target.id, x
  from unnest(v_locs) as t(x)
  on conflict (member_id, location_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- set_member_active: turn someone's access off or back on. Their history
-- stays; they just stop seeing the business.
-- ---------------------------------------------------------------------
create function public.set_member_active(p_member_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.organization_members;
begin
  if p_active is null then
    raise exception 'Choose whether access is on or off.' using errcode = '22023';
  end if;

  v_target := private.manageable_member(p_member_id, null);

  update public.organization_members
  set status         = case when p_active then 'active' else 'deactivated' end::public.member_status,
      deactivated_at = case when p_active then null else now() end
  where id = v_target.id
    and status <> case when p_active then 'active' else 'deactivated' end::public.member_status;
end;
$$;

-- ---------------------------------------------------------------------
-- team_directory: the team list with sign-in emails, for owners and
-- admins only. Emails live in auth.users, which the API can't read.
-- ---------------------------------------------------------------------
create function public.team_directory(p_organization_id uuid)
returns table (
  member_id      uuid,
  user_id        uuid,
  email          text,
  display_name   text,
  role           public.member_role,
  status         public.member_status,
  all_locations  boolean,
  location_ids   uuid[],
  joined_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_organization_id, array['owner', 'admin']::public.member_role[]) then
    raise exception 'Only owners and admins can view the team list.' using errcode = '42501';
  end if;

  return query
  select m.id, m.user_id, u.email::text, m.display_name, m.role, m.status, m.all_locations,
         coalesce(array(select ml.location_id from public.member_locations ml
                        where ml.member_id = m.id order by ml.created_at), '{}'::uuid[]),
         m.created_at
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id
  order by (m.status = 'deactivated'),
           array_position(array['owner','admin','manager','front_desk','groomer','bather']::public.member_role[], m.role),
           coalesce(m.display_name, u.email);
end;
$$;

-- ---------------------------------------------------------------------
-- API access to the functions: signed-in users only.
-- ---------------------------------------------------------------------
revoke all on function public.invite_member(uuid, text, public.member_role, uuid[], boolean, text) from public, anon;
revoke all on function public.revoke_invitation(uuid)                                              from public, anon;
revoke all on function public.my_invitations()                                                     from public, anon;
revoke all on function public.accept_invitation(uuid)                                              from public, anon;
revoke all on function public.decline_invitation(uuid)                                             from public, anon;
revoke all on function public.update_member(uuid, public.member_role, uuid[], boolean)             from public, anon;
revoke all on function public.set_member_active(uuid, boolean)                                     from public, anon;
revoke all on function public.team_directory(uuid)                                                 from public, anon;

grant execute on function public.invite_member(uuid, text, public.member_role, uuid[], boolean, text) to authenticated;
grant execute on function public.revoke_invitation(uuid)                                              to authenticated;
grant execute on function public.my_invitations()                                                     to authenticated;
grant execute on function public.accept_invitation(uuid)                                              to authenticated;
grant execute on function public.decline_invitation(uuid)                                             to authenticated;
grant execute on function public.update_member(uuid, public.member_role, uuid[], boolean)             to authenticated;
grant execute on function public.set_member_active(uuid, boolean)                                     to authenticated;
grant execute on function public.team_directory(uuid)                                                 to authenticated;
