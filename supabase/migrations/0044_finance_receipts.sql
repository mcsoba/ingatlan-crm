-- Blokk / számla fotója vagy PDF-je a pénzügyi tételekhez. Külön privát
-- bucket, mert a pénzügyeket csak az irodavezető (owner/admin) láthatja — az
-- általános 'attachments' bucketet minden csapattag olvassa.

insert into storage.buckets (id, name, public)
values ('finance-receipts', 'finance-receipts', false)
on conflict (id) do nothing;

create table public.finance_receipts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  invoice_id uuid not null references public.finance_invoices (id) on delete cascade,
  path text not null,
  filename text not null,
  size_bytes bigint not null,
  content_type text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index finance_receipts_invoice_idx on public.finance_receipts (invoice_id);

alter table public.finance_receipts enable row level security;

create policy "finance_receipts_manager" on public.finance_receipts for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_invoices i where i.id = invoice_id and i.agency_id = public.current_agency_id())
  );

create policy "finance_receipts_storage_select" on storage.objects for select using (
  bucket_id = 'finance-receipts'
  and (storage.foldername(name))[1] = public.current_agency_id()::text
  and public.is_finance_manager()
);
create policy "finance_receipts_storage_insert" on storage.objects for insert with check (
  bucket_id = 'finance-receipts'
  and (storage.foldername(name))[1] = public.current_agency_id()::text
  and public.is_finance_manager()
);
create policy "finance_receipts_storage_delete" on storage.objects for delete using (
  bucket_id = 'finance-receipts'
  and (storage.foldername(name))[1] = public.current_agency_id()::text
  and public.is_finance_manager()
);
