-- =====================================================================
-- Breed prices on the service menu.
--
--   * Each salon can set a price for specific breeds on any service,
--     e.g. "Full groom: Goldendoodle (Standard) $140".
--   * When a visit is recorded, the menu price is: the pet's breed price
--     if the salon set one, else the price for the pet's size, else the
--     flat price. Staff can still change it on the visit.
--   * These are settings, not history (visits keep their own copy of the
--     price), so managers can add, change and delete them.
-- =====================================================================

create table public.service_breed_prices (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  service_id       uuid not null,
  breed            text not null check (char_length(btrim(breed)) between 1 and 80),
  price_cents      integer not null check (price_cents between 0 and 10000000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (organization_id, service_id) references public.services (organization_id, id) on delete restrict
);

create unique index service_breed_prices_breed_idx on public.service_breed_prices (service_id, lower(btrim(breed)));
create index service_breed_prices_org_idx on public.service_breed_prices (organization_id, service_id);

create trigger service_breed_prices_updated_at before update on public.service_breed_prices
  for each row execute function private.set_updated_at();
create trigger service_breed_prices_audit after insert or update or delete on public.service_breed_prices
  for each row execute function private.audit_row_change();

revoke all on public.service_breed_prices from anon, authenticated;
grant select on public.service_breed_prices to authenticated;
grant insert (organization_id, service_id, breed, price_cents) on public.service_breed_prices to authenticated;
grant update (breed, price_cents) on public.service_breed_prices to authenticated;
grant delete on public.service_breed_prices to authenticated;

alter table public.service_breed_prices enable row level security;

create policy "Members can view breed prices"
  on public.service_breed_prices for select to authenticated
  using (private.is_member(organization_id));

create policy "Managers can add breed prices"
  on public.service_breed_prices for insert to authenticated
  with check (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]));

create policy "Managers can change breed prices"
  on public.service_breed_prices for update to authenticated
  using (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]))
  with check (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]));

create policy "Managers can delete breed prices"
  on public.service_breed_prices for delete to authenticated
  using (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]));

-- ---------------------------------------------------------------------
-- Replace a service's breed prices in one step.
-- p_prices: [{"breed": text, "price_cents": int}, ...]
-- Runs as the caller, so the rules above apply.
-- ---------------------------------------------------------------------
create function public.set_service_breed_prices(p_service_id uuid, p_prices jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org  uuid;
  v_item jsonb;
begin
  select organization_id into v_org from public.services where id = p_service_id;
  if v_org is null then
    raise exception 'Service not found.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_prices, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_prices, '[]'::jsonb)) > 200 then
    raise exception 'Breed prices must be a list of at most 200.' using errcode = '22023';
  end if;

  delete from public.service_breed_prices where service_id = p_service_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) loop
    insert into public.service_breed_prices (organization_id, service_id, breed, price_cents)
    values (v_org, p_service_id, btrim(v_item ->> 'breed'), (v_item ->> 'price_cents')::integer);
  end loop;
end;
$$;

revoke execute on function public.set_service_breed_prices from public, anon;
grant execute on function public.set_service_breed_prices to authenticated;

-- ---------------------------------------------------------------------
-- Visit lines: breed price first, then size, then flat.
-- ---------------------------------------------------------------------
create or replace function private.fill_visit_service()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_service public.services;
  v_size    public.pet_size;
  v_breed   text;
  v_breed_price integer;
begin
  if new.service_id is not null then
    select * into v_service from public.services
    where id = new.service_id and organization_id = new.organization_id;
    if v_service.id is null then
      raise exception 'That service isn''t on this business''s menu.' using errcode = 'P0002';
    end if;

    select v.pet_size, p.breed into v_size, v_breed
    from public.grooming_visits v join public.pets p on p.id = v.pet_id
    where v.id = new.visit_id;

    if v_breed is not null and btrim(v_breed) <> '' then
      select b.price_cents into v_breed_price from public.service_breed_prices b
      where b.service_id = v_service.id and lower(btrim(b.breed)) = lower(btrim(v_breed));
    end if;

    new.name := v_service.name;
    new.list_price_cents := case
      when v_breed_price is not null then v_breed_price
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
