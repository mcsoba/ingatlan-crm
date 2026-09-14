-- Attribute deals to the agent who owns them, so per-agent performance
-- reporting is possible in a multi-agent agency.

alter table public.deals add column owner_id uuid
  references public.profiles (id) on delete set null;

-- Backfill existing deals to the agency's owner, so reports aren't empty
-- for data created before this column existed.
update public.deals d
set owner_id = (
  select p.id from public.profiles p
  where p.agency_id = d.agency_id and p.role = 'owner'
  limit 1
)
where owner_id is null;
