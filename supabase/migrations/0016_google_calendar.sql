-- Google Naptár szinkron: minden csapattag a SAJÁT Google-fiókját
-- kapcsolhatja össze (OAuth, offline access -> refresh_token), a
-- kapcsolódó felhasználó irodájának összes nyitott, dátumos aktivitása
-- (hívás/megtekintés/emlékeztető, checklist NEM) egyirányban szinkronizál
-- a Google Naptárba egy cron endpointon keresztül.

create table public.google_calendar_connections (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  connected_at timestamptz not null default now()
);

-- Melyik aktivitás melyik felhasználó naptárában melyik Google esemény
-- lett már létrehozva -- egy aktivitás több csapattag naptárába is
-- bekerülhet, ha többen csatlakoztatták a sajátjukat.
create table public.activity_google_events (
  activity_id uuid not null references public.activities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  google_event_id text not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, profile_id)
);

alter table public.google_calendar_connections enable row level security;
alter table public.activity_google_events enable row level security;

-- Csak a saját kapcsolatát láthatja/kezelheti mindenki -- a tokenek
-- érzékenyek, NEM iroda-szintű RLS, mint a legtöbb más táblánál.
create policy "google_calendar_connections_select_self" on public.google_calendar_connections
  for select using (profile_id = auth.uid());

create policy "google_calendar_connections_insert_self" on public.google_calendar_connections
  for insert with check (profile_id = auth.uid());

create policy "google_calendar_connections_update_self" on public.google_calendar_connections
  for update using (profile_id = auth.uid());

create policy "google_calendar_connections_delete_self" on public.google_calendar_connections
  for delete using (profile_id = auth.uid());

create policy "activity_google_events_select_self" on public.activity_google_events
  for select using (profile_id = auth.uid());

create policy "activity_google_events_all_self" on public.activity_google_events
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
