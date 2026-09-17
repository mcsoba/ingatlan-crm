alter table properties add column if not exists view_count integer not null default 0;

create or replace function increment_property_view_count(p_id uuid) returns void as $$ begin update properties set view_count = view_count + 1 where id = p_id; end; $$ language plpgsql security definer set search_path = public;
