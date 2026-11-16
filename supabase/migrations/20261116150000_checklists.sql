-- =====================================================================
-- Phase 2 step 5: cleaning, sanitation and maintenance checklists.
--
--   * Each salon builds its own checklists (owners, admins, managers):
--     daily, weekly or monthly, for one location or all of them.
--   * Tasks are retired, never deleted, so past records keep their wording.
--   * Staff tick tasks off for the current day/week/month at a location
--     they work at. Each tick records who and when. Unticking is allowed
--     (by the person who ticked it, or a manager); the audit log keeps it.
-- =====================================================================

create type public.checklist_frequency as enum ('daily', 'weekly', 'monthly');

create table public.checklists (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  location_id      uuid, -- null = every location
  name             text not null check (char_length(btrim(name)) between 1 and 120),
  description      text check (description is null or char_length(description) <= 500),
  frequency        public.checklist_frequency not null default 'daily',
  position         smallint not null default 0 check (position between 0 and 999),
  archived_at      timestamptz,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, location_id) references public.locations (organization_id, id) on delete restrict
);

create table public.checklist_tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  checklist_id     uuid not null,
  label            text not null check (char_length(btrim(label)) between 1 and 200),
  details          text check (details is null or char_length(details) <= 500),
  position         smallint not null default 0 check (position between 0 and 999),
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, checklist_id) references public.checklists (organization_id, id) on delete restrict
);

create table public.checklist_checks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  task_id          uuid not null,
  location_id      uuid not null,
  -- the day, the Monday of the week, or the 1st of the month
  period_start     date not null,
  note             text check (note is null or char_length(note) <= 300),
  checked_by       uuid references auth.users (id) on delete set null default auth.uid(),
  checked_at       timestamptz not null default now(),
  foreign key (organization_id, task_id)     references public.checklist_tasks (organization_id, id) on delete restrict,
  foreign key (organization_id, location_id) references public.locations (organization_id, id) on delete restrict,
  -- recent periods only: no backfilling old records
  check (period_start between date '2020-01-01' and date '2100-01-01')
);

create unique index checklist_checks_once_idx on public.checklist_checks (task_id, location_id, period_start);
create index checklists_org_idx              on public.checklists (organization_id, position);
create index checklists_location_idx         on public.checklists (organization_id, location_id);
create index checklists_created_by_idx       on public.checklists (created_by);
create index checklist_tasks_list_idx        on public.checklist_tasks (organization_id, checklist_id, position);
create index checklist_tasks_checklist_idx   on public.checklist_tasks (checklist_id);
create index checklist_checks_period_idx     on public.checklist_checks (organization_id, location_id, period_start);
create index checklist_checks_task_idx       on public.checklist_checks (organization_id, task_id);
create index checklist_checks_location_idx   on public.checklist_checks (organization_id, location_id);
create index checklist_checks_checked_by_idx on public.checklist_checks (checked_by);

-- A tick must be for the current period, for a live task whose checklist
-- applies at that location. The current period allows a day either side
-- for time zones.
create function private.check_checklist_tick()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_freq text;
  v_list_location uuid;
  v_unit text;
  v_yesterday date := current_date - 1;
begin
  select c.frequency::text, c.location_id into v_freq, v_list_location
  from public.checklist_tasks t join public.checklists c on c.id = t.checklist_id
  where t.id = new.task_id and t.archived_at is null and c.archived_at is null;

  if v_freq is null then
    raise exception 'That task is no longer on a checklist.' using errcode = 'P0002';
  end if;
  if v_list_location is not null and v_list_location <> new.location_id then
    raise exception 'That checklist is for a different location.' using errcode = '22023';
  end if;

  if v_freq = 'weekly' then
    v_unit := 'week';
  elsif v_freq = 'monthly' then
    v_unit := 'month';
  else
    v_unit := 'day';
  end if;

  if new.period_start <> date_trunc(v_unit, new.period_start)::date
     or new.period_start > current_date + 1
     or new.period_start < date_trunc(v_unit, v_yesterday)::date then
    raise exception 'Tasks can only be ticked for the current day, week or month.' using errcode = '22023';
  end if;
  return new;
end;
$fn$;

create trigger checklist_checks_check before insert on public.checklist_checks
  for each row execute function private.check_checklist_tick();

create trigger checklists_updated_at before update on public.checklists
  for each row execute function private.set_updated_at();
create trigger checklist_tasks_updated_at before update on public.checklist_tasks
  for each row execute function private.set_updated_at();
create trigger checklists_audit after insert or update or delete on public.checklists
  for each row execute function private.audit_row_change();
create trigger checklist_tasks_audit after insert or update or delete on public.checklist_tasks
  for each row execute function private.audit_row_change();
