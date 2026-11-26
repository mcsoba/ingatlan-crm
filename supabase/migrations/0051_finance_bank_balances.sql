-- Havi pénzmozgás: a bankszámla tényleges egyenlege egy-egy napon (pl. a havi kivonat záró
-- egyenlege). A CRM a tételekből számolt mozgást ezekhez igazítja, és megmutatja az eltérést.
-- Később a bankkivonat-import is ide írja a kivonatok záró egyenlegét.

create table public.finance_bank_balances (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  company_id uuid not null references public.finance_companies (id) on delete cascade,
  balance_date date not null,
  balance numeric(14,2) not null,
  note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (company_id, balance_date)
);

alter table public.finance_bank_balances enable row level security;

create policy "finance_bank_balances_manager" on public.finance_bank_balances for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_companies c where c.id = company_id and c.agency_id = public.current_agency_id())
  );
