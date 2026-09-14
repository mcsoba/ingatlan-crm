-- Fájlcsatolás dealekhez/kontaktokhoz (szerződések, dokumentumok).
-- Privát storage bucket (NEM publikus, ellentétben a property-photos-szal),
-- signed URL-lel tölthető le, agency_id szerint RLS-elve.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  path text not null,
  filename text not null,
  size_bytes bigint not null,
  content_type text,
  created_at timestamptz not null default now()
);

create index attachments_contact_idx on public.attachments (contact_id);
create index attachments_deal_idx on public.attachments (deal_id);

alter table public.attachments enable row level security;

create policy "attachments_select_own_agency" on public.attachments
  for select using (agency_id = public.current_agency_id());

create policy "attachments_insert_own_agency" on public.attachments
  for insert with check (agency_id = public.current_agency_id());

create policy "attachments_delete_own_agency" on public.attachments
  for delete using (agency_id = public.current_agency_id());

create policy "attachments_storage_select_own_agency" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_agency_id()::text
  );

create policy "attachments_storage_insert_own_agency" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_agency_id()::text
  );

create policy "attachments_storage_delete_own_agency" on storage.objects
  for delete using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_agency_id()::text
  );
