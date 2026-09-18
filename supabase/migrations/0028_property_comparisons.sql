-- Megoszthato publikus ingatlan-osszehasonlito link ugyfeleknek. A belso AI
-- osszehasonlito (/dashboard/properties/compare) eddig csak bejelentkezve
-- volt lathato -- most az ugynok egy generalt elemzest elmenthet es kikuldhet
-- egy publikus, bejelentkezes nelkuli linken, ugyanugy mint a /p/[propertyId]
-- es /a/[slug] oldalak. Perzisztalt megoldas (nem stateless URL-paramok),
-- hogy ne kelljen minden megnyitaskor uj AI-hivast inditani -- egyszeri
-- koltseg, konzisztens tartalom minden megtekintesnel, es az ugynok explicit
-- "elkeszitem es megosztom" workflow-ja is jobban illik egy CRM-hez.

create table public.property_comparisons (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  property_ids uuid[] not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);

create index property_comparisons_agency_idx on public.property_comparisons (agency_id);

alter table public.property_comparisons enable row level security;

create policy "property_comparisons_select_own_agency" on public.property_comparisons
  for select using (agency_id = public.current_agency_id());

create policy "property_comparisons_insert_own_agency" on public.property_comparisons
  for insert with check (agency_id = public.current_agency_id());

create policy "property_comparisons_delete_own_agency" on public.property_comparisons
  for delete using (agency_id = public.current_agency_id());

-- NINCS update-policy -- egy elmentett osszehasonlitas vegleges, nem
-- szerkesztheto (uj osszehasonlitast kell generalni helyette).

-- NINCS publikus select-policy sem, ugyanazon okbol mint a 0022-es
-- agency-slug migracioban: a publikus /c/[id] oldal service-role klienssel
-- (createAdminClient) olvas, ami eleve megkeruli az RLS-t -- egy `using
-- (true)` policy csak felesleges tamadasi feluletet nyitna.
