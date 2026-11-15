-- =====================================================================
-- Phase 2 step 4: vaccination records with expiry alerts.
--
--   * One row per shot on file: vaccine name, date given, expiry date,
--     whether the salon saw proof from a vet, and notes.
--   * A pet's current status for a vaccine is its record with the latest
--     expiry date (renewals are new rows, so the history stays).
--   * Same people who edit pets can add and fix records. Records are
--     never deleted; a mistake is marked removed. The audit log keeps
--     every change.
-- =====================================================================

create table public.pet_vaccinations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  pet_id           uuid not null,
  vaccine          text not null check (char_length(btrim(vaccine)) between 1 and 80),
  given_on         date check (given_on is null or given_on >= date '1990-01-01'),
  expires_on       date not null check (expires_on between date '1990-01-01' and date '2100-12-31'),
  verified         boolean not null default false,
  notes            text check (notes is null or char_length(notes) <= 500),
  removed_at       timestamptz,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, pet_id) references public.pets (organization_id, id) on delete restrict,
  check (given_on is null or expires_on >= given_on)
);

create index pet_vaccinations_pet_idx        on public.pet_vaccinations (organization_id, pet_id);
create index pet_vaccinations_pet_id_idx     on public.pet_vaccinations (pet_id);
create index pet_vaccinations_expiry_idx     on public.pet_vaccinations (organization_id, expires_on) where removed_at is null;
create index pet_vaccinations_created_by_idx on public.pet_vaccinations (created_by);

create function private.check_pet_vaccination()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.given_on is not null and new.given_on > current_date + 1 then
    raise exception 'The date given can''t be in the future.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger pet_vaccinations_check before insert or update on public.pet_vaccinations
  for each row execute function private.check_pet_vaccination();
create trigger pet_vaccinations_updated_at before update on public.pet_vaccinations
  for each row execute function private.set_updated_at();
create trigger pet_vaccinations_audit after insert or update or delete on public.pet_vaccinations
  for each row execute function private.audit_row_change();

revoke all on public.pet_vaccinations from anon, authenticated;
grant select on public.pet_vaccinations to authenticated;
grant insert (organization_id, pet_id, vaccine, given_on, expires_on, verified, notes)
  on public.pet_vaccinations to authenticated;
grant update (vaccine, given_on, expires_on, verified, notes, removed_at)
  on public.pet_vaccinations to authenticated;

alter table public.pet_vaccinations enable row level security;

create policy "Members can view vaccinations"
  on public.pet_vaccinations for select to authenticated
  using (private.is_member(organization_id));

create policy "Pet editors can add vaccinations"
  on public.pet_vaccinations for insert to authenticated
  with check (private.has_role(organization_id,
    array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]));

create policy "Pet editors can update vaccinations"
  on public.pet_vaccinations for update to authenticated
  using (private.has_role(organization_id,
    array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]))
  with check (private.has_role(organization_id,
    array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]));

-- ---------------------------------------------------------------------
-- Vaccines that are expired or expire within p_within_days, using each
-- pet's latest record per vaccine. Active pets and households only.
-- Runs as the caller, so it only ever sees the caller's business.
-- ---------------------------------------------------------------------
create function public.vaccines_due(p_organization_id uuid, p_within_days integer default 30)
returns table (
  pet_id uuid, pet_name text, client_id uuid, client_first_name text, client_last_name text,
  vaccine text, expires_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select cur.pet_id, cur.pet_name, cur.client_id, cur.first_name, cur.last_name, cur.vaccine, cur.expires_on
  from (
    select distinct on (v.pet_id, lower(btrim(v.vaccine)))
           v.pet_id, p.name as pet_name, p.client_id, c.first_name, c.last_name, v.vaccine, v.expires_on
    from public.pet_vaccinations v
    join public.pets p    on p.id = v.pet_id
    join public.clients c on c.id = p.client_id
    where v.organization_id = p_organization_id
      and v.removed_at is null
      and p.archived_at is null
      and c.archived_at is null
    order by v.pet_id, lower(btrim(v.vaccine)), v.expires_on desc
  ) cur
  where cur.expires_on <= current_date + greatest(least(coalesce(p_within_days, 30), 365), 0)
  order by cur.expires_on, cur.pet_name
  limit 100;
$$;

revoke execute on function public.vaccines_due from public, anon;
grant execute on function public.vaccines_due to authenticated;
