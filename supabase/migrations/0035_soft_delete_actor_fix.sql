-- Bug fix: contact/property/deal soft-delete and restore go through the
-- service-role admin client (see comments on softDeleteContacts,
-- softDeleteProperties, deleteDeal, restoreRecord), because the deleted_at
-- column change fails RLS's WITH CHECK under a plain client-side UPDATE.
-- But the admin client carries no user JWT, so auth.uid() is null inside
-- the audit_log trigger (0024/0030) when it fires -- every manual
-- delete/restore has been getting attributed to "Rendszer" in Előzmények
-- instead of the team member who actually clicked it, defeating the point
-- of the audit log.
--
-- Fix: move these four operations into SECURITY DEFINER RPC functions,
-- called through the normal RLS-scoped client instead of the admin one. A
-- security definer function still runs inside the caller's own
-- request/transaction, so auth.uid() (and current_agency_id(), see 0001)
-- stay correct for both the function body and the audit trigger it fires,
-- while the function's elevated privilege is what bypasses the WITH CHECK
-- that was blocking a plain client-side UPDATE. Each function derives its
-- own agency scope from current_agency_id() rather than trusting a
-- caller-supplied agency_id, unlike the admin-client call sites it
-- replaces (which needed that as an explicit safety net for exactly this
-- reason).

create or replace function public.soft_delete_contacts(p_ids uuid[]) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  update public.contacts set deleted_at = v_now
    where agency_id = public.current_agency_id() and id = any(p_ids);

  -- Mirrors the FK cascade the old hard-delete relied on: soft-delete the
  -- contact's own still-open deals alongside it.
  update public.deals set deleted_at = v_now
    where agency_id = public.current_agency_id()
      and contact_id = any(p_ids)
      and deleted_at is null;
end;
$$;

create or replace function public.soft_delete_properties(p_ids uuid[]) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.properties set deleted_at = now()
    where agency_id = public.current_agency_id() and id = any(p_ids);

  -- Mirrors the FK behavior the old hard-delete relied on: null out the
  -- property reference on any deal pointing at a deleted property.
  update public.deals set property_id = null
    where agency_id = public.current_agency_id() and property_id = any(p_ids);
end;
$$;

create or replace function public.soft_delete_deal(p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deals set deleted_at = now()
    where agency_id = public.current_agency_id() and id = p_id;
end;
$$;

create or replace function public.restore_soft_deleted(p_table text, p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_table not in ('contacts', 'properties', 'deals') then
    raise exception 'Érvénytelen tábla: %', p_table;
  end if;

  execute format(
    'update public.%I set deleted_at = null where id = $1 and agency_id = $2',
    p_table
  ) using p_id, public.current_agency_id();
end;
$$;

grant execute on function public.soft_delete_contacts(uuid[]) to authenticated;
grant execute on function public.soft_delete_properties(uuid[]) to authenticated;
grant execute on function public.soft_delete_deal(uuid) to authenticated;
grant execute on function public.restore_soft_deleted(text, uuid) to authenticated;
