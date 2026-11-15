-- =====================================================================
-- Phase 2 step 1: clients (households) and their pets.
--
-- Access
--   * Every active member of a business can see its clients and pets.
--     Clients are shared across the business's locations; home_location_id
--     records where they usually visit.
--   * Owners, admins, managers, front desk and groomers can add and edit.
--     Bathers can view only.
--   * Nothing is deleted through the API. Owners, admins and managers can
--     archive (and restore) clients and pets through functions below.
--   * A pet can't be attached to another business's client, and a client
--     can't be moved to another business (composite keys + column grants).
-- =====================================================================

create type public.pet_species    as enum ('dog', 'cat', 'other');
create type public.pet_sex        as enum ('female', 'male', 'unknown');
create type public.contact_method as enum ('call', 'text', 'email');

create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  home_location_id   uuid,
  first_name         text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name          text not null default '' check (char_length(last_name) <= 80),
  email              text check (email is null or (char_length(email) <= 254
                       and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  phone              text check (phone is null or char_length(phone) <= 40),
  alt_phone          text check (alt_phone is null or char_length(alt_phone) <= 40),
  preferred_contact  public.contact_method,
  address            text check (address is null or char_length(address) <= 300),
  emergency_contact  text check (emergency_contact is null or char_length(emergency_contact) <= 200),
  notes              text check (notes is null or char_length(notes) <= 4000),
  archived_at        timestamptz,
  created_by         uuid references auth.users (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, home_location_id)
    references public.locations (organization_id, id) on delete restrict
);

create table public.pets (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete restrict,
  client_id              uuid not null,
  name                   text not null check (char_length(btrim(name)) between 1 and 80),
  species                public.pet_species not null default 'dog',
  breed                  text check (breed is null or char_length(breed) <= 80),
  sex                    public.pet_sex not null default 'unknown',
  fixed                  boolean,  -- spayed/neutered; null = unknown
  birth_date             date check (birth_date is null or birth_date >= date '1980-01-01'),
  weight_lbs             numeric(5,1) check (weight_lbs is null or (weight_lbs > 0 and weight_lbs < 400)),
  color                  text check (color is null or char_length(color) <= 80),
  coat                   text check (coat is null or char_length(coat) <= 120),
  handle_with_care       boolean not null default false,
  temperament            text check (temperament is null or char_length(temperament) <= 1000),
  allergies              text check (allergies is null or char_length(allergies) <= 1000),
  medical_notes          text check (medical_notes is null or char_length(medical_notes) <= 2000),
  grooming_instructions  text check (grooming_instructions is null or char_length(grooming_instructions) <= 4000),
  archived_at            timestamptz,
  created_by             uuid references auth.users (id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, client_id)
    references public.clients (organization_id, id) on delete restrict
);

create index clients_org_name_idx        on public.clients (organization_id, last_name, first_name);
create index clients_home_location_idx   on public.clients (organization_id, home_location_id);
create index clients_created_by_idx      on public.clients (created_by);
create index pets_client_idx             on public.pets (organization_id, client_id);
create index pets_client_id_idx          on public.pets (client_id);
create index pets_created_by_idx         on public.pets (created_by);

create trigger clients_updated_at before update on public.clients
  for each row execute function private.set_updated_at();
create trigger pets_updated_at before update on public.pets
  for each row execute function private.set_updated_at();

create trigger clients_audit after insert or update or delete on public.clients
  for each row execute function private.audit_row_change();
create trigger pets_audit after insert or update or delete on public.pets
  for each row execute function private.audit_row_change();

-- ---------------------------------------------------------------------
-- Privileges: read for signed-in users (RLS narrows it), column-level
-- insert/update, no delete, and no way to change which business or
-- household a record belongs to.
-- ---------------------------------------------------------------------
revoke all on public.clients, public.pets from anon, authenticated;
grant select on public.clients, public.pets to authenticated;

grant insert (organization_id, home_location_id, first_name, last_name, email, phone, alt_phone,
              preferred_contact, address, emergency_contact, notes)
  on public.clients to authenticated;
grant update (home_location_id, first_name, last_name, email, phone, alt_phone,
              preferred_contact, address, emergency_contact, notes)
  on public.clients to authenticated;

grant insert (organization_id, client_id, name, species, breed, sex, fixed, birth_date, weight_lbs,
              color, coat, handle_with_care, temperament, allergies, medical_notes, grooming_instructions)
  on public.pets to authenticated;
grant update (name, species, breed, sex, fixed, birth_date, weight_lbs,
              color, coat, handle_with_care, temperament, allergies, medical_notes, grooming_instructions)
  on public.pets to authenticated;

alter table public.clients enable row level security;
alter table public.pets    enable row level security;

create policy "Members can view clients"
  on public.clients for select to authenticated
  using (private.is_member(organization_id));

create policy "Client editors can add clients"
  on public.clients for insert to authenticated
  with check (private.has_role(organization_id,
    array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]));

