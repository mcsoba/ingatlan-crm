-- Sztornó / helyesbítő számla összekötése az eredetivel + részletfizetés.
-- 1) finance_invoices.corrects_invoice_id: a sztornó (negatív) vagy helyesbítő számla erre az
--    eredeti tételre hivatkozik. Sztornónál mindkettő „Sztornózva” állapotú lesz.
-- 2) finance_payments: egy tételhez több befizetés (pl. a kaució két részletben). Amíg az
--    összegük nem éri el a fizetendőt, a tétel „Részben fizetve”; utána rendezett.

alter table public.finance_invoices
  add column corrects_invoice_id uuid references public.finance_invoices (id) on delete set null;

create index finance_invoices_corrects_idx on public.finance_invoices (corrects_invoice_id) where corrects_invoice_id is not null;

create table public.finance_payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  invoice_id uuid not null references public.finance_invoices (id) on delete cascade,
  paid_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'transfer' check (payment_method in ('transfer', 'card', 'cash')),
  note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index finance_payments_invoice_idx on public.finance_payments (invoice_id, paid_date);

alter table public.finance_payments enable row level security;

create policy "finance_payments_manager" on public.finance_payments for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_invoices i where i.id = invoice_id and i.agency_id = public.current_agency_id())
  );
