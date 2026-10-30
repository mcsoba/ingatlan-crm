-- Szabadság-nyilvántartás: munkatársanként éves szabadságkeret és a kivett
-- szabadságok (a naptárban is megjelennek). Keretet csak owner/admin
-- (irodavezető) állíthat; szabadságot mindenki rögzíthet magának, az
-- irodavezető bárkinek az irodán belül.

create table public.leave_allowances (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  days numeric(5,1) not null check (days >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, year)
);

create table public.leaves (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  days numeric(5,1) not null check (days > 0),
  note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index leaves_agency_dates_idx on public.leaves (agency_id, start_date, end_date);

alter table public.leave_allowances enable row level security;
alter table public.leaves enable row level security;

create policy "leave_allowances_select_own_agency" on public.leave_allowances for select using (agency_id = public.current_agency_id());
create policy "leave_allowances_insert_owner_admin" on public.leave_allowances for insert with check (agency_id = public.current_agency_id() and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')) and exists (select 1 from public.profiles p where p.id = profile_id and p.agency_id = public.current_agency_id()));
create policy "leave_allowances_update_owner_admin" on public.leave_allowances for update using (agency_id = public.current_agency_id() and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
create policy "leave_allowances_delete_owner_admin" on public.leave_allowances for delete using (agency_id = public.current_agency_id() and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')));

create policy "leaves_select_own_agency" on public.leaves for select using (agency_id = public.current_agency_id());
create policy "leaves_insert_self_or_manager" on public.leaves for insert with check (agency_id = public.current_agency_id() and exists (select 1 from public.profiles p where p.id = profile_id and p.agency_id = public.current_agency_id()) and (profile_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin'))));
create policy "leaves_delete_self_or_manager" on public.leaves for delete using (agency_id = public.current_agency_id() and (profile_id = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin'))));
