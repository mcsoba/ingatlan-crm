-- Activities: calls, viewings, reminders — optionally tied to a deal
-- and/or a contact, with an optional due date and a done flag so they
-- can double as tasks/reminders.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  type text not null default 'note'
    check (type in ('note', 'call', 'viewing', 'reminder')),
  content text not null,
  due_at timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index activities_agency_due_idx
  on public.activities (agency_id, done, due_at);

alter table public.activities enable row level security;

create policy "activities_select_own_agency" on public.activities
  for select using (agency_id = public.current_agency_id());

create policy "activities_insert_own_agency" on public.activities
  for insert with check (agency_id = public.current_agency_id());

create policy "activities_update_own_agency" on public.activities
  for update using (agency_id = public.current_agency_id());

create policy "activities_delete_own_agency" on public.activities
  for delete using (agency_id = public.current_agency_id());
