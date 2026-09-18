-- Iroda-szintu webhook URL uj erdeklodo erkezesekor. A meglevo
-- "agencies_update_owner_admin" RLS policy mar lefedi (owner+admin
-- irhatja az "agencies" tablat), es az "agencies_guard_admin_columns"
-- trigger BLOCK-LISTAS (csak a felsorolt mezoket tiltja adminnak), tehat
-- ez az uj oszlop admin szamara is irhato marad -- ugyanaz a bizalmi
-- szint, mint a branding (logo/szin), nem szamlazas-erzekeny.
alter table public.agencies add column if not exists lead_webhook_url text;
