-- Koztes "admin" csapat-szerep owner es agent kozott. Az admin a
-- csapatot (meghivas/eltavolitas, csak sima "agent" tagokra), a
-- pipeline-szakaszokat es az iroda-brandinget (logo+szin) kezelheti, DE
-- nem eri el a szamlazast/elofizetest, nem szerkeszti a publikus
-- linket/nevet/plan_tier-t, es nem modosithatja senki szerepkoret --
-- csak a tulajdonos.
--
-- Menet kozben ket, ettol a funkciotol fuggetlen, MAR MEGLEVO
-- biztonsagi rest is bezarunk (nem uj hiba, korabban is fennallt):
--   1) profiles_update_self policy semmilyen oszlopot nem korlatozott --
--      egy hitelesitett user kozvetlen API-hivassal atirhatta volna a
--      SAJAT role/agency_id mezojet (pl. 'owner'-re valtva magat).
--   2) pipeline_stages irása eddig BARMELY csapattagnak szabad volt,
--      nem csak owner/admin-nak.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'admin', 'agent'));

-- 1) Vedelem: hitelesitett (nem service-role) kliens sose modosithassa a
-- sajat role/agency_id mezojet kozvetlenul.
create or replace function public.profiles_guard_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role then
      raise exception 'A szerepkor modositasahoz tulajdonosi jogosultsag szukseges';
    end if;
    if new.agency_id is distinct from old.agency_id then
      raise exception 'Az iroda-hozzarendeles nem modosithato';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_fields on public.profiles;
create trigger profiles_guard_privileged_fields before update on public.profiles for each row execute function public.profiles_guard_privileged_fields();

-- 2) Pipeline-szakaszok: mostantol csak owner/admin irhat.
drop policy if exists "pipeline_stages_insert_own_agency" on public.pipeline_stages;
drop policy if exists "pipeline_stages_update_own_agency" on public.pipeline_stages;
drop policy if exists "pipeline_stages_delete_own_agency" on public.pipeline_stages;

create policy "pipeline_stages_insert_owner_admin" on public.pipeline_stages for insert with check (agency_id = public.current_agency_id() and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
create policy "pipeline_stages_update_owner_admin" on public.pipeline_stages for update using (agency_id = public.current_agency_id() and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
create policy "pipeline_stages_delete_owner_admin" on public.pipeline_stages for delete using (agency_id = public.current_agency_id() and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')));

-- Iroda-branding: admin is modosithassa a logot/kiemelo szint az
-- "agencies" tablan, de nevet/slug-ot/plan_tier-t/stripe mezoket csak a
-- tulajdonos -- ezert az RLS szinten owner+admin-ra bovitjuk az UPDATE-et,
-- majd egy trigger oszlop-szinten visszaszoritja az admint a
-- logo_path/accent_preset mezokre (defense in depth: a settings/actions.ts
-- app-szintu ellenorzese mellett kozvetlen API-hivas eseten is ervenyesul).
drop policy if exists "agencies_update_owner" on public.agencies;
create policy "agencies_update_owner_admin" on public.agencies for update using (id = public.current_agency_id() and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')));

create or replace function public.agencies_guard_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  if auth.uid() is not null then
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role = 'admin' then
      if new.slug is distinct from old.slug or new.name is distinct from old.name or new.plan_tier is distinct from old.plan_tier or new.stripe_customer_id is distinct from old.stripe_customer_id or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
        raise exception 'Ezt a mezot csak az iroda tulajdonosa modosithatja';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agencies_guard_admin_columns on public.agencies;
create trigger agencies_guard_admin_columns before update on public.agencies for each row execute function public.agencies_guard_admin_columns();

-- Logo-feltoltes storage policy-k: admin is tolthessen fel/cserelhessen/torolhessen logot.
drop policy if exists "agency_logos_insert_own_agency_owner" on storage.objects;
drop policy if exists "agency_logos_update_own_agency_owner" on storage.objects;
drop policy if exists "agency_logos_delete_own_agency_owner" on storage.objects;

create policy "agency_logos_insert_owner_admin" on storage.objects for insert with check (bucket_id = 'agency-logos' and (storage.foldername(name))[1] = public.current_agency_id()::text and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
create policy "agency_logos_update_owner_admin" on storage.objects for update using (bucket_id = 'agency-logos' and (storage.foldername(name))[1] = public.current_agency_id()::text and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
create policy "agency_logos_delete_owner_admin" on storage.objects for delete using (bucket_id = 'agency-logos' and (storage.foldername(name))[1] = public.current_agency_id()::text and exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')));
