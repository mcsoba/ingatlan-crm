-- AI lead-scoring: a 0-100 score + one-line reason, computed on demand
-- from the contact's own notes/status/activity history (no external lead
-- source needed). Null until the agent runs the scorer once.

alter table public.contacts add column lead_score integer
  check (lead_score is null or (lead_score >= 0 and lead_score <= 100));
alter table public.contacts add column lead_score_reason text;
