-- =====================================================================
-- Phase 2 step 3: each business's service menu and prices, and the
-- services charged on each grooming visit.
--
-- Menu (public.services)
--   * A service has one flat price, or a price per pet size.
--   * Owners, admins and managers manage the menu; everyone can view it.
--   * Services are never deleted. Retiring one hides it from new visits
--     while old visits keep showing it.
--
-- Visit lines (public.visit_services)
--   * Each line keeps the service name and the price charged that day, so
--     old visits stay accurate after the menu changes.
--   * Lines can only be added in the same transaction that records the
--     visit (record_visit does both). Like visits, they're never edited:
--     a correction is a new visit version with its own lines.
--   * Prices are whole cents.
-- =====================================================================

create type public.pet_size as enum ('small', 'medium', 'large', 'xlarge');
create type public.service_pricing as enum ('flat', 'by_size');

create table public.services (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete restrict,
  name                text not null check (char_length(btrim(name)) between 1 and 80),
  description         text check (description is null or char_length(description) <= 500),
  pricing             public.service_pricing not null default 'flat',
  price_cents         integer check (price_cents is null or price_cents between 0 and 10000000),
  small_price_cents   integer check (small_price_cents  is null or small_price_cents  between 0 and 10000000),
  medium_price_cents  integer check (medium_price_cents is null or medium_price_cents between 0 and 10000000),
  large_price_cents   integer check (large_price_cents  is null or large_price_cents  between 0 and 10000000),
  xlarge_price_cents  integer check (xlarge_price_cents is null or xlarge_price_cents between 0 and 10000000),
  duration_minutes    integer check (duration_minutes is null or duration_minutes between 5 and 720),
  retired_at          timestamptz,
  created_by          uuid references auth.users (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, id),
  check (pricing <> 'flat' or price_cents is not null),
  check (pricing <> 'by_size' or (small_price_cents is not null and medium_price_cents is not null
                                  and large_price_cents is not null and xlarge_price_cents is not null))
);

-- No two services on the current menu share a name.
create unique index services_active_name_idx on public.services (organization_id, lower(btrim(name)))
  where retired_at is null;
create index services_created_by_idx on public.services (created_by);

create trigger services_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger services_audit after insert or update or delete on public.services
  for each row execute function private.audit_row_change();

revoke all on public.services from anon, authenticated;
grant select on public.services to authenticated;
grant insert (organization_id, name, description, pricing, price_cents, small_price_cents, medium_price_cents,
              large_price_cents, xlarge_price_cents, duration_minutes)
  on public.services to authenticated;
grant update (name, description, pricing, price_cents, small_price_cents, medium_price_cents,
              large_price_cents, xlarge_price_cents, duration_minutes, retired_at)
  on public.services to authenticated;

alter table public.services enable row level security;

create policy "Members can view the service menu"
  on public.services for select to authenticated
  using (private.is_member(organization_id));

create policy "Managers can add services"
  on public.services for insert to authenticated
  with check (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]));

create policy "Managers can update services"
  on public.services for update to authenticated
  using (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]))
  with check (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]));

-- ---------------------------------------------------------------------
-- The pet's size on a visit sets which menu price applies.
-- ---------------------------------------------------------------------
alter table public.grooming_visits add column pet_size public.pet_size;
grant insert (pet_size) on public.grooming_visits to authenticated;

-- ---------------------------------------------------------------------
-- Services charged on a visit
-- ---------------------------------------------------------------------
create table public.visit_services (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete restrict,
  visit_id          uuid not null,
  service_id        uuid,
  name              text not null check (char_length(btrim(name)) between 1 and 80),
  -- what the menu said for this pet's size that day (null for extra charges)
  list_price_cents  integer check (list_price_cents is null or list_price_cents between 0 and 10000000),
  -- what was actually charged
  price_cents       integer not null check (price_cents between 0 and 10000000),
  position          smallint not null default 0 check (position between 0 and 99),
  created_at        timestamptz not null default now(),
  foreign key (organization_id, visit_id)   references public.grooming_visits (organization_id, id) on delete restrict,
  foreign key (organization_id, service_id) references public.services (organization_id, id) on delete restrict
);

create index visit_services_visit_idx   on public.visit_services (organization_id, visit_id, position);
create index visit_services_visit_id_idx on public.visit_services (visit_id);
create index visit_services_service_idx on public.visit_services (organization_id, service_id);

-- Menu items copy their name and price from the menu; the price charged
-- defaults to the menu price but can be changed for this visit.
create function private.fill_visit_service()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_service public.services;
  v_size    public.pet_size;
