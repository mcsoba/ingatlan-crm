-- Free-text notes on a deal, separate from the contact's own notes —
-- a deal can have multiple contacts/properties over its life, so its
-- notes shouldn't live on the contact row.

alter table public.deals add column notes text;
