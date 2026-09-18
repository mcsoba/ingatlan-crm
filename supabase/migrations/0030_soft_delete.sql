-- Deleting a contact/property/deal used to be permanent (hard DELETE,
-- cascading via FK). One accidental click and it was gone -- the audit log
-- (0024) tells you *who* deleted something, but gives no way to undo it.
-- This adds a 30-day soft-delete: deleting sets deleted_at instead of
-- removing the row, a new /dashboard/trash page lists and restores recently
-- deleted records, and a cron permanently purges anything older than 30
-- days. The select policy is tightened to hide deleted_at rows from every
-- normal read path at the RLS layer (not per-query filters scattered across
-- ~30 call sites, which would be one missed spot away from a leak) --
-- restoring/soft-deleting still goes through the update policy, which is
-- untouched and does not look at deleted_at, so it keeps working for rows
-- the select policy now hides.

alter table public.contacts add column deleted_at timestamptz;
alter table public.properties add column deleted_at timestamptz;
alter table public.deals add column deleted_at timestamptz;

drop policy "contacts_select_own_agency" on public.contacts;
create policy "contacts_select_own_agency" on public.contacts
  for select using (agency_id = public.current_agency_id() and deleted_at is null);

drop policy "properties_select_own_agency" on public.properties;
create policy "properties_select_own_agency" on public.properties
  for select using (agency_id = public.current_agency_id() and deleted_at is null);

drop policy "deals_select_own_agency" on public.deals;
create policy "deals_select_own_agency" on public.deals
  for select using (agency_id = public.current_agency_id() and deleted_at is null);

-- The trash page itself needs to see the hidden rows -- it reads through
-- the service-role admin client (bypassing RLS, agency_id filtered in
-- application code), the same established pattern as team listing and the
-- Google Calendar cross-user sync use.

alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('insert', 'update', 'delete', 'restore'));

create or replace function public.log_audit_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency_id uuid;
  v_record_id uuid;
  v_label text;
  v_action text;
begin
  if tg_op = 'DELETE' then
    v_agency_id := old.agency_id;
    v_record_id := old.id;
    v_action := 'delete';
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    v_agency_id := new.agency_id;
    v_record_id := new.id;
    v_action := 'delete';
  elsif tg_op = 'UPDATE' and old.deleted_at is not null and new.deleted_at is null then
    v_agency_id := new.agency_id;
    v_record_id := new.id;
    v_action := 'restore';
  else
    v_agency_id := new.agency_id;
    v_record_id := new.id;
    v_action := lower(tg_op);
  end if;

  if tg_table_name = 'contacts' then
    v_label := coalesce(case when tg_op = 'DELETE' then old.name else new.name end, '');
  elsif tg_table_name = 'properties' then
    v_label := coalesce(case when tg_op = 'DELETE' then old.address else new.address end, '');
  elsif tg_table_name = 'deals' then
    select c.name into v_label
    from public.contacts c
    where c.id = case when tg_op = 'DELETE' then old.contact_id else new.contact_id end;
    v_label := coalesce(v_label, 'Deal');
  else
    v_label := '';
  end if;

  insert into public.audit_log (agency_id, table_name, record_id, action, record_label, changed_by)
  values (v_agency_id, tg_table_name, v_record_id, v_action, v_label, auth.uid());

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;
