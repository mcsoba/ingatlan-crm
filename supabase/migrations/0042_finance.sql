-- Pénzügyek: több cég (pl. egy irodán belül 3 kft.) számlái, díjbekérői és
-- egyéb pénzmozgásai (bér, adó, bankköltség, készpénz, tagi kölcsön), valamint
-- ismétlődő „számla-törzsek”, amelyekből a rendszer előre jelzi és létrehozza
-- a kiállítandó / várható tételeket. Csak owner/admin (irodavezető) látja.

create table public.finance_companies (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  tax_number text,
  address text,
  bank_account text,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.finance_schedules (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  company_id uuid not null references public.finance_companies (id) on delete cascade,
  direction text not null check (direction in ('out', 'in')),
  doc_type text not null default 'invoice' check (doc_type in ('invoice', 'proforma', 'none')),
  category text not null default 'rent',
  counterparty_name text not null,
  counterparty_tax_number text,
  contact_id uuid references public.contacts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  location text,
  description text not null,
  currency text not null default 'HUF' check (currency in ('HUF', 'EUR')),
  net_amount numeric(14,2) not null check (net_amount >= 0),
  vat_rate numeric(5,2),
  szja_withheld boolean not null default false,
  payment_method text not null default 'transfer' check (payment_method in ('transfer', 'card', 'cash')),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly', 'yearly', 'once')),
  start_date date not null,
  end_date date,
  issue_day int not null default 1 check (issue_day between 1 and 28),
  payment_days int not null default 8 check (payment_days between 0 and 120),
  prorate boolean not null default true,
  lead_days int not null default 7 check (lead_days between 0 and 60),
  active boolean not null default true,
  -- A következő, még létre nem hozott időszak kezdete (a generálás kurzora):
  -- így egy kézzel törölt tétel nem jön vissza.
  next_period_start date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table public.finance_invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  company_id uuid not null references public.finance_companies (id) on delete cascade,
  schedule_id uuid references public.finance_schedules (id) on delete set null,
  direction text not null check (direction in ('out', 'in')),
  doc_type text not null default 'invoice' check (doc_type in ('invoice', 'proforma', 'none')),
  category text not null default 'other',
  -- Törzsből előre létrehozott, még ki nem állított (kimenő) / meg nem érkezett (bejövő) tétel
  is_planned boolean not null default false,
  invoice_number text,
  counterparty_name text not null,
  counterparty_tax_number text,
  contact_id uuid references public.contacts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  location text,
  description text not null,
  period_start date,
  period_end date,
  issue_date date not null,
  fulfillment_date date,
  due_date date,
  paid_date date,
  bank_booked_date date,
  payment_method text not null default 'transfer' check (payment_method in ('transfer', 'card', 'cash')),
  currency text not null default 'HUF' check (currency in ('HUF', 'EUR')),
  net_amount numeric(14,2) not null default 0,
  vat_rate numeric(5,2),
  vat_amount numeric(14,2) not null default 0,
  gross_amount numeric(14,2) not null default 0,
  szja_withheld boolean not null default false,
  paid_amount numeric(14,2),
  notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, period_start)
);

create index finance_invoices_agency_issue_idx on public.finance_invoices (agency_id, issue_date desc);
create index finance_invoices_company_idx on public.finance_invoices (company_id);
create index finance_schedules_agency_idx on public.finance_schedules (agency_id);

alter table public.finance_companies enable row level security;
alter table public.finance_schedules enable row level security;
alter table public.finance_invoices enable row level security;

create or replace function public.is_finance_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin'));
$$;

create policy "finance_companies_manager" on public.finance_companies for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (agency_id = public.current_agency_id() and public.is_finance_manager());

create policy "finance_schedules_manager" on public.finance_schedules for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_companies c where c.id = company_id and c.agency_id = public.current_agency_id())
  );

create policy "finance_invoices_manager" on public.finance_invoices for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_companies c where c.id = company_id and c.agency_id = public.current_agency_id())
  );