begin
  if new.service_id is not null then
    select * into v_service from public.services
    where id = new.service_id and organization_id = new.organization_id;
    if v_service.id is null then
      raise exception 'That service isn''t on this business''s menu.' using errcode = 'P0002';
    end if;

    select pet_size into v_size from public.grooming_visits where id = new.visit_id;

    new.name := v_service.name;
    new.list_price_cents := case
      when v_service.pricing = 'flat' then v_service.price_cents
      when v_size = 'small'  then v_service.small_price_cents
      when v_size = 'medium' then v_service.medium_price_cents
      when v_size = 'large'  then v_service.large_price_cents
      when v_size = 'xlarge' then v_service.xlarge_price_cents
    end;
    new.price_cents := coalesce(new.price_cents, new.list_price_cents);
    if new.price_cents is null then
      raise exception '% is priced by size. Choose the pet''s size or enter the price.', v_service.name using errcode = '22023';
    end if;
  else
    new.list_price_cents := null;
  end if;
  return new;
end;
$$;

create trigger visit_services_fill before insert on public.visit_services
  for each row execute function private.fill_visit_service();
create trigger visit_services_audit after insert or update or delete on public.visit_services
  for each row execute function private.audit_row_change();

revoke all on public.visit_services from anon, authenticated;
grant select on public.visit_services to authenticated;
grant insert (organization_id, visit_id, service_id, name, price_cents, position)
  on public.visit_services to authenticated;

alter table public.visit_services enable row level security;

create policy "Members can view visit services"
  on public.visit_services for select to authenticated
  using (private.is_member(organization_id));

-- Only while recording the visit: the visit must be yours and created in
-- this same transaction (now() is fixed for the whole transaction).
create policy "Lines are added while recording the visit"
  on public.visit_services for insert to authenticated
  with check (exists (
    select 1 from public.grooming_visits v
    where v.id = visit_id
      and v.organization_id = visit_services.organization_id
      and v.created_by = (select auth.uid())
      and v.created_at = now()
  ));

-- ---------------------------------------------------------------------
-- record_visit: a visit (or a correction) and its services in one step.
-- Runs as the caller, so every rule above still applies.
--
-- p_lines: [{"service_id": uuid|null, "name": text, "price_cents": int|null}, ...]
--   service_id set   → a menu item; price_cents null means the menu price
--   service_id null  → an extra charge; name and price_cents required
-- ---------------------------------------------------------------------
create function public.record_visit(
  p_organization_id   uuid,
  p_location_id       uuid,
  p_pet_id            uuid,
  p_visited_on        date,
  p_groomer_member_id uuid default null,
  p_pet_size          public.pet_size default null,
  p_services          text default null,
  p_cut_details       text default null,
  p_behavior          public.visit_behavior default null,
  p_weight_lbs        numeric default null,
  p_notes             text default null,
  p_corrects_visit_id uuid default null,
  p_correction_reason text default null,
  p_voided            boolean default false,
  p_lines             jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id   uuid;
  v_line jsonb;
  v_pos  int := 0;
begin
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'Services must be a list.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) > 30 then
    raise exception 'A visit can have at most 30 services and charges.' using errcode = '22023';
  end if;
  if p_voided and jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) > 0 then
    raise exception 'A removed visit has no services.' using errcode = '22023';
  end if;

  insert into public.grooming_visits (
    organization_id, location_id, pet_id, visited_on, groomer_member_id, pet_size, services, cut_details,
    behavior, weight_lbs, notes, corrects_visit_id, correction_reason, voided)
  values (
    p_organization_id, p_location_id, p_pet_id, p_visited_on, p_groomer_member_id, p_pet_size, p_services,
    p_cut_details, p_behavior, p_weight_lbs, p_notes, p_corrects_visit_id, p_correction_reason,
    coalesce(p_voided, false))
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    if nullif(v_line ->> 'service_id', '') is null
       and (nullif(btrim(v_line ->> 'name'), '') is null or v_line ->> 'price_cents' is null) then
      raise exception 'Each extra charge needs a name and a price.' using errcode = '22023';
    end if;

    insert into public.visit_services (organization_id, visit_id, service_id, name, price_cents, position)
    values (
      p_organization_id, v_id,
      nullif(v_line ->> 'service_id', '')::uuid,
      coalesce(nullif(btrim(v_line ->> 'name'), ''), 'Service'),
      (v_line ->> 'price_cents')::integer,
      v_pos);
    v_pos := v_pos + 1;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.record_visit from public, anon;
grant execute on function public.record_visit to authenticated;
