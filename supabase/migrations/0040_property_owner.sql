-- Ingatlanhoz is tartozik felelős munkatárs (a kontaktokhoz és üzletekhez
-- hasonlóan). Alapból az, aki felvette; a meglévő sorok felelős nélkül maradnak.
alter table public.properties
  add column owner_id uuid references public.profiles (id) on delete set null default auth.uid();
