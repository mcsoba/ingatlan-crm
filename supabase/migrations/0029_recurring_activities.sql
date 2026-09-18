-- Recurring activities: a reminder/call/viewing can repeat daily/weekly/monthly.
-- A cron job (see src/app/api/cron/recurring-tasks) spawns the next occurrence
-- once the current one's due_at has passed, then marks it as spawned so it
-- never spawns twice.

alter table public.activities
  add column recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly'));

alter table public.activities
  add column next_occurrence_created boolean not null default false;
