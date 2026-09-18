-- Enables Supabase Realtime broadcast for the two tables the notification
-- bell cares about (new overdue/due-today activities, new leads), so the
-- bell can update live instead of only on page load/navigation. This does
-- NOT touch RLS: Realtime's postgres_changes protocol still evaluates each
-- subscriber's row visibility through the existing SELECT policies
-- (agency_id = current_agency_id() and deleted_at is null, from 0030), so a
-- client only ever receives change events for rows it could already SELECT.

alter publication supabase_realtime add table public.contacts, public.activities;
