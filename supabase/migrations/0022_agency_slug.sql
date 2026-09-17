-- Stabil, publikus, URL-barát azonosító az irodákhoz (agencies.slug), amivel
-- egyetlen linkben meg lehet osztani az iroda ÖSSZES elérhető ingatlanát
-- (/a/[slug]) ahelyett, hogy minden ingatlant egyenként kellene linkelni
-- (/p/[propertyId], ld. 0010/0018). Meglévő irodáknál a névből generált,
-- ékezet nélküli alap-slug + az agency id első 8 karaktere garantálja az
-- egyediséget backfillkor; a tulajdonos utólag a Beállításokból átírhatja
-- a Beállítások "Nyilvános link" kártyáján (settings/actions.ts).

alter table public.agencies add column slug text;

update public.agencies
set slug = trim(both '-' from regexp_replace(
  lower(translate(name,
    'áéíóöőúüűÁÉÍÓÖŐÚÜŰ',
    'aeiooouuuAEIOOOUUU')),
  '[^a-z0-9]+', '-', 'g'
)) || '-' || substr(id::text, 1, 8)
where slug is null;

alter table public.agencies alter column slug set not null;
alter table public.agencies add constraint agencies_slug_unique unique (slug);

-- NINCS új publikus RLS-policy: az /a/[slug] oldal az /p/[propertyId]
-- mintáját követve service-role klienssel (createAdminClient) olvas, ami
-- eleve megkerüli az RLS-t. Egy `using (true)` select-policy felesleges
-- lenne, és veszélyes is -- a meglévő "agencies_select_own" policy mellett
-- egy második, mindenkire engedékeny policy a Postgres RLS OR-szemantikája
-- miatt a teljes agencies sort (pl. stripe_customer_id) is publikussá
-- tenné a normál (nem service-role) kliensen keresztül is.

-- Az agency-létrehozó RPC-t is ki kell egészíteni, hogy minden ÚJ irodánál
-- is generálódjon slug (a 0002-es race-fix verzióját cseréli le, a
-- concurrency-logika változatlan marad).
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

  return new_agency_id;
end;
$$;
