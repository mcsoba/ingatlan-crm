-- Iroda-szintű branding: logó-feltöltés + előre definiált accent-szín
-- preset, megjelenítve a publikus ingatlan-oldalon (/p/[propertyId]) és a
-- Beállítások oldalon. Csak a tulajdonos módosíthatja, ugyanaz a mintázat
-- mint az agencies_update_owner policy-nál (0001).

alter table public.agencies
  add column logo_path text,
  add column accent_preset text not null default 'indigo';

insert into storage.buckets (id, name, public)
values ('agency-logos', 'agency-logos', true)
on conflict (id) do nothing;

create policy "agency_logos_public_read" on storage.objects
  for select using (bucket_id = 'agency-logos');

create policy "agency_logos_insert_own_agency_owner" on storage.objects
  for insert with check (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = public.current_agency_id()::text
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "agency_logos_update_own_agency_owner" on storage.objects
  for update using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = public.current_agency_id()::text
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "agency_logos_delete_own_agency_owner" on storage.objects
  for delete using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] = public.current_agency_id()::text
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'owner'
    )
  );
