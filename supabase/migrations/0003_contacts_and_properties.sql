-- Contacts (leads/clients) and properties (listings), both scoped to the
-- owning agency the same way agencies/profiles are in 0001.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  source text not null default 'other'
    check (source in ('website', 'referral', 'phone', 'walk_in', 'other')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'inactive')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "contacts_select_own_agency" on public.contacts
  for select using (agency_id = public.current_agency_id());

create policy "contacts_insert_own_agency" on public.contacts
  for insert with check (agency_id = public.current_agency_id());

create policy "contacts_update_own_agency" on public.contacts
  for update using (agency_id = public.current_agency_id());

create policy "contacts_delete_own_agency" on public.contacts
  for delete using (agency_id = public.current_agency_id());

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  address text not null,
  price numeric,
  size_sqm numeric,
  features jsonb not null default '{}'::jsonb,
  ai_description text,
  photo_path text,
  created_at timestamptz not null default now()
);

alter table public.properties enable row level security;

create policy "properties_select_own_agency" on public.properties
  for select using (agency_id = public.current_agency_id());

create policy "properties_insert_own_agency" on public.properties
  for insert with check (agency_id = public.current_agency_id());

create policy "properties_update_own_agency" on public.properties
  for update using (agency_id = public.current_agency_id());

create policy "properties_delete_own_agency" on public.properties
  for delete using (agency_id = public.current_agency_id());

-- Property photos: one public storage bucket, writes scoped to the
-- uploader's own agency via the first path segment
-- (`<agency_id>/<property_id>/<filename>`).
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', true)
on conflict (id) do nothing;

create policy "property_photos_public_read" on storage.objects
  for select using (bucket_id = 'property-photos');

create policy "property_photos_insert_own_agency" on storage.objects
  for insert with check (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = public.current_agency_id()::text
  );

create policy "property_photos_update_own_agency" on storage.objects
  for update using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = public.current_agency_id()::text
  );

create policy "property_photos_delete_own_agency" on storage.objects
  for delete using (
    bucket_id = 'property-photos'
    and (storage.foldername(name))[1] = public.current_agency_id()::text
  );