create trigger checklist_checks_audit after insert or update or delete on public.checklist_checks
  for each row execute function private.audit_row_change();

-- ---------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------
revoke all on public.checklists, public.checklist_tasks, public.checklist_checks from anon, authenticated;
grant select on public.checklists, public.checklist_tasks, public.checklist_checks to authenticated;

grant insert (organization_id, location_id, name, description, frequency, position) on public.checklists to authenticated;
grant update (location_id, name, description, frequency, position, archived_at) on public.checklists to authenticated;
grant insert (organization_id, checklist_id, label, details, position) on public.checklist_tasks to authenticated;
grant update (label, details, position, archived_at) on public.checklist_tasks to authenticated;
grant insert (organization_id, task_id, location_id, period_start, note) on public.checklist_checks to authenticated;
grant delete on public.checklist_checks to authenticated;

alter table public.checklists       enable row level security;
alter table public.checklist_tasks  enable row level security;
alter table public.checklist_checks enable row level security;

create policy "Members can view checklists" on public.checklists for select to authenticated
  using (private.is_member(organization_id));
create policy "Managers can add checklists" on public.checklists for insert to authenticated
  with check (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]));
create policy "Managers can change checklists" on public.checklists for update to authenticated
  using (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]))
  with check (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]));

create policy "Members can view checklist tasks" on public.checklist_tasks for select to authenticated
  using (private.is_member(organization_id));
create policy "Managers can add checklist tasks" on public.checklist_tasks for insert to authenticated
  with check (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]));
create policy "Managers can change checklist tasks" on public.checklist_tasks for update to authenticated
  using (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]))
  with check (private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]));

create policy "Members can view ticks" on public.checklist_checks for select to authenticated
  using (private.is_member(organization_id));
create policy "Staff can tick tasks at their locations" on public.checklist_checks for insert to authenticated
  with check (
    private.can_access_location(organization_id, location_id)
    and checked_by = (select auth.uid())
  );
create policy "Tickers and managers can untick" on public.checklist_checks for delete to authenticated
  using (
    private.can_access_location(organization_id, location_id)
    and (checked_by = (select auth.uid())
         or private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]))
  );

-- ---------------------------------------------------------------------
-- Save a checklist and its tasks in one step (managers).
-- p_tasks: [{"id": uuid|null, "label": text, "details": text|null}, ...]
-- Listed tasks are kept/added in that order; tasks left out are retired.
-- Runs as the caller, so the rules above apply.
-- ---------------------------------------------------------------------
create function public.save_checklist(
  p_organization_id uuid,
  p_checklist_id    uuid,
  p_name            text,
  p_description     text,
  p_frequency       public.checklist_frequency,
  p_location_id     uuid,
  p_tasks           jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id   uuid := p_checklist_id;
  v_task jsonb;
  v_pos  int := 0;
  v_keep uuid[] := '{}';
  v_task_id uuid;
begin
  if jsonb_typeof(coalesce(p_tasks, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_tasks, '[]'::jsonb)) = 0 then
    raise exception 'Add at least one task.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_tasks) > 100 then
    raise exception 'A checklist can have at most 100 tasks.' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.checklists (organization_id, location_id, name, description, frequency)
    values (p_organization_id, p_location_id, btrim(p_name), nullif(btrim(p_description), ''), p_frequency)
    returning id into v_id;
  else
    update public.checklists
    set location_id = p_location_id, name = btrim(p_name), description = nullif(btrim(p_description), ''), frequency = p_frequency
    where id = v_id and organization_id = p_organization_id;
    if not found then
      raise exception 'Checklist not found, or your role can''t change it.' using errcode = 'P0002';
    end if;
  end if;

  for v_task in select * from jsonb_array_elements(p_tasks) loop
    v_task_id := nullif(v_task ->> 'id', '')::uuid;
    if v_task_id is not null then
      update public.checklist_tasks
      set label = btrim(v_task ->> 'label'), details = nullif(btrim(v_task ->> 'details'), ''), position = v_pos, archived_at = null
      where id = v_task_id and checklist_id = v_id;
      if not found then v_task_id := null; end if;
    end if;
    if v_task_id is null then
      insert into public.checklist_tasks (organization_id, checklist_id, label, details, position)
      values (p_organization_id, v_id, btrim(v_task ->> 'label'), nullif(btrim(v_task ->> 'details'), ''), v_pos)
      returning id into v_task_id;
    end if;
    v_keep := v_keep || v_task_id;
    v_pos := v_pos + 1;
  end loop;

  update public.checklist_tasks set archived_at = now()
  where checklist_id = v_id and archived_at is null and not (id = any (v_keep));

  return v_id;
end;
$$;

revoke execute on function public.save_checklist from public, anon;
grant execute on function public.save_checklist to authenticated;
