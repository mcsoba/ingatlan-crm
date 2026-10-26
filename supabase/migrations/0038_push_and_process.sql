-- Push notifications + clearer "who does what next" process.
--
-- 1) push_tokens: one row per device (Expo push token). Registration goes
--    through a SECURITY DEFINER RPC so a phone that switches user simply
--    moves its token to the new profile (a plain upsert would hit RLS on the
--    previous owner's row).
-- 2) activities.assigned_to: every task has a responsible team member, so
--    "my tasks" views and reminders know whom to notify. Defaults to the
--    creator (auth.uid()); service-role inserts (cron, public lead form)
--    leave it null and fall back to the deal/contact owner in code.
-- 3) activities.push_sent_at: dedupe for the due-soon reminder cron.
-- 4) pipeline_stages.guidance: a short "what to do in this stage" text shown
--    on the deal page (web + mobile), editable on the stages admin page.

create table public.push_tokens (
  token text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  platform text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_tokens_profile_idx on public.push_tokens (profile_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own" on public.push_tokens
  for select using (profile_id = auth.uid());

create policy "push_tokens_delete_own" on public.push_tokens
  for delete using (profile_id = auth.uid());

create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_agency_id() is null then
    raise exception 'Bejelentkezés szükséges';
  end if;
  insert into public.push_tokens (token, profile_id, agency_id, platform, last_seen_at)
    values (p_token, auth.uid(), public.current_agency_id(), p_platform, now())
    on conflict (token) do update
      set profile_id = excluded.profile_id,
          agency_id = excluded.agency_id,
          platform = excluded.platform,
          last_seen_at = now();
end;
$$;

alter table public.activities
  add column assigned_to uuid references public.profiles (id) on delete set null default auth.uid();

alter table public.activities add column push_sent_at timestamptz;

create index activities_assigned_open_idx on public.activities (assigned_to, done, due_at);

-- Existing tasks: responsible = the deal's owner, else the contact's owner.
update public.activities a
  set assigned_to = d.owner_id
  from public.deals d
  where a.deal_id = d.id and a.assigned_to is null and d.owner_id is not null;

update public.activities a
  set assigned_to = c.owner_id
  from public.contacts c
  where a.contact_id = c.id and a.assigned_to is null and c.owner_id is not null;

-- Old tasks must not trigger a burst of reminders right after the migration.
update public.activities set push_sent_at = now() where due_at < now();

alter table public.pipeline_stages add column guidance text;

update public.pipeline_stages set guidance = case lower(name)
  when 'lead' then 'Vedd fel a kapcsolatot 24 órán belül: hívd fel, tisztázd, mit keres (típus, környék, keret), és egyeztess megtekintést.'
  when 'megtekintés' then 'Szervezd meg és tartsd meg a megtekintést. Utána még aznap kérj visszajelzést az ügyféltől, és rögzítsd jegyzetben.'
  when 'ajánlat' then 'Rögzítsd írásban az ügyfél ajánlatát, add át az eladónak, és kövesd, amíg válasz nem érkezik.'
  when 'alku' then 'Egyeztesd a feltételeket (ár, átadás időpontja, foglaló). Ha megvan a megállapodás, indítsd a szerződéskötést.'
  when 'zárás' then 'Foglaló, ügyvéd, szerződés, kulcsátadás. Használd a tranzakciós checklistet, a végén jelöld az ügyletet nyertesnek.'
  else null
end
where guidance is null;
