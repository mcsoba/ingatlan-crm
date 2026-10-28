-- 0022 (agency slug) újradefiniálta a create_agency_with_owner függvényt, de
-- kimaradt belőle az alap üzlet-szakaszok létrehozása (0004) — azóta az új
-- irodák szakaszok nélkül jöttek létre. Visszaállítjuk, és pótoljuk a
-- szakasz nélküli irodáknak.

create or replace function public.create_agency_with_owner(agency_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_agency_id uuid;
  existing_agency_id uuid;
  base_slug text;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select agency_id into existing_agency_id
  from public.profiles where id = auth.uid();

  if existing_agency_id is not null then
    return existing_agency_id;
  end if;

  new_agency_id := gen_random_uuid();

  base_slug := trim(both '-' from regexp_replace(
    lower(translate(agency_name,
      'áéíóöőúüűÁÉÍÓÖŐÚÜŰ',
      'aeiooouuuAEIOOOUUU')),
    '[^a-z0-9]+', '-', 'g'
  ));
  if base_slug = '' then
    base_slug := 'iroda';
  end if;

  insert into public.agencies (id, name, slug)
  values (new_agency_id, agency_name, base_slug || '-' || substr(new_agency_id::text, 1, 8));

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
