-- Bér, járulék, adók (a „Bér, járulék, adók” Excel-lap kiváltása).
-- A havi bér- és adótételek ugyanúgy pénzügyi tételek (finance_invoices),
-- mint minden más kiadás — így az áttekintésben, a havi pénzmozgásban és a
-- listákban is megjelennek. Két új mező jelöli őket:
--   payroll_kind: wage (munkabér), efo, car_tax (cégautó adó), szja, szocho, tb, other_tax
--   person_id:    munkabérnél a cég munkatársa (Cégek → személyek)
-- Egy cégnél egy hónapban fajtánként (és munkatársanként) egy tétel lehet.

alter table public.finance_invoices
  add column payroll_kind text check (payroll_kind is null or payroll_kind in ('wage', 'efo', 'car_tax', 'szja', 'szocho', 'tb', 'other_tax')),
  add column person_id uuid references public.finance_company_people (id) on delete restrict;  -- bérrel rendelkező személy nem törölhető (inkább kilépés dátuma)

create unique index finance_invoices_payroll_unique
  on public.finance_invoices (company_id, period_start, payroll_kind, coalesce(person_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where payroll_kind is not null;

create index finance_invoices_person_idx on public.finance_invoices (person_id);