create policy "Client editors can update clients"
  on public.clients for update to authenticated
  using (private.has_role(organization_id,
    array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]))
  with check (private.has_role(organization_id,
    array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]));

create policy "Members can view pets"
  on public.pets for select to authenticated
  using (private.is_member(organization_id));

create policy "Client editors can add pets"
  on public.pets for insert to authenticated
  with check (private.has_role(organization_id,
    array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]));

create policy "Client editors can update pets"
  on public.pets for update to authenticated
  using (private.has_role(organization_id,
    array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]))
  with check (private.has_role(organization_id,
    array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]));

-- ---------------------------------------------------------------------
-- Archiving: owners, admins and managers only.
-- ---------------------------------------------------------------------
create function public.set_client_archived(p_client_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.clients where id = p_client_id;
  if v_org is null or not private.is_member(v_org) then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
  if not private.has_role(v_org, array['owner', 'admin', 'manager']::public.member_role[]) then
    raise exception 'Only owners, admins and managers can archive clients.' using errcode = '42501';
  end if;

  update public.clients
  set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_client_id
    and (archived_at is null) = coalesce(p_archived, false);
end;
$$;

create function public.set_pet_archived(p_pet_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.pets where id = p_pet_id;
  if v_org is null or not private.is_member(v_org) then
    raise exception 'Pet not found.' using errcode = 'P0002';
  end if;
  if not private.has_role(v_org, array['owner', 'admin', 'manager']::public.member_role[]) then
    raise exception 'Only owners, admins and managers can archive pets.' using errcode = '42501';
  end if;

  update public.pets
  set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_pet_id
    and (archived_at is null) = coalesce(p_archived, false);
end;
$$;

-- ---------------------------------------------------------------------
-- search_clients: by name, email, phone digits, or pet name. Runs as the
-- caller, so row-level security still decides what can be found.
-- ---------------------------------------------------------------------
create function public.search_clients(
  p_organization_id   uuid,
  p_query             text    default '',
  p_include_archived  boolean default false
)
returns table (
  id           uuid,
  first_name   text,
  last_name    text,
  phone        text,
  email        text,
  archived_at  timestamptz,
  pets         jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select btrim(coalesce(p_query, '')) as t,
           regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g') as digits
  ), pat as (
    -- Treat %, _ and \ in the search box as plain characters.
    select q.t, q.digits,
           '%' || replace(replace(replace(q.t, '\', '\\'), '%', '\%'), '_', '\_') || '%' as like_pat
    from q
  )
  select c.id, c.first_name, c.last_name, c.phone, c.email, c.archived_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', p.id, 'name', p.name, 'species', p.species,
                    'breed', p.breed, 'handle_with_care', p.handle_with_care)
                  order by p.name)
           from public.pets p
           where p.client_id = c.id and p.archived_at is null
         ), '[]'::jsonb)
  from public.clients c
  cross join pat
  where c.organization_id = p_organization_id
    and (coalesce(p_include_archived, false) or c.archived_at is null)
    and (
      pat.t = ''
      or (c.first_name || ' ' || c.last_name) ilike pat.like_pat
      or c.email ilike pat.like_pat
      or (char_length(pat.digits) >= 3 and (
            regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') like '%' || pat.digits || '%'
         or regexp_replace(coalesce(c.alt_phone, ''), '[^0-9]', '', 'g') like '%' || pat.digits || '%'))
      or exists (select 1 from public.pets p
                 where p.client_id = c.id and p.archived_at is null and p.name ilike pat.like_pat)
    )
  order by lower(c.last_name), lower(c.first_name)
  limit 200;
$$;

revoke all on function public.set_client_archived(uuid, boolean)       from public, anon;
revoke all on function public.set_pet_archived(uuid, boolean)          from public, anon;
revoke all on function public.search_clients(uuid, text, boolean)      from public, anon;
grant execute on function public.set_client_archived(uuid, boolean)    to authenticated;
grant execute on function public.set_pet_archived(uuid, boolean)       to authenticated;
grant execute on function public.search_clients(uuid, text, boolean)   to authenticated;
