-- Commission tracking: the actual closing price (may differ from the
-- listed property price) and the agency's commission rate for this deal.
-- The commission amount itself is derived in the app, not stored.

alter table public.deals add column deal_amount numeric;
alter table public.deals add column commission_rate numeric;
