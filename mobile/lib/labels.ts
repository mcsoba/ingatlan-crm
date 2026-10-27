// A webes CRM felirataival egyezően (src/app/dashboard/*/constants.ts).
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
  checklist: "Teendő",
};

export const CONTACT_STATUS_LABELS: Record<string, string> = {
  new: "Új",
  contacted: "Megkeresve",
  qualified: "Minősített",
  inactive: "Inaktív",
};

export const PROPERTY_STATUS_LABELS: Record<string, string> = {
  available: "Elérhető",
  reserved: "Foglalt",
  sold: "Eladva",
  rented: "Kiadva",
};

export const LISTING_TYPE_LABELS: Record<string, string> = { sale: "Eladó", rent: "Kiadó" };

// Átvéve a webes CRM-ből: src/app/dashboard/properties/constants.ts (0037 migráció mezői)

export const PROPERTY_TYPE_GROUPS: { label: string; options: Record<string, string> }[] = [
  {
    label: "Lakás",
    options: {
      flat_brick: "Tégla lakás",
      flat_panel: "Panel lakás",
      flat_sliding_form: "Csúsztatott zsalus lakás",
    },
  },
  {
    label: "Ház",
    options: {
      house_detached: "Családi ház",
      house_semi_detached: "Ikerház",
      house_terraced: "Sorház",
      house_part: "Házrész",
      manor: "Kúria",
      farmhouse: "Tanya",
      holiday_home: "Nyaraló",
    },
  },
  {
    label: "Telek",
    options: {
      plot_building: "Építési telek",
      plot_holiday: "Üdülőtelek",
      plot_agricultural: "Mezőgazdasági terület",
      development_site: "Fejlesztési terület",
    },
  },
  {
    label: "Üzleti / egyéb",
    options: {
      office: "Iroda",
      commercial_street: "Üzlethelyiség (utcai bejáratos)",
      commercial_courtyard: "Üzlethelyiség (udvari bejáratos)",
      hospitality: "Vendéglátó egység",
      hotel: "Szálloda, hotel, panzió",
      warehouse: "Raktár",
      industrial: "Ipari ingatlan",
      garage: "Garázs",
      institution: "Intézmény",
    },
  },
];

export const PROPERTY_TYPE_LABELS: Record<string, string> = Object.assign(
  {},
  ...PROPERTY_TYPE_GROUPS.map((g) => g.options),
);

export const CONDITION_LABELS: Record<string, string> = {
  new_build: "Új építésű",
  as_new: "Újszerű",
  renovated: "Felújított",
  good: "Jó állapotú",
  average: "Közepes állapotú",
  needs_renovation: "Felújítandó",
  unfinished: "Befejezetlen",
};

export const HEATING_LABELS: Record<string, string> = {
  gas_convector: "Gáz (konvektor)",
  gas_boiler: "Gázkazán",
  gas_combi: "Gáz (cirkó)",
  district: "Távfűtés",
  district_metered: "Távfűtés egyedi méréssel",
  central: "Házközponti",
  central_metered: "Házközponti egyedi méréssel",
  heat_pump: "Hőszivattyú",
  underfloor: "Padlófűtés",
  ceiling: "Mennyezeti hűtés-fűtés",
  air_conditioner: "Hűtő-fűtő klíma",
  electric: "Elektromos",
  multi_fuel: "Vegyes tüzelésű kazán",
  tiled_stove: "Cserépkályha",
  fireplace: "Kandalló",
  solar: "Napkollektor",
  none: "Nincs",
};

export const ENERGY_RATINGS = ["AA++", "AA+", "AA", "A+", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export const PARKING_LABELS: Record<string, string> = {
  none: "Nincs",
  street_free: "Utca, közterület – ingyenes",
  street_paid: "Utca, közterület – fizetős",
  courtyard: "Udvari beálló",
  garage_included: "Önálló garázs – az árban",
  garage_optional: "Önálló garázs – megvásárolható",
  underground_included: "Teremgarázs-hely – az árban",
  underground_optional: "Teremgarázs-hely – megvásárolható",
};

// Floors are stored as numbers: -1 = szuterén, 0 = földszint.
export function floorLabel(floor: number | null | undefined): string | null {
  if (floor == null) return null;
  if (floor < 0) return "Szuterén";
  if (floor === 0) return "Földszint";
  return `${floor}. emelet`;
}

export const RECURRENCE_LABELS: Record<string, string> = {
  none: "Nem ismétlődik",
  daily: "Naponta",
  weekly: "Hetente",
  monthly: "Havonta",
};

export const CONTACT_SOURCE_LABELS: Record<string, string> = {
  website: "Weboldal",
  referral: "Ajánlás",
  phone: "Telefon",
  walk_in: "Betérő",
  other: "Egyéb",
};
