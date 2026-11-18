-- Partnerek és szállások (a „WB ingatlan” Excel-lap kiváltása).
-- Partner: akitől bérelünk (bérbeadó) vagy akinek továbbadjuk (bérlő cég) —
-- itt van nyilvántartva az adószám, bankszámla, cím, kapcsolattartó, így a
-- számlákon nem kell újra begépelni. Szállás: egy bérelt ingatlan a bérleti
-- (bejövő) és a továbbadási (kimenő) szerződés adataival, kaucióval, létszámmal.
-- Csak owner/admin (irodavezető) látja, mint a többi pénzügyi táblát.

create table public.finance_partners (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  kind text not null default 'company' check (kind in ('company', 'person')),
  is_landlord boolean not null default false,
  is_tenant boolean not null default false,
  tax_number text,
  address text,
  bank_account text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_lodgings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- Melyik saját cégünk béreli / adja tovább
  company_id uuid references public.finance_companies (id) on delete set null,
  address text not null,
  area_sqm numeric(10,2),
  capacity int check (capacity is null or capacity >= 0),
  occupants int check (occupants is null or occupants >= 0),

  -- Bérlés (bejövő): a bérbeadótól
  landlord_id uuid references public.finance_partners (id) on delete set null,
  lease_signed_date date,
  lease_handover_date date,
  lease_start date,
  lease_end date,
  lease_fee numeric(14,2) check (lease_fee is null or lease_fee >= 0),
  lease_frequency text not null default 'monthly' check (lease_frequency in ('monthly', 'quarterly', 'yearly')),
  lease_deposit numeric(14,2) check (lease_deposit is null or lease_deposit >= 0),
  lease_includes text,
  lease_terms text,
  lease_extension text,

  -- Továbbadás (kimenő): a bérlő cégnek
  tenant_id uuid references public.finance_partners (id) on delete set null,
  sublease_signed_date date,
  sublease_start date,
  sublease_end date,
  sublease_fee numeric(14,2) check (sublease_fee is null or sublease_fee >= 0),
  sublease_frequency text not null default 'monthly' check (sublease_frequency in ('monthly', 'quarterly', 'yearly')),
  sublease_deposit numeric(14,2) check (sublease_deposit is null or sublease_deposit >= 0),
  sublease_includes text,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lease_end is null or lease_start is null or lease_end >= lease_start),
  check (sublease_end is null or sublease_start is null or sublease_end >= sublease_start)
);

create index finance_partners_agency_idx on public.finance_partners (agency_id, name);
create index finance_lodgings_agency_idx on public.finance_lodgings (agency_id, address);

-- Számlák és törzsek kapcsolása partnerhez / szálláshoz (a régi szöveges mezők maradnak)
alter table public.finance_invoices
  add column partner_id uuid references public.finance_partners (id) on delete set null,
  add column lodging_id uuid references public.finance_lodgings (id) on delete set null;
alter table public.finance_schedules
  add column partner_id uuid references public.finance_partners (id) on delete set null,
  add column lodging_id uuid references public.finance_lodgings (id) on delete set null;

create index finance_invoices_partner_idx on public.finance_invoices (partner_id);
create index finance_invoices_lodging_idx on public.finance_invoices (lodging_id);
create index finance_schedules_lodging_idx on public.finance_schedules (lodging_id);

alter table public.finance_partners enable row level security;
alter table public.finance_lodgings enable row level security;

create policy "finance_partners_manager" on public.finance_partners for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (agency_id = public.current_agency_id() and public.is_finance_manager());

create policy "finance_lodgings_manager" on public.finance_lodgings for all
  using (agency_id = public.current_agency_id() and public.is_finance_manager())
  with check (
    agency_id = public.current_agency_id() and public.is_finance_manager()
    and (landlord_id is null or exists (select 1 from public.finance_partners p where p.id = landlord_id and p.agency_id = public.current_agency_id()))
    and (tenant_id is null or exists (select 1 from public.finance_partners p where p.id = tenant_id and p.agency_id = public.current_agency_id()))
  );
