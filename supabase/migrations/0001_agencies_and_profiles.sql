-- Tenants (real estate agencies / solo agents) and the profile linking
-- a Supabase Auth user to their agency.

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'pro')),
  brand_tone text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'agent')),
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;

-- security definer helper: looks up the caller's agency_id without the
-- policy needing to read profiles from inside a profiles policy (which
-- would recurse under RLS).
create or replace function public.current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id from public.profiles where id = auth.uid();
$$;

create policy "agencies_select_own" on public.agencies
  for select using (id = public.current_agency_id());

create policy "agencies_update_owner" on public.agencies
  for update using (
    id = public.current_agency_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'owner'
    )
  );

create policy "profiles_select_same_agency" on public.profiles
  for select using (agency_id = public.current_agency_id());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

-- Atomically creates a new agency and makes the calling (already
-- authenticated) user its owner. Called once, right after signup.
create or replace function public.create_agency_with_owner(agency_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_agency_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile already exists for this user';
  end if;

  insert into public.agencies (name) values (agency_name)
  returning id into new_agency_id;

  insert into public.profiles (id, agency_id, role)
  values (auth.uid(), new_agency_id, 'owner');

  return new_agency_id;
end;
$$;

grant execute on function public.create_agency_with_owner(text) to authenticated;
