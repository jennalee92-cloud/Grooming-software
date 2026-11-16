-- Fix: inside the pets lookup, the unqualified "name" resolved to pets.name
-- (the pet's name) instead of the uploaded file's path, so every upload
-- was refused. Qualify it as objects.name.
drop policy "Pet editors can upload vet records for their pets" on storage.objects;

create policy "Pet editors can upload vet records for their pets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vaccination-records'
    and private.has_role(private.try_uuid((storage.foldername(objects.name))[1]),
      array['owner', 'admin', 'manager', 'front_desk', 'groomer']::public.member_role[])
    and exists (
      select 1 from public.pets p
      where p.id = private.try_uuid((storage.foldername(objects.name))[2])
        and p.organization_id = private.try_uuid((storage.foldername(objects.name))[1])
    )
  );
