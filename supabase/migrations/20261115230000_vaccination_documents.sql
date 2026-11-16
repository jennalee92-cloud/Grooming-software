-- =====================================================================
-- Phase 2 step 4b: photos and PDFs of vet vaccination records.
--
--   * Files live in a PRIVATE storage bucket, never public. They're shown
--     through short-lived signed links.
--   * Paths are <organization_id>/<pet_id>/<random>.<ext>, and storage
--     rules check that folder layout, so a file can only be read by
--     members of that business and only added for that business's pets.
--   * public.vaccination_documents lists each file, optionally linked to
--     one vaccination record. Files are never overwritten or deleted
--     through the app; a mistake is marked removed.
-- =====================================================================

-- Text → uuid without failing on bad input (for checking folder names).
create function private.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vaccination-records', 'vaccination-records', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

create policy "Members can view their business's vet records"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vaccination-records'
    and private.is_member(private.try_uuid((storage.foldername(name))[1]))
  );

create policy "Pet editors can upload vet records for their pets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vaccination-records'
    and private.has_role(private.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[])
    and exists (
      select 1 from public.pets p
      where p.id = private.try_uuid((storage.foldername(name))[2])
        and p.organization_id = private.try_uuid((storage.foldername(name))[1])
    )
  );
-- No update or delete policies: uploaded files can't be replaced or removed by app users.

-- ---------------------------------------------------------------------
-- The list of uploaded files
-- ---------------------------------------------------------------------
create table public.vaccination_documents (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  pet_id           uuid not null,
  vaccination_id   uuid,
  storage_path     text not null unique check (char_length(storage_path) <= 300),
  file_name        text not null check (char_length(btrim(file_name)) between 1 and 200),
  content_type     text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf')),
  size_bytes       integer not null check (size_bytes between 1 and 10485760),
  removed_at       timestamptz,
  uploaded_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, pet_id)         references public.pets (organization_id, id) on delete restrict,
  foreign key (organization_id, vaccination_id) references public.pet_vaccinations (organization_id, id) on delete restrict,
  -- the file must sit in this business's and this pet's folder
  check (storage_path like organization_id::text || '/' || pet_id::text || '/%')
);

create index vaccination_documents_pet_idx         on public.vaccination_documents (organization_id, pet_id);
create index vaccination_documents_pet_id_idx      on public.vaccination_documents (pet_id);
create index vaccination_documents_vaccination_idx on public.vaccination_documents (organization_id, vaccination_id);
create index vaccination_documents_uploaded_by_idx on public.vaccination_documents (uploaded_by);

-- A linked vaccination record must belong to the same pet.
create function private.check_vaccination_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.vaccination_id is not null and not exists (
    select 1 from public.pet_vaccinations v where v.id = new.vaccination_id and v.pet_id = new.pet_id
  ) then
    raise exception 'That vaccination record belongs to a different pet.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger vaccination_documents_check before insert on public.vaccination_documents
  for each row execute function private.check_vaccination_document();
create trigger vaccination_documents_audit after insert or update or delete on public.vaccination_documents
  for each row execute function private.audit_row_change();

revoke all on public.vaccination_documents from anon, authenticated;
grant select on public.vaccination_documents to authenticated;
grant insert (organization_id, pet_id, vaccination_id, storage_path, file_name, content_type, size_bytes)
  on public.vaccination_documents to authenticated;
grant update (removed_at) on public.vaccination_documents to authenticated;

alter table public.vaccination_documents enable row level security;

create policy "Members can view vet record files"
  on public.vaccination_documents for select to authenticated
  using (private.is_member(organization_id));

-- Only for a file that was actually uploaded (the storage rules above
-- already checked who uploaded it and where).
create policy "Pet editors can list uploaded vet records"
  on public.vaccination_documents for insert to authenticated
  with check (
    private.has_role(organization_id, array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[])
    and uploaded_by = (select auth.uid())
    and exists (select 1 from storage.objects o where o.bucket_id = 'vaccination-records' and o.name = storage_path)
  );

create policy "Pet editors can mark vet records removed"
  on public.vaccination_documents for update to authenticated
  using (private.has_role(organization_id, array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]))
  with check (private.has_role(organization_id, array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[]));
