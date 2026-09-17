-- Cimke-rendszer kontaktokhoz és ingatlanokhoz. Sok versenytárs CRM-ben
-- (Pipedrive, Follow Up Boss) alap funkció, itt eddig teljesen hiányzott --
-- szegmentáláshoz (pl. "VIP", "Sürgős", "Hitelre vár") és később kampány-
-- célzáshoz hasznos. Egy közös `tags` tábla (irodánként újrafelhasználható,
-- egyedi név), külön join-tábla kontaktokhoz és ingatlanokhoz -- ugyanaz a
-- cimke mindkét entitáson használható, de a hozzárendelés külön.

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  color text not null default 'neutral' check (color in ('neutral', 'accent', 'success', 'warning', 'danger')),
  created_at timestamptz not null default now(),
  unique (agency_id, name)
);

create table public.contact_tags (
  contact_id uuid not null references public.contacts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (contact_id, tag_id)
);

create table public.property_tags (
  property_id uuid not null references public.properties (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (property_id, tag_id)
);

create index contact_tags_tag_idx on public.contact_tags (tag_id);
create index property_tags_tag_idx on public.property_tags (tag_id);

alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.property_tags enable row level security;

create policy "tags_select_own_agency" on public.tags
  for select using (agency_id = public.current_agency_id());

create policy "tags_insert_own_agency" on public.tags
  for insert with check (agency_id = public.current_agency_id());

create policy "tags_update_own_agency" on public.tags
  for update using (agency_id = public.current_agency_id());

create policy "tags_delete_own_agency" on public.tags
  for delete using (agency_id = public.current_agency_id());

-- A join-táblák nem tárolják közvetlenül az agency_id-t, ezért a szülő
-- sorra hivatkozva ellenőrizzük a jogosultságot (a contacts/properties
-- táblák RLS-e amúgy is csak a saját iroda sorait engedi látni/módosítani).

create policy "contact_tags_select_own_agency" on public.contact_tags
  for select using (
    exists (select 1 from public.contacts c where c.id = contact_id and c.agency_id = public.current_agency_id())
  );

create policy "contact_tags_insert_own_agency" on public.contact_tags
  for insert with check (
    exists (select 1 from public.contacts c where c.id = contact_id and c.agency_id = public.current_agency_id())
  );

create policy "contact_tags_delete_own_agency" on public.contact_tags
  for delete using (
    exists (select 1 from public.contacts c where c.id = contact_id and c.agency_id = public.current_agency_id())
  );

create policy "property_tags_select_own_agency" on public.property_tags
  for select using (
    exists (select 1 from public.properties p where p.id = property_id and p.agency_id = public.current_agency_id())
  );

create policy "property_tags_insert_own_agency" on public.property_tags
  for insert with check (
    exists (select 1 from public.properties p where p.id = property_id and p.agency_id = public.current_agency_id())
  );

create policy "property_tags_delete_own_agency" on public.property_tags
  for delete using (
    exists (select 1 from public.properties p where p.id = property_id and p.agency_id = public.current_agency_id())
  );
