-- Mentett nézetek (saved views) kontakt- és ingatlan-listákhoz. Versenytárs
-- CRM-ekben (Pipedrive, HubSpot) alap funkció -- egy gyakran használt
-- szűrő-kombináció ("Forró leadek", "50M alatti elérhető lakások") egy
-- kattintással újra alkalmazható, nem kell minden alkalommal újra
-- beállítani a szűrőket. Iroda-szintű, bármelyik csapattag létrehozhatja/
-- törölheti -- ugyanaz az egyszerű, nem creator-korlátozott minta, mint a
-- tags táblánál.

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  entity_type text not null check (entity_type in ('contacts', 'properties')),
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index saved_views_agency_entity_idx on public.saved_views (agency_id, entity_type);

alter table public.saved_views enable row level security;

create policy "saved_views_select_own_agency" on public.saved_views
  for select using (agency_id = public.current_agency_id());

create policy "saved_views_insert_own_agency" on public.saved_views
  for insert with check (agency_id = public.current_agency_id());

create policy "saved_views_delete_own_agency" on public.saved_views
  for delete using (agency_id = public.current_agency_id());
