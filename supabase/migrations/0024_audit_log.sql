-- Lightweight audit trail: who changed what on contacts/properties/deals,
-- and when. Deliberately v1-scoped at action+record-label granularity
-- (insert/update/delete + a human-readable label), not a full field-level
-- diff -- enough to answer "ki törölte ezt a kontaktot és mikor" without a
-- much heavier per-column diffing trigger. `changed_by` is null when the
-- change came from a service-role context (the public lead-capture
-- endpoint, a cron job) rather than a logged-in team member.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  record_label text not null default '',
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index audit_log_agency_idx on public.audit_log (agency_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select_own_agency" on public.audit_log
  for select using (agency_id = public.current_agency_id());

create or replace function public.log_audit_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency_id uuid;
  v_record_id uuid;
  v_label text;
begin
  if tg_op = 'DELETE' then
    v_agency_id := old.agency_id;
    v_record_id := old.id;
  else
    v_agency_id := new.agency_id;
    v_record_id := new.id;
  end if;

  if tg_table_name = 'contacts' then
    v_label := coalesce(case when tg_op = 'DELETE' then old.name else new.name end, '');
  elsif tg_table_name = 'properties' then
    v_label := coalesce(case when tg_op = 'DELETE' then old.address else new.address end, '');
  elsif tg_table_name = 'deals' then
    select c.name into v_label
    from public.contacts c
    where c.id = case when tg_op = 'DELETE' then old.contact_id else new.contact_id end;
    -- A kapcsolódó kontakt is törölhető ugyanabban a cascade-ben (contact
    -- törlésekor a dealje is törlődik) -- ilyenkor a fenti select nem
    -- talál semmit, ezért generikus címkére esünk vissza.
    v_label := coalesce(v_label, 'Deal');
  else
    v_label := '';
  end if;

  insert into public.audit_log (agency_id, table_name, record_id, action, record_label, changed_by)
  values (v_agency_id, tg_table_name, v_record_id, lower(tg_op), v_label, auth.uid());

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

create trigger contacts_audit after insert or update or delete on public.contacts
  for each row execute function public.log_audit_change();

create trigger properties_audit after insert or update or delete on public.properties
  for each row execute function public.log_audit_change();

create trigger deals_audit after insert or update or delete on public.deals
  for each row execute function public.log_audit_change();
