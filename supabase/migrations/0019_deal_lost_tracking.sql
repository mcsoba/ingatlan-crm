-- Deals had no way to record "this fell through" — agents could only
-- move a deal between stages, never mark it as dead. Without this, a
-- lost deal either sits forever cluttering the board or gets deleted
-- (losing the history of why it fell through, which matters for
-- pipeline/conversion reporting). 'open' deals behave exactly as
-- before; 'lost' deals are excluded from the active board.

alter table public.deals add column status text not null default 'open'
  check (status in ('open', 'lost'));
alter table public.deals add column lost_reason text;
alter table public.deals add column lost_at timestamptz;
