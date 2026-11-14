-- =====================================================================
-- Phase 1 foundation: organizations, locations, members, location
-- access grants, and an append-only audit log.
--
-- Security model
--   * Every business record carries organization_id.
--   * Row-level security (RLS) is enabled on every table. Access comes
--     only from the caller's active membership rows, never from ids the
--     client supplies.
--   * Composite foreign keys stop rows pointing across businesses.
--   * Organizations and owner memberships are created only through
--     public.create_organization(), so nobody can add themselves to
--     another business.
--   * Table privileges are granted column-by-column; TRUNCATE and other
--     RLS-bypassing privileges are never granted to API roles.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.member_role as enum (
  'owner', 'admin', 'manager', 'groomer', 'bather', 'front_desk'
);

create type public.member_status as enum ('active', 'deactivated');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.locations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  name             text not null check (char_length(btrim(name)) between 1 and 120),
  timezone         text not null default 'America/New_York',
  phone            text check (phone is null or char_length(phone) <= 40),
  address          text check (address is null or char_length(address) <= 300),
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  user_id          uuid not null references auth.users (id) on delete restrict,
  role             public.member_role not null,
  status           public.member_status not null default 'active',
  display_name     text check (display_name is null or char_length(display_name) <= 120),
  -- true = may work at every location, including ones added later
  all_locations    boolean not null default false,
  deactivated_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, id)
);

create table public.member_locations (
  organization_id  uuid not null,
  member_id        uuid not null,
  location_id      uuid not null,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  primary key (member_id, location_id),
  -- both references must belong to the same organization
  foreign key (organization_id, member_id)
    references public.organization_members (organization_id, id) on delete cascade,
  foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete cascade
);

create table public.audit_events (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  actor_user_id    uuid,
  action           text not null,
  table_name       text not null,
  record_id        uuid,
  old_data         jsonb,
  new_data         jsonb,
  created_at       timestamptz not null default now()
);

create index locations_organization_idx       on public.locations (organization_id);
create index organization_members_user_idx    on public.organization_members (user_id);
create index member_locations_location_idx    on public.member_locations (location_id);
create index member_locations_member_fk_idx   on public.member_locations (organization_id, member_id);
create index member_locations_location_fk_idx on public.member_locations (organization_id, location_id);
create index audit_events_org_time_idx        on public.audit_events (organization_id, created_at desc);

-- ---------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = new.timezone) then
    raise exception 'Unknown time zone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Writes one audit row per change. Runs as the table owner so API roles
