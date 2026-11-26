-- Adónaptár: cégenként a bevallási / befizetési kötelezettségek és a teljesítésük.
-- finance_tax_obligations: egy kötelezettség és az ütemezése (schedule):
--   'monthly:12'               → minden hónap 12-éig (az előző hónapra)
--   'fixed:03-15,09-15'        → minden évben ezeken a napokon
-- finance_tax_tasks: egy esedékesség teljesítése (bevallva / befizetve), összeggel, megjegyzéssel.
-- A nyitott esedékességeket a CRM számolja az ütemezésből; sor csak a teljesítéskor keletkezik.

create table public.finance_tax_obligations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  company_id uuid not null references public.finance_companies (id) on delete cascade,
  name text not null,
  schedule text not null check (schedule ~ '^(monthly:([1-9]|1[0-9]|2[0-8])|fixed:(0[1-9]|1[0-2])-([0-2][0-9]|3[01])(,(0[1-9]|1[0-2])-([0-2][0-9]|3[01]))*)$'),
  municipality text,
  amount numeric(14,2),
  notes text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_tax_obligations_company_idx on public.finance_tax_obligations (company_id, sort_order);

create table public.finance_tax_tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  obligation_id uuid not null references public.finance_tax_obligations (id) on delete cascade,
  due_date date not null,
  done_at date,
  amount numeric(14,2),
  note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (obligation_id, due_date)
);

alter table public.finance_tax_obligations enable row level security;
alter table public.finance_tax_tasks enable row level security;

create policy "finance_tax_obligations_manager" on public.finance_tax_obligations for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_companies c where c.id = company_id and c.agency_id = public.current_agency_id())
  );

create policy "finance_tax_tasks_manager" on public.finance_tax_tasks for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_tax_obligations o where o.id = obligation_id and o.agency_id = public.current_agency_id())
  );
