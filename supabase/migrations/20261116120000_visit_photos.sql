-- =====================================================================
-- Before and after photos on grooming visits.
--
--   * Files live in a PRIVATE storage bucket, shown through short-lived
--     signed links. Paths are <organization_id>/<pet_id>/<random>.<ext>.
--   * Any active member can add photos (the same people who record
--     visits), only for their own business's pets.
--   * Files are never overwritten or deleted through the app. A photo
--     added by mistake is marked removed, by the person who added it or
--     by an owner, admin or manager.
--   * Photos belong to the visit version they were added to; the app
--     shows a visit's photos across all of its corrected versions.
-- =====================================================================

create type public.visit_photo_kind as enum ('before', 'after', 'other');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos', 'visit-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "Members can view their business's visit photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'visit-photos'
    and private.is_member(private.try_uuid((storage.foldername(objects.name))[1]))
  );

create policy "Members can upload visit photos for their pets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'visit-photos'
    and private.is_member(private.try_uuid((storage.foldername(objects.name))[1]))
    and exists (
      select 1 from public.pets p
      where p.id = private.try_uuid((storage.foldername(objects.name))[2])
        and p.organization_id = private.try_uuid((storage.foldername(objects.name))[1])
    )
  );

create table public.visit_photos (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  pet_id           uuid not null,
  visit_id         uuid not null,
  kind             public.visit_photo_kind not null default 'other',
  storage_path     text not null unique check (char_length(storage_path) <= 300),
  content_type     text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  size_bytes       integer not null check (size_bytes between 1 and 10485760),
  removed_at       timestamptz,
  uploaded_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, pet_id)   references public.pets (organization_id, id) on delete restrict,
  foreign key (organization_id, visit_id) references public.grooming_visits (organization_id, id) on delete restrict,
  check (storage_path like organization_id::text || '/' || pet_id::text || '/%')
);

create index visit_photos_pet_idx         on public.visit_photos (organization_id, pet_id);
create index visit_photos_pet_id_idx      on public.visit_photos (pet_id);
create index visit_photos_visit_idx       on public.visit_photos (organization_id, visit_id);
create index visit_photos_visit_id_idx    on public.visit_photos (visit_id);
create index visit_photos_uploaded_by_idx on public.visit_photos (uploaded_by);

-- The visit must be for the same pet.
create function private.check_visit_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.grooming_visits v where v.id = new.visit_id and v.pet_id = new.pet_id) then
    raise exception 'That visit is for a different pet.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger visit_photos_check before insert on public.visit_photos
  for each row execute function private.check_visit_photo();
create trigger visit_photos_audit after insert or update or delete on public.visit_photos
  for each row execute function private.audit_row_change();

revoke all on public.visit_photos from anon, authenticated;
grant select on public.visit_photos to authenticated;
grant insert (organization_id, pet_id, visit_id, kind, storage_path, content_type, size_bytes)
  on public.visit_photos to authenticated;
grant update (removed_at) on public.visit_photos to authenticated;

alter table public.visit_photos enable row level security;

create policy "Members can view visit photos"
  on public.visit_photos for select to authenticated
  using (private.is_member(organization_id));

create policy "Members can list photos they uploaded"
  on public.visit_photos for insert to authenticated
  with check (
    private.is_member(organization_id)
    and uploaded_by = (select auth.uid())
    and exists (select 1 from storage.objects o where o.bucket_id = 'visit-photos' and o.name = storage_path)
  );

create policy "Uploaders and managers can mark photos removed"
  on public.visit_photos for update to authenticated
  using (
    private.is_member(organization_id)
    and (uploaded_by = (select auth.uid())
         or private.has_role(organization_id, array['owner', 'admin', 'manager']::public.member_role[]))
  )
  with check (private.is_member(organization_id));
