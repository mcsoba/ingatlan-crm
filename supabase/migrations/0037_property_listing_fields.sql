-- Structured listing fields on properties.
--
-- Until now a property was address + price + size + a free-text notes blob.
-- Portal syndication (ingatlan.com "Automata betöltés" API, see
-- github.com/ingatlancom/api-client) and agency websites need the same data
-- as discrete, validated fields: sale vs. rent, property type, city/postcode,
-- rooms, condition, heating, energy rating etc. These are real columns
-- (not keys inside `features`) because the property form rewrites `features`
-- wholesale on every save, and because filtering/searching needs them.
--
-- Every new column is nullable, so existing rows and the CSV import keep
-- working unchanged; the form simply starts offering the extra fields.
-- Value sets mirror ingatlan.com's own categories so a later sync is a
-- straight mapping rather than a guess.

alter table public.properties
  add column listing_type text
    check (listing_type in ('sale', 'rent')),
  add column property_type text
    check (property_type in (
      'flat_brick', 'flat_panel', 'flat_sliding_form',
      'house_detached', 'house_semi_detached', 'house_terraced', 'house_part', 'manor', 'farmhouse',
      'plot_building', 'plot_holiday', 'plot_agricultural',
      'office', 'commercial_street', 'commercial_courtyard', 'hospitality', 'hotel',
      'warehouse', 'industrial', 'garage', 'holiday_home', 'development_site', 'institution'
    )),
  add column city text,
  add column postal_code text,
  add column plot_sqm numeric check (plot_sqm is null or plot_sqm >= 0),
  add column rooms smallint check (rooms is null or rooms between 0 and 99),
  add column half_rooms smallint check (half_rooms is null or half_rooms between 0 and 99),
  add column floor smallint check (floor is null or floor between -2 and 99),
  add column building_floors smallint check (building_floors is null or building_floors between 0 and 99),
  add column year_built smallint check (year_built is null or year_built between 1700 and 2100),
  add column condition text
    check (condition in (
      'new_build', 'as_new', 'renovated', 'good', 'average', 'needs_renovation', 'unfinished'
    )),
  add column heating text[] not null default '{}',
  add column energy_rating text
    check (energy_rating in ('AA++', 'AA+', 'AA', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J')),
  add column parking text
    check (parking in (
      'none', 'street_free', 'street_paid', 'courtyard', 'garage_included', 'garage_optional',
      'underground_included', 'underground_optional'
    )),
  add column balcony_sqm numeric check (balcony_sqm is null or balcony_sqm >= 0),
  add column has_lift boolean,
  add column has_air_conditioning boolean,
  add column has_garden_access boolean,
  add column is_furnished boolean,
  add column monthly_common_cost numeric check (monthly_common_cost is null or monthly_common_cost >= 0),
  add column min_lease_months smallint check (min_lease_months is null or min_lease_months between 0 and 120),
  add column pets_allowed boolean,
  -- Identifiers of this property on external portals, e.g.
  -- {"ingatlan_com": 35605634}. Lets a future sync update the existing
  -- portal ad instead of creating a duplicate.
  add column external_ids jsonb not null default '{}'::jsonb;

-- Heating is multi-valued on ingatlan.com too (e.g. heat pump + underfloor).
alter table public.properties
  add constraint properties_heating_values check (
    heating <@ array[
      'gas_convector', 'gas_boiler', 'gas_combi', 'district', 'district_metered', 'central',
      'central_metered', 'heat_pump', 'underfloor', 'ceiling', 'air_conditioner', 'electric',
      'multi_fuel', 'tiled_stove', 'fireplace', 'solar', 'none'
    ]::text[]
  );

create index properties_listing_type_idx on public.properties (agency_id, listing_type);
create index properties_city_idx on public.properties (agency_id, city);
