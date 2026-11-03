-- Cégek a teljes CRM-ben (nem csak a pénzügyekben): egy irodán belül több
-- cég (pl. Bluegate, Interprop, Workerbase). Mindenki mindent lát, a cég
-- címke + szűrő: üzlethez egy cég, kontakthoz és munkatárshoz több is.
-- A tábla neve történeti okból finance_companies marad.

-- Olvasni minden csapattag tudja (szűrő, címkék), írni csak az irodavezető
drop policy if exists "finance_companies_manager" on public.finance_companies;
create policy "finance_companies_select_agency" on public.finance_companies for select
  using (agency_id = public.current_agency_id());
create policy "finance_companies_insert_manager" on public.finance_companies for insert
  with check (agency_id = public.current_agency_id() and public.is_finance_manager());
create policy "finance_companies_update_manager" on public.finance_companies for update
  using (agency_id = public.current_agency_id() and public.is_finance_manager());
create policy "finance_companies_delete_manager" on public.finance_companies for delete
  using (agency_id = public.current_agency_id() and public.is_finance_manager());

alter table public.deals add column company_id uuid references public.finance_companies (id) on delete set null;
alter table public.contacts add column company_ids uuid[] not null default '{}';
alter table public.profiles add column company_ids uuid[] not null default '{}';

create index deals_company_idx on public.deals (company_id);
create index contacts_company_ids_idx on public.contacts using gin (company_ids);
