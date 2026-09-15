-- Property availability status: 'available' by default, agents flip it
-- to 'reserved'/'sold'/'rented' as a deal progresses. This gates the
-- public property page's lead form (no point capturing leads on a
-- property that's already sold/rented) and lets the office see at a
-- glance which listings are still active.

alter table public.properties add column status text not null default 'available'
  check (status in ('available', 'reserved', 'sold', 'rented'));