-- never need write access to audit_events.
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org uuid;
begin
  v_org := coalesce(
    (v_row ->> 'organization_id')::uuid,
    case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid end
  );

  insert into public.audit_events
    (organization_id, actor_user_id, action, table_name, record_id, old_data, new_data)
  values (
    v_org,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger locations_updated_at before update on public.locations
  for each row execute function private.set_updated_at();
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();

create trigger locations_validate_timezone before insert or update of timezone on public.locations
  for each row execute function private.validate_timezone();

create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function private.audit_row_change();
create trigger locations_audit after insert or update or delete on public.locations
  for each row execute function private.audit_row_change();
create trigger organization_members_audit after insert or update or delete on public.organization_members
  for each row execute function private.audit_row_change();
create trigger member_locations_audit after insert or update or delete on public.member_locations
  for each row execute function private.audit_row_change();

-- ---------------------------------------------------------------------
-- Access helpers used by RLS policies.
-- SECURITY DEFINER so policies on organization_members can look up
-- membership without recursing into their own policies. Each one only
-- ever answers questions about the calling user (auth.uid()).
-- ---------------------------------------------------------------------
create function private.active_role(p_org uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organization_members m
  where m.organization_id = p_org
    and m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

create function private.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.active_role(p_org) is not null;
$$;

create function private.has_role(p_org uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.active_role(p_org) = any (p_roles), false);
$$;

create function private.can_access_location(p_org uuid, p_location uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        m.role in ('owner', 'admin')
        or m.all_locations
        or exists (
          select 1 from public.member_locations ml
          where ml.member_id = m.id and ml.location_id = p_location
        )
      )
  );
$$;

revoke all on function private.active_role(uuid)                         from public;
revoke all on function private.is_member(uuid)                           from public;
revoke all on function private.has_role(uuid, public.member_role[])      from public;
revoke all on function private.can_access_location(uuid, uuid)           from public;
grant execute on function private.active_role(uuid)                      to authenticated;
grant execute on function private.is_member(uuid)                        to authenticated;
grant execute on function private.has_role(uuid, public.member_role[])   to authenticated;
grant execute on function private.can_access_location(uuid, uuid)        to authenticated;

-- ---------------------------------------------------------------------
-- Table privileges: start from nothing, grant only what policies need.
-- ---------------------------------------------------------------------
revoke all on public.organizations, public.locations, public.organization_members,
              public.member_locations, public.audit_events
  from anon, authenticated;

grant select on public.organizations, public.locations, public.organization_members,
                public.member_locations, public.audit_events
  to authenticated;

grant update (name) on public.organizations to authenticated;
grant insert (organization_id, name, timezone, phone, address) on public.locations to authenticated;
grant update (name, timezone, phone, address, archived_at)     on public.locations to authenticated;
grant insert (organization_id, member_id, location_id), delete on public.member_locations to authenticated;

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.locations            enable row level security;
alter table public.organization_members enable row level security;
alter table public.member_locations     enable row level security;
alter table public.audit_events         enable row level security;

-- organizations
create policy "Members can view their organizations"
  on public.organizations for select to authenticated
  using (private.is_member(id));

create policy "Owners and admins can update their organization"
  on public.organizations for update to authenticated
  using (private.has_role(id, array['owner', 'admin']::public.member_role[]))
  with check (private.has_role(id, array['owner', 'admin']::public.member_role[]));

-- locations
create policy "Members can view locations they work at"
  on public.locations for select to authenticated
  using (private.can_access_location(organization_id, id));

create policy "Owners and admins can add locations"
  on public.locations for insert to authenticated
  with check (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy "Owners and admins can update locations"
  on public.locations for update to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- organization_members: readable by colleagues; changed only through
-- security-definer functions that enforce owner safeguards.
create policy "Members can view colleagues"
  on public.organization_members for select to authenticated
  using (private.is_member(organization_id));

-- member_locations
create policy "Members can view location assignments"
  on public.member_locations for select to authenticated
  using (private.is_member(organization_id));

create policy "Owners and admins can assign locations"
  on public.member_locations for insert to authenticated
  with check (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

create policy "Owners and admins can remove location assignments"
  on public.member_locations for delete to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- audit_events: read-only, owners and admins only
create policy "Owners and admins can view the audit log"
  on public.audit_events for select to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- ---------------------------------------------------------------------
-- create_organization: the only way to start a business. Creates the
-- organization, makes the caller its owner, and adds a first location
-- in one transaction.
-- ---------------------------------------------------------------------
create function public.create_organization(
  p_name           text,
  p_location_name  text,
  p_timezone       text default 'America/New_York',
  p_display_name   text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to create a business.' using errcode = '42501';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Business name is required.' using errcode = '22023';
  end if;

  if coalesce(btrim(p_location_name), '') = '' then
    raise exception 'Location name is required.' using errcode = '22023';
  end if;

  if (select count(*) from public.organizations o where o.created_by = v_uid) >= 5 then
    raise exception 'An account can create at most 5 businesses.' using errcode = 'P0001';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(p_name), v_uid)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role, all_locations, display_name)
  values (v_org, v_uid, 'owner', true, nullif(btrim(p_display_name), ''));

  insert into public.locations (organization_id, name, timezone)
  values (v_org, btrim(p_location_name), coalesce(nullif(btrim(p_timezone), ''), 'America/New_York'));

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;
