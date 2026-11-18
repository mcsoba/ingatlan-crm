-- Cég-adatlap: a „Worker Base info” Excel-lap kiváltása. Bővebb cégadatok
-- (cégjegyzékszám, IBAN, SWIFT, iroda, elérhetőség), a céghez tartozó
-- személyek (ügyvezető, tag, könyvelő, munkatárs — CRM-felhasználó vagy külsős)
-- és dokumentumok / fotók (cégkivonat, aláírási címpéldány, székhely fotója).
-- JELSZAVAKAT SZÁNDÉKOSAN NEM tárolunk — azok jelszókezelőbe valók.

alter table public.finance_companies
  add column registration_number text,   -- cégjegyzékszám
  add column eu_vat_number text,         -- közösségi adószám
  add column founded_date date,
  add column main_activity text,         -- fő tevékenység (TEÁOR)
  add column office_address text,        -- iroda / telephely, ha eltér a székhelytől
  add column mailing_address text,       -- levelezési cím
  add column bank_name text,
  add column iban text,
  add column swift text,
  add column email text,
  add column phone text,
  add column website text,
  add column accountant text,            -- könyvelő (cég / személy, elérhetőség)
  add column notes text;

-- A céghez tartozó személyek. A személyes adatok (születési adatok, anyja neve,
-- lakcím, adóazonosító) csak az irodavezetőnek látszanak.
create table public.finance_company_people (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  company_id uuid not null references public.finance_companies (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,  -- ha CRM-felhasználó
  name text not null,
  role text not null default 'employee' check (role in ('director', 'owner', 'employee', 'accountant', 'other')),
  position text,           -- beosztás szövegesen (pl. „értékesítési vezető”)
  email text,
  phone text,
  birth_name text,
  birth_place text,
  birth_date date,
  mother_name text,
  address text,
  tax_id text,             -- adóazonosító jel
  ownership_percent numeric(5,2) check (ownership_percent is null or (ownership_percent >= 0 and ownership_percent <= 100)),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_company_people_company_idx on public.finance_company_people (company_id, name);

create table public.finance_company_files (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  company_id uuid not null references public.finance_companies (id) on delete cascade,
  path text not null,
  filename text not null,
  size_bytes bigint not null,
  content_type text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index finance_company_files_company_idx on public.finance_company_files (company_id);

alter table public.finance_company_people enable row level security;
alter table public.finance_company_files enable row level security;

create policy "finance_company_people_manager" on public.finance_company_people for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_companies c where c.id = company_id and c.agency_id = public.current_agency_id())
    and (profile_id is null or exists (select 1 from public.profiles p where p.id = profile_id and p.agency_id = public.current_agency_id()))
  );

create policy "finance_company_files_manager" on public.finance_company_files for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and exists (select 1 from public.finance_companies c where c.id = company_id and c.agency_id = public.current_agency_id())
  );

-- A fájlok a már meglévő privát 'finance-receipts' tárhelyre kerülnek
-- (<iroda>/companies/<cég>/...), annak szabályai (csak irodavezető) érvényesek.
