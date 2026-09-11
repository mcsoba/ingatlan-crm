-- Next.js can fire two near-simultaneous first-load requests for
-- /dashboard (observed in dev), which both call create_agency_with_owner
-- before either has committed its INSERT into profiles. The original
-- check-then-insert body raced: both reads saw "no profile yet", one
-- insert won, and the other hit the explicit "already exists" exception,
-- surfacing as an unhandled error in the browser. Make the RPC idempotent
-- under concurrent calls instead of relying on a pre-check.
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
    -- lost the race: another concurrent call already created the
    -- profile first. Drop the agency row we created for nothing and
    -- return the winner's agency_id instead of erroring.
    delete from public.agencies where id = new_agency_id;

    select agency_id into existing_agency_id
    from public.profiles where id = auth.uid();

    return existing_agency_id;
  end;

  return new_agency_id;
end;
$$;
