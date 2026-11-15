-- =====================================================================
-- Phase 2 step 2: grooming visit history.
--
-- Append-only
--   * Visits can be added but never edited or deleted through the API
--     (no UPDATE or DELETE privileges at all).
--   * A mistake is fixed by inserting a correction: a new row that points
--     at the visit it replaces (corrects_visit_id) with a reason. Each
--     visit can be corrected once, so versions form a single chain. The
--     newest row in a chain is the current version.
--   * A correction can mark the visit as removed (voided), for example
--     when it was recorded on the wrong pet. The history stays.
--
-- Access
--   * Every active member of the business can read visit history.
--   * Any active member can record a visit, at a location they can access.
--   * Corrections: the person who recorded the visit, or an owner, admin
--     or manager.
--   * created_by is always the signed-in user; it can't be supplied.
-- =====================================================================

create type public.visit_behavior as enum ('great', 'good', 'some_trouble', 'difficult');

create table public.grooming_visits (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete restrict,
  location_id         uuid not null,
  pet_id              uuid not null,
  visited_on          date not null check (visited_on >= date '1990-01-01'),
  groomer_member_id   uuid,
  services            text check (services is null or char_length(services) <= 300),
  cut_details         text check (cut_details is null or char_length(cut_details) <= 2000),
  behavior            public.visit_behavior,
  weight_lbs          numeric(5,1) check (weight_lbs is null or (weight_lbs > 0 and weight_lbs < 400)),
  notes               text check (notes is null or char_length(notes) <= 4000),
  corrects_visit_id   uuid,
  correction_reason   text check (correction_reason is null or char_length(btrim(correction_reason)) between 1 and 500),
  voided              boolean not null default false,
  created_by          uuid references auth.users (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, location_id)       references public.locations (organization_id, id) on delete restrict,
  foreign key (organization_id, pet_id)            references public.pets (organization_id, id) on delete restrict,
  foreign key (organization_id, groomer_member_id) references public.organization_members (organization_id, id) on delete restrict,
  foreign key (organization_id, corrects_visit_id) references public.grooming_visits (organization_id, id) on delete restrict,
  -- a correction always says why; only a correction can remove a visit
  check ((corrects_visit_id is null) = (correction_reason is null)),
  check (not voided or corrects_visit_id is not null)
);

-- Each version can be corrected once, so a visit's versions form one chain.
create unique index grooming_visits_one_correction_idx on public.grooming_visits (corrects_visit_id)
  where corrects_visit_id is not null;

create index grooming_visits_pet_idx        on public.grooming_visits (organization_id, pet_id, visited_on desc);
create index grooming_visits_pet_id_idx     on public.grooming_visits (pet_id);
create index grooming_visits_org_day_idx    on public.grooming_visits (organization_id, visited_on);
create index grooming_visits_location_idx   on public.grooming_visits (organization_id, location_id);
create index grooming_visits_groomer_idx    on public.grooming_visits (organization_id, groomer_member_id);
create index grooming_visits_corrects_idx   on public.grooming_visits (organization_id, corrects_visit_id);
create index grooming_visits_created_by_idx on public.grooming_visits (created_by);

-- Checks that need other rows: dates, and who may correct what.
create function private.check_grooming_visit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_original public.grooming_visits;
begin
  if new.visited_on > current_date + 1 then
    raise exception 'A visit date can''t be in the future.' using errcode = '22023';
  end if;

  if new.corrects_visit_id is not null then
    select * into v_original from public.grooming_visits where id = new.corrects_visit_id;

    if v_original.id is null then
      raise exception 'Visit not found.' using errcode = 'P0002';
    end if;
    if v_original.pet_id <> new.pet_id then
      raise exception 'A correction must be for the same pet.' using errcode = '22023';
    end if;
    if v_original.voided then
      raise exception 'This visit was removed, so it can''t be corrected again.' using errcode = 'P0001';
    end if;
    if v_original.created_by is distinct from (select auth.uid())
       and not private.has_role(new.organization_id, array['owner', 'admin', 'manager']::public.member_role[]) then
      raise exception 'Only the person who recorded a visit, or an owner, admin or manager, can correct it.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger grooming_visits_check before insert on public.grooming_visits
  for each row execute function private.check_grooming_visit();

create trigger grooming_visits_audit after insert or update or delete on public.grooming_visits
  for each row execute function private.audit_row_change();

-- ---------------------------------------------------------------------
-- Privileges: read and insert only.
-- ---------------------------------------------------------------------
revoke all on public.grooming_visits from anon, authenticated;
grant select on public.grooming_visits to authenticated;
grant insert (organization_id, location_id, pet_id, visited_on, groomer_member_id, services, cut_details,
              behavior, weight_lbs, notes, corrects_visit_id, correction_reason, voided)
  on public.grooming_visits to authenticated;

alter table public.grooming_visits enable row level security;

create policy "Members can view visit history"
  on public.grooming_visits for select to authenticated
  using (private.is_member(organization_id));

create policy "Members can record visits at their locations"
  on public.grooming_visits for insert to authenticated
  with check (
    private.can_access_location(organization_id, location_id)
    and created_by = (select auth.uid())
  );
