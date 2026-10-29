import { PRIVATE_EDITION, SIMPLE_MODE } from "@/lib/edition";

export type FaqItem = {
  question: string;
  answer: string;
  // Egyszerű módban elrejtett funkcióról szól
  advanced?: boolean;
};

export type FaqSection = {
  category: string;
  items: FaqItem[];
};

const ALL_FAQ_SECTIONS: FaqSection[] = [
  {
    category: "Üzletek és teendők",
    items: [
      {
        question: "Mi az a pipeline?",
        answer:
          "A pipeline egy kanban-tábla, ami az üzleteidet szakaszonként mutatja (pl. Lead, Megtekintés, Ajánlat, Alku, Zárás). Húzd a kártyát a következő szakaszba, ahogy az üzlet halad. A szakaszok nevét és sorrendjét az Üzletek oldal 'Szakaszok' gombjával szerkesztheted.",
      },
      {
        question: "Hogyan jelölök egy üzletet elveszettnek?",
        answer:
          "Az üzlet részletező oldalán az 'Elveszettnek jelölés' linkre kattintva megadhatsz egy indokot. Az elveszett üzletek lekerülnek az üzlet-tábláról, és egy külön listában maradnak — bármikor újranyithatók.",
      },
      {
        question: "Mi a különbség a Teendők oldal és a Naptár között?",
        answer:
          "A Teendők oldal az iroda összes nyitott/kész tennivalóját listázza szűrhetően (lejárt, ma esedékes, jövőbeli). A Naptár havi rácsban mutatja ugyanezeket, dátum szerint elrendezve — ugyanaz az adat, más nézet. A Teendők oldal tetején egy kattintással válthatsz a kettő között.",
      },
      {
        question: "Lehet egy teendőt ismétlődővé tenni?",
        advanced: true,
        answer:
          "Igen — új teendő felvitelekor válaszd ki az 'Ismétlődés' legördülőt (Naponta/Hetente/Havonta). A rendszer a határidő elteltével automatikusan létrehozza a következő előfordulást.",
      },
    ],
  },
  {
    category: "Kontaktok és címkék",
    items: [
      {
        question: "Mit jelent az érdeklődő-pontszám (Pontszám oszlop)?",
        answer:
          "Az AI 0-100 közötti pontszámmal értékeli, mennyire tűnik komoly érdeklődőnek egy kontakt a jegyzetek és aktivitás-előzmény alapján (zöld ≥70, sárga 40-69, szürke <40). A kontakt oldalán az indoklás is megjelenik.",
      },
      {
        question: "Mire jó a címkék rendszer?",
        advanced: true,
        answer:
          "A címkék kontaktokra és ingatlanokra is felragaszthatók, közös készletből (pl. ugyanaz a 'VIP' címke mindkettőn használható). Szűrésre, és kampány-célzásra (csak egy adott címkével rendelkező kontaktok tömeges beiratkoztatására) is használhatók. A Címkék oldalon (oldalsáv) kezelheted központilag: átnevezés, szín, törlés.",
      },
      {
        question: "Mit jelent az óra-ikon egy kontakt mellett?",
        answer:
          "Azt jelzi, hogy egy 'kapcsolatba lépve' vagy 'minősített' státuszú kontaktnak 14+ napja nem volt semmilyen aktivitása (jegyzet/hívás/megtekintés) — érdemes utánanézni, nehogy egy érdeklődő kihűljön.",
      },
      {
        question: "Hogyan vonok össze két duplikált kontaktot?",
        answer:
          "A rendszer szerkesztéskor figyelmeztet, ha egy kontakt email/telefon/neve egyezik egy másikéval. A figyelmeztetésen az 'Összevonás ezzel' gombra kattintva a hiányzó adatok átkerülnek, a duplikátum aktivitásai/dealjei/csatolmányai a megtartott kontaktra kerülnek, majd a duplikátum törlődik.",
      },
    ],
  },
  {
    category: "Ingatlanok és nyilvános oldalak",
    items: [
      {
        question: "Mi a különbség az egyedi ingatlan-link és a katalógus-link között?",
        advanced: true,
        answer:
          "Az egyedi ingatlan-oldal (Ingatlanok listán a 'Nyilvános oldal' gomb) egyetlen ingatlant mutat be, érdeklődő-űrlappal. A katalógus-link (Beállítások → Nyilvános ingatlan-katalógus) az iroda ÖSSZES elérhető ingatlanát listázza egy állandó linken — érdemes ezt megosztani Facebookon vagy email-aláírásban, mert mindig friss.",
      },
      {
        question: "Miért nincs érdeklődő-űrlap egy 'Eladva'/'Kiadva' ingatlan publikus oldalán?",
        answer:
          "Tudatos döntés: egy már lezárt ingatlanra értelmetlen lenne érdeklődést gyűjteni. 'Foglalás alatt' státusznál viszont marad az űrlap, mert a foglalás még nem végleges, backup-érdeklődőt érdemes gyűjteni.",
      },
      {
        question: "Mit jelent a 'megtekintés' szám az ingatlan-listán?",
        answer:
          "Minden alkalommal növekszik, amikor valaki megnyitja az ingatlan publikus oldalát — segít prioritizálni, mely ingatlan iránt van valódi érdeklődés.",
      },
      {
        question: "Hogyan rendezem át az ingatlan-fotókat?",
        answer:
          "Az ingatlan szerkesztő oldalán a galéria-képeket húzd-és-vidd módszerrel átrendezheted. Az első kép lesz a borítókép mindenhol (lista, katalógus, közösségi médiás megosztás előnézete).",
      },
      {
        question: "Mire jó az AI ingatlan-összehasonlító?",
        advanced: true,
        answer:
          "Az Ingatlanok oldalról 2-3 ingatlant kiválasztva az AI ár/méret/jellemzők alapján elemzést és ajánlást ad. A 'Megosztás ügyféllel' gombbal egy publikus, bejelentkezés nélküli linket is generálhatsz belőle, amit elküldhetsz az érdeklődőnek.",
      },
    ],
  },
  {
    category: "AI-eszközök",
    items: [
      {
        question: "Milyen AI-funkciók vannak a rendszerben?",
        answer:
          "Ingatlanleírás-generálás, follow-up email/SMS vázlat, érdeklődő-pontozás, hívás/megtekintés-jegyzet összefoglalása, ingatlan-ügyfél párosítás javaslat, ingatlan-összehasonlítás, és a 'Kérdezd a CRM-et' asszisztens egy üzlet oldalán. Mindegyik gombon a csillag (✨) ikon jelzi, hogy AI-funkció.",
      },
      {
        question: "Mi az a 'Kérdezd a CRM-et' asszisztens?",
        answer:
          "Egy üzlet részletező oldalán található kiemelt panel, ahol szabad szöveggel kérdezhetsz az adott üzletről (kontakt, ingatlan, jegyzetek, jutalék, aktivitás-történet) — az AI a teljes kontextust ismeri, és többfordulós beszélgetést is folytat.",
      },
      {
        question: "Miért nem működik egy AI-gomb?",
        answer:
          "Ha a Beállítások oldalon az 'AI-funkciók (Claude)' kártya 'Nincs beállítva' státuszt mutat, az API-kulcs hiányzik a szerver konfigurációjából — ez fejlesztői beállítás, nem a te teendőd a felületen.",
      },
    ],
  },
  {
    category: "Kampányok és integrációk",
    items: [
      {
        question: "Hogyan küldök tömeges emailt egy csoportnak?",
        advanced: true,
        answer:
          "A Kampányok oldalon hozz létre egy email-sorozatot (lépésekkel: nap-késleltetés + tárgy + szöveg), majd a kontakt oldalán egyenként, VAGY egy címke alapján tömegesen is beiratkoztathatod a megfelelő kontaktokat.",
      },
      {
        question: "Mit csinál a Webhook-integráció?",
        advanced: true,
        answer:
          "Ha megadsz egy saját URL-t a Beállítások oldalon, minden új, weboldalról érkező érdeklődőnél (a szokásos email/SMS-értesítés MELLETT) egy POST-kérés is elmegy erre a címre — ezzel egy külső rendszerbe (pl. Zapier, saját integráció) is bekapcsolható az érdeklődő-adat.",
      },
      {
        question: "Miért 'Nincs beállítva' egy integráció a Beállítások oldalon?",
        advanced: true,
        answer:
          "A Stripe/Resend/Twilio/Google integrációk mindegyikéhez saját API-kulcs kell a szerver környezetében. Amíg ez hiányzik, az adott funkció (fizetés/email-küldés/SMS/Google Naptár) barátságos hibaüzenetet ad kattintásra, nem hibázik le csúnyán — ez fejlesztői teendő, nem a felületen állítható.",
      },
    ],
  },
  {
    category: "Csapat és jogosultságok",
    items: [
      {
        question: "Mi a különbség a tulajdonos, admin és tag szerep között?",
        answer:
          `A tulajdonos (owner) mindent lát/csinálhat, beleértve ${PRIVATE_EDITION ? "" : "az előfizetést és "}a szerepek kiosztását. Egy admin kezelheti a csapatot (sima tagokat), az üzlet-szakaszokat és a brandinget, DE ${PRIVATE_EDITION ? "" : "nem éri el a számlázást, és "}nem nevezhet ki/fokozhat le másik admint. A sima tag a napi munkára (kontaktok/ingatlanok/üzletek) korlátozódik.`,
      },
      {
        question: "Hogyan léptetek elő valakit adminná?",
        answer:
          "Csak a tulajdonos teheti meg, a Csapat oldalon egy tag sorában.",
      },
    ],
  },
  {
    category: "Riportok és adatok",
    items: [
      {
        question: "Mit jelent a 'Várható bevétel' a Riportok oldalon?",
        advanced: true,
        answer:
          "A nyitott üzletek összesített értékét szorozza egy, az üzlet-szakasz pozíciója alapján becsült záródási valószínűséggel (a záráshoz közelebbi szakasz magasabb %-ot kap) — ez egy durva, de hasznos becslés, nem garantált bevétel.",
      },
      {
        question: "Hogyan tölthetem le az összes adatomat?",
        advanced: true,
        answer:
          "A Beállítások oldalon (tulajdonosi jogosultsággal) az 'Összes adatom exportálása' gombbal letöltheted az iroda összes kontaktját, ingatlanát, dealjét és aktivitását.",
      },
      {
        question: "Van audit-napló?",
        advanced: true,
        answer:
          "Igen, az 'Előzmények' oldal (oldalsáv) mutatja, ki mikor hozott létre/módosított/törölt egy kontaktot, ingatlant vagy üzletet, a rekordra mutató linkkel együtt.",
      },
    ],
  },
];

export const FAQ_SECTIONS: FaqSection[] = SIMPLE_MODE
  ? ALL_FAQ_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !i.advanced) })).filter((s) => s.items.length > 0)
  : ALL_FAQ_SECTIONS;
