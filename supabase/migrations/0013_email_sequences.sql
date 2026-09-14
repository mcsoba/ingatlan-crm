-- Email drip-kampányok: irodánként definiálható email-sorozatok
-- (pl. "Új weboldali érdeklődő nurture"), lépésekkel (X nap után küldött
-- email) és kontakt-beiratkozásokkal, amiket egy cron endpoint (
-- /api/cron/drip-campaigns) dolgoz fel esedékesség szerint.

create table public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  trigger text not null default 'manual'
    check (trigger in ('manual', 'new_lead')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  sequence_id uuid not null references public.email_sequences (id) on delete cascade,
  step_order int not null,
  delay_days int not null default 0,
  subject text not null,
  body text not null,
  unique (sequence_id, step_order)
);

create table public.email_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  sequence_id uuid not null references public.email_sequences (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  current_step int not null default 0,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  enrolled_at timestamptz not null default now(),
  next_send_at timestamptz,
  unique (sequence_id, contact_id)
);

create index email_sequence_enrollments_due_idx
  on public.email_sequence_enrollments (status, next_send_at);

alter table public.email_sequences enable row level security;
alter table public.email_sequence_steps enable row level security;
alter table public.email_sequence_enrollments enable row level security;

create policy "email_sequences_all_own_agency" on public.email_sequences
  for all using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());

create policy "email_sequence_steps_all_own_agency" on public.email_sequence_steps
  for all using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());

create policy "email_sequence_enrollments_all_own_agency" on public.email_sequence_enrollments
  for all using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());
