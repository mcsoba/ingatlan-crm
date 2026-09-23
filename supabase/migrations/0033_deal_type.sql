-- Real-estate specific deal type. A generic CRM cannot tell a sale from a
-- rental, but the two behave very differently (different cycle length,
-- different commission logic, different reporting). Existing deals default
-- to 'sale', the dominant case for an agency pipeline.

alter table public.deals add column deal_type text not null default 'sale'
  check (deal_type in ('sale', 'rent'));
