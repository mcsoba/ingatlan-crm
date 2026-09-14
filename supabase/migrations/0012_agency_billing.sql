-- Stripe billing fields for the agency's own subscription (free -> pro).
-- plan_tier already existed (0001); these let us reconcile it with Stripe.

alter table public.agencies add column stripe_customer_id text;
alter table public.agencies add column stripe_subscription_id text;
