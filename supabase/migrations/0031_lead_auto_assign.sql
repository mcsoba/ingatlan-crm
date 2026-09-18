-- Automatic lead assignment (round-robin): a new public lead can be handed
-- to a specific team member instead of just notifying everyone. Needs a
-- place to store the assignment (contacts.owner_id, mirroring deals.owner_id
-- from 0011) and an agency-level opt-in switch (default off, so existing
-- agencies keep today's "notify everyone" behavior unless they turn it on).

alter table public.contacts add column owner_id uuid
  references public.profiles (id) on delete set null;

alter table public.agencies add column auto_assign_leads boolean not null default false;
