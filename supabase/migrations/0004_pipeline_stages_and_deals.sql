-- Pipeline stages (per-agency, so they can be customized later) and
-- deals, which sit in exactly one stage and link a contact to an
-- optional property.

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

alter table public.pipeline_stages enable row level security;

create policy "pipeline_stages_select_own_agency" on public.pipeline_stages
  for select using (agency_id = public.current_agency_id());

create policy "pipeline_stages_insert_own_agency" on public.pipeline_stages
  for insert with check (agency_id = public.current_agency_id());

create policy "pipeline_stages_update_own_agency" on public.pipeline_stages
  for update using (agency_id = public.current_agency_id());

create policy "pipeline_stages_delete_own_agency" on public.pipeline_stages
  for delete using (agency_id = public.current_agency_id());

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  stage_id uuid not null references public.pipeline_stages (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deals enable row level security;

create policy "deals_select_own_agency" on public.deals
  for select using (agency_id = public.current_agency_id());

create policy "deals_insert_own_agency" on public.deals
  for insert with check (agency_id = public.current_agency_id());

create policy "deals_update_own_agency" on public.deals
  for update using (agency_id = public.current_agency_id());

create policy "deals_delete_own_agency" on public.deals
  for delete using (agency_id = public.current_agency_id());

-- Backfill default stages for agencies created before this migration.
insert into public.pipeline_stages (agency_id, name, position)
select a.id, s.name, s.position
from public.agencies a
cross join (values
  ('Lead', 1),
  ('Megtekintés', 2),
  ('Ajánlat', 3),
  ('Alku', 4),
  ('Zárás', 5)
) as s(name, position)
where not exists (
  select 1 from public.pipeline_stages ps where ps.agency_id = a.id
);

-- Extend create_agency_with_owner (0001/0002) to also seed the default
-- stages for newly created agencies.
create or replace function public.create_agency_with_owner(agency_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_agency_id uuid;
  existing_agency_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select agency_id into existing_agency_id
  from public.profiles where id = auth.uid();

  if existing_agency_id is not null then
    return existing_agency_id;
  end if;

  insert into public.agencies (name) values (agency_name)
  returning id into new_agency_id;

  begin
    insert into public.profiles (id, agency_id, role)
    values (auth.uid(), new_agency_id, 'owner');
  exception when unique_violation then
    delete from public.agencies where id = new_agency_id;

    select agency_id into existing_agency_id
    from public.profiles where id = auth.uid();

    return existing_agency_id;
  end;

  insert into public.pipeline_stages (agency_id, name, position)
  values
    (new_agency_id, 'Lead', 1),
    (new_agency_id, 'Megtekintés', 2),
    (new_agency_id, 'Ajánlat', 3),
    (new_agency_id, 'Alku', 4),
    (new_agency_id, 'Zárás', 5);

  return new_agency_id;
end;
$$;
