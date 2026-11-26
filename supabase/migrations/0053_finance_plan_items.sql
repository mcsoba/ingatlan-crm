-- Havi költségterv: kézzel felvett várható bevételek / kiadások egy hónapra (pl. „iroda kauciója”),
-- amelyekhez még nincs számla vagy törzs. A terv többi része a meglévő tételekből, törzsekből
-- és az adónaptárból számolódik.

create table public.finance_plan_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  company_id uuid not null references public.finance_companies (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  kind text not null check (kind in ('income', 'expense')),
  description text not null,
  counterparty text,
  amount numeric(14,2) not null check (amount > 0),
  expected_date date,
  note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index finance_plan_items_company_idx on public.finance_plan_items (company_id, month);

alter table public.finance_plan_items enable row level security;

create policy "finance_plan_items_manager" on public.finance_plan_items for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_companies c where c.id = company_id and c.agency_id = public.current_agency_id())
  );
