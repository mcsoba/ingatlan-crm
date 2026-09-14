-- Multi-photo gallery per property, replacing the single photo_path
-- column. Existing single photos are backfilled as position 0.

create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index property_photos_property_idx
  on public.property_photos (property_id, position);

alter table public.property_photos enable row level security;

create policy "property_photos_select_own_agency" on public.property_photos
  for select using (agency_id = public.current_agency_id());

create policy "property_photos_insert_own_agency" on public.property_photos
  for insert with check (agency_id = public.current_agency_id());

create policy "property_photos_update_own_agency" on public.property_photos
  for update using (agency_id = public.current_agency_id());

create policy "property_photos_delete_own_agency" on public.property_photos
  for delete using (agency_id = public.current_agency_id());

insert into public.property_photos (agency_id, property_id, path, position)
select agency_id, id, photo_path, 0
from public.properties
where photo_path is not null;

alter table public.properties drop column photo_path;
