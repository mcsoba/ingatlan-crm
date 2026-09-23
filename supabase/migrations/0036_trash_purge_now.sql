-- Manual "delete permanently now" from the Trash page -- until now the only
-- way a soft-deleted record left the 30-day trash was the purge-trash cron.
--
-- Mirrors restore_soft_deleted (0035): a security definer RPC called
-- through the normal RLS-scoped client, so it runs inside the caller's own
-- request/transaction and auth.uid()/current_agency_id() stay correct for
-- the resulting audit_log 'delete' row, instead of needing the admin
-- client. Explicitly requires deleted_at is not null, so this can only
-- hard-delete a record that is already in the trash -- never a live,
-- active one -- closing off any use as a delete-bypass for RLS-protected
-- active data.
create or replace function public.purge_soft_deleted(p_table text, p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_table not in ('contacts', 'properties', 'deals') then
    raise exception 'Érvénytelen tábla: %', p_table;
  end if;

  execute format(
    'delete from public.%I where id = $1 and agency_id = $2 and deleted_at is not null',
    p_table
  ) using p_id, public.current_agency_id();
end;
$$;

grant execute on function public.purge_soft_deleted(text, uuid) to authenticated;
