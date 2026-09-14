-- Extend activities.type with 'checklist', so a deal's standard closing
-- steps can be seeded as regular activities (reusing the existing
-- toggle/delete UI) instead of needing a parallel table.

alter table public.activities drop constraint activities_type_check;

alter table public.activities add constraint activities_type_check
  check (type in ('note', 'call', 'viewing', 'reminder', 'checklist'));
