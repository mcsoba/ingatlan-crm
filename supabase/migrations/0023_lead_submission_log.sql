-- The public /api/leads endpoint has no auth and, until now, no abuse
-- protection at all -- anyone could script POST requests against it to
-- flood an agency's CRM with fake contacts. This table gives the route
-- something to rate-limit against: one row per submission attempt
-- (honeypot-caught ones included, flagged via `blocked`), keyed by IP,
-- so a burst from one IP can be rejected before it ever touches
-- `contacts`. Only the service-role client (the one /api/leads already
-- uses) writes to it; agency owners/members can read their own
-- agency's rows if they ever want visibility into submission volume.

create table public.lead_submission_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  ip text not null,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create index lead_submission_log_ip_idx on public.lead_submission_log (ip, created_at);
create index lead_submission_log_agency_idx on public.lead_submission_log (agency_id, created_at);

alter table public.lead_submission_log enable row level security;

create policy "lead_submission_log_select_own_agency" on public.lead_submission_log
  for select using (agency_id = public.current_agency_id());
