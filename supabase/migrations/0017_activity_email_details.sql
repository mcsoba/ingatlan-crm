-- Aktivitás-napló bővítése: az elküldött email teljes törzsének
-- elmentése (eddig csak a tárgy szerepelt a content mezőben), és
-- opcionális visszalink a kampányra, ha az aktivitás egy drip-kampány
-- lépéséből keletkezett.

alter table public.activities add column email_body text;
alter table public.activities add column sequence_id uuid references public.email_sequences (id) on delete set null;
