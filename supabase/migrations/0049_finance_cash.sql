-- Pénztár: kinél mennyi készpénz van.
-- 1) Minden készpénzes tételnél (kp felvétel / befizetés, készpénzes kiadás vagy bevétel)
--    megadható, kinél van / ki fizette: finance_invoices.cash_person_id (a cég munkatársai közül).
-- 2) Készpénz átadása két személy között (pl. „Ferinek adtam 100 000-et tankolásra”):
--    finance_cash_transfers. Ha az egyik oldal üres: a pénz a nyilvántartáson kívülről jön
--    (pl. saját pénzéből tette be) vagy oda megy (pl. visszaadta, elszámolva).
-- Egyenleg személyenként = felvett + kapott + készpénzes bevétel − készpénzes kiadás − befizetett − átadott.

alter table public.finance_invoices
  add column cash_person_id uuid references public.finance_company_people (id) on delete set null;

create index finance_invoices_cash_person_idx on public.finance_invoices (cash_person_id) where cash_person_id is not null;

create table public.finance_cash_transfers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  company_id uuid not null references public.finance_companies (id) on delete cascade,
  transfer_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'HUF' check (currency in ('HUF', 'EUR')),
  from_person_id uuid references public.finance_company_people (id) on delete restrict,
  to_person_id uuid references public.finance_company_people (id) on delete restrict,
  note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_person_id is not null or to_person_id is not null),
  check (from_person_id is distinct from to_person_id)
);

create index finance_cash_transfers_company_idx on public.finance_cash_transfers (company_id, transfer_date desc);

alter table public.finance_cash_transfers enable row level security;

create policy "finance_cash_transfers_manager" on public.finance_cash_transfers for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_companies c where c.id = company_id and c.agency_id = public.current_agency_id())
  );
