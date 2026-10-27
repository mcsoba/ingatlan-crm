import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Compass,
  LifeBuoy,
  Phone,
  Smartphone,
  Sunrise,
  Tags,
  UserCog,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { linkClass } from "@/components/ui/styles";
import { DEFAULT_STAGE_GUIDANCE } from "@/lib/stage-guidance";
import { STATUS_HELP, STATUS_LABELS } from "../contacts/constants";
import { PrintButton } from "./print-button";

// Használati útmutató az iroda munkatársainak, szerepek és feladatok szerint.
// A szakasz-útmutatók és az állapot-magyarázatok ugyanazokból a forrásokból
// jönnek, mint az alkalmazásban (stage-guidance, contacts/constants), így az
// útmutató mindig azt mondja, amit a felhasználó a képernyőn lát.

const SECTIONS: { id: string; title: string; icon: LucideIcon }[] = [
  { id: "napi-rutin", title: "A nap kezdete", icon: Sunrise },
  { id: "uj-erdeklodo", title: "Új érdeklődő felvétele", icon: UserPlus },
  { id: "felhivas", title: "Érdeklődő felhívása", icon: Phone },
  { id: "teendo", title: "Teendő, emlékeztető", icon: CalendarClock },
  { id: "uzlet", title: "Üzlet vezetése szakaszonként", icon: Briefcase },
  { id: "ingatlan", title: "Ingatlan felvétele", icon: Building2 },
  { id: "terep", title: "Terepen, telefonnal", icon: Smartphone },
  { id: "lezaras", title: "Üzlet lezárása", icon: CheckCircle2 },
  { id: "ertesitesek", title: "Értesítések", icon: Bell },
  { id: "allapotok", title: "Mit jelentenek az állapotok?", icon: Tags },
  { id: "hibak", title: "Ha valamit elrontottál", icon: LifeBuoy },
  { id: "vezetoknek", title: "Irodavezetőknek", icon: UserCog },
];

const STAGE_ORDER = ["lead", "megtekintés", "ajánlat", "alku", "zárás"];
const STAGE_TITLES: Record<string, string> = {
  lead: "Lead (új érdeklődő)",
  megtekintés: "Megtekintés",
  ajánlat: "Ajánlat",
  alku: "Alku",
  zárás: "Zárás",
};

export default function GuidePage() {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Használati útmutató"
        description="Lépésről lépésre: hogyan vegyél fel érdeklődőt, vezess üzletet, és mit kell tenned nap mint nap."
        action={<PrintButton />}
      />

      <Card className="flex items-start gap-3 border-accent/30 bg-accent-soft/40 p-5">
        <Compass className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={2} />
        <div className="text-sm text-foreground">
          <div className="text-base font-semibold">Az aranyszabály</div>
          <p className="mt-1">
            <b>Minden ügyfélnek és üzletnek legyen következő lépése, határidővel.</b> Ha elvégeztél valamit, a rendszer
            megkérdezi: „Mi a következő lépés?” — mindig adj meg egyet (pl. „Holnap 10:00 – visszahívni”). Így semmi nem
            felejtődik el, és a kollégák is látják, hol tart az ügy.
          </p>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Gyors kezdés szerepek szerint</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <RoleCard
            title="Irodai munkatárs"
            items={[
              ["Reggel: Áttekintés → „Mai teendőid”", "napi-rutin"],
              ["Bejövő hívás, e-mail: kontakt felvétele", "uj-erdeklodo"],
              ["Új érdeklődők felhívása, állapot átállítása", "felhivas"],
              ["Megtekintések, visszahívások időpontra", "teendo"],
              ["Ingatlanok adatai és fotói", "ingatlan"],
            ]}
          />
          <RoleCard
            title="Értékesítő (terepen)"
            items={[
              ["Telefonon a „Ma” fül: mit kell ma csinálnod", "terep"],
              ["Hívás egy koppintással, utána „Felhívtam”", "felhivas"],
              ["Megtekintés után jegyzet + következő lépés", "terep"],
              ["Üzlet továbbléptetése a következő szakaszba", "uzlet"],
              ["Értesítések bekapcsolása a telefonon", "ertesitesek"],
            ]}
          />
          <RoleCard
            title="Irodavezető"
            items={[
              ["Kollégák meghívása, szerepek", "vezetoknek"],
              ["Ki kinek a felelőse (kiosztás)", "vezetoknek"],
              ["Szakaszok és útmutatók testreszabása", "uzlet"],
              ["Elakadt üzletek, riportok", "vezetoknek"],
              ["Lezárás: nyertes / elveszett", "lezaras"],
            ]}
          />
        </div>
      </section>

      <nav className="flex flex-col gap-2 print:hidden">
        <h2 className="text-base font-semibold text-foreground">Tartalom</h2>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map(({ id, title, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:border-accent/50 hover:text-accent"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              {title}
            </a>
          ))}
        </div>
      </nav>

      <Section id="napi-rutin">
        <p>
          Minden reggel az <Ref href="/dashboard">Áttekintés</Ref> oldal tetején a <b>„Mai teendőid”</b> blokk mutatja, mi
          vár rád. Haladj balról jobbra:
        </p>
        <Steps
          items={[
            <>
              <b>1. Mai és lejárt feladatok</b> — amit ma el kell végezned. A lejártak pirossal látszanak. Ha kész, kattints a
              kör ikonra mellette.
            </>,
            <>
              <b>2. Hívd fel őket</b> — új érdeklődők, akiket még senki nem keresett. Minél hamarabb hívod, annál nagyobb az
              esély.
            </>,
            <>
              <b>3. Elakadt üzleteid</b> — üzletek, amelyeknek nincs következő lépése. Nyisd meg, és adj hozzá egy teendőt
              határidővel.
            </>,
          ]}
        />
        <Tip>
          Ha mindhárom oszlop zöld pipát mutat, mindennel naprakész vagy. A telefonra reggel összefoglaló értesítés is jön
          (ld. <a href="#ertesitesek" className={linkClass}>Értesítések</a>).
        </Tip>
      </Section>

      <Section id="uj-erdeklodo">
        <Where web mobile />
        <Steps
          items={[
            <>
              Kattints az oldalsáv tetején az <b>„Új felvétele” → „Új kontakt”</b> gombra (mobilon: <b>Kontaktok</b> fül, jobb
              alsó <b>+</b> gomb).
            </>,
            <>
              Add meg a <b>nevet</b> és legalább a <b>telefonszámot</b> vagy az <b>e-mail címet</b>. A „Honnan jött?” mezőben
              jelöld, honnan érkezett (telefon, weboldal, ajánlás…).
            </>,
            <>
              A megjegyzésbe írd, <b>mit keres</b>: pl. „2 szobás lakás a belvárosban, 60 M Ft-ig, hitellel”.
            </>,
            <>
              Ha a rendszer szól, hogy <b>már van ilyen kontakt</b>, nyisd meg a meglévőt — így nem lesz ugyanaz az ügyfél kétszer.
            </>,
          ]}
        />
        <Tip>
          A weboldalról (érdeklődő-űrlapról) érkezők maguktól bekerülnek az{" "}
          <Ref href="/dashboard/leads">Új érdeklődők</Ref> közé, és a felelős értékesítő értesítést kap róluk.
        </Tip>
      </Section>

      <Section id="felhivas">
        <Where web mobile />
        <Steps
          items={[
            <>
              Hívd fel az érdeklődőt (mobilon a zöld <b>telefon</b> gombbal egy koppintás).
            </>,
            <>
              Utána állítsd az állapotát <b>„Megkeresve”</b>-re. Mobilon a „Ma” fülön a <b>„Felhívtam”</b> gomb ezt egy lépésben
              elintézi, és a hívást is rögzíti.
            </>,
            <>
              Írd le röviden, mit beszéltetek (jegyzet vagy „Hívás” bejegyzés).
            </>,
            <>
              Adj meg <b>következő lépést</b>: pl. megtekintés időponttal, vagy „Péntek 10:00 – visszahívni”.
            </>,
            <>
              Ha komoly vevő/bérlő (tudod, mit keres, és van rá kerete), állítsd <b>„Minősített”</b>-re, és{" "}
              <b>nyiss neki üzletet</b> (a kontakt oldalán „+ Új üzlet”).
            </>,
          ]}
        />
      </Section>

      <Section id="teendo">
        <Where web mobile />
        <p>
          A teendő mindig egy ügyfélhez vagy üzlethez tartozik, így később is visszakereshető, mi történt. Az ügyfél vagy
          üzlet oldalán, az <b>„Új jegyzet vagy teendő”</b> résznél:
        </p>
        <Steps
          items={[
            <>
              Válaszd ki a <b>típust</b>: Hívás, Megtekintés, Emlékeztető vagy Jegyzet.
            </>,
            <>
              Add meg a <b>határidőt</b> napra és órára (mobilon gyors gombok: Ma, Holnap, 9:00, 14:00… vagy „Pontos idő”).
              Határidő nélkül csak jegyzet lesz belőle, nem jelenik meg a teendők között.
            </>,
            <>
              <b>Kinek a feladata?</b> — alapból te, de átadhatod egy kollégának; ő értesítést kap róla.
            </>,
            <>
              Ha rendszeres (pl. hetente visszahívni), állíts be <b>ismétlődést</b>.
            </>,
          ]}
        />
        <Tip>
          A határidő előtt kb. egy órával a telefonod emlékeztet. Az összes teendőd a{" "}
          <Ref href="/dashboard/tasks">Teendők</Ref> oldalon és a <Ref href="/dashboard/calendar">Naptárban</Ref> is látod.
        </Tip>
      </Section>

      <Section id="uzlet">
        <Where web mobile />
        <p>
          Az <b>üzlet</b> egy ügyfél konkrét vételi vagy bérlési ügye. Az <Ref href="/dashboard/pipeline">Üzletek</Ref>{" "}
          oldalon minden folyamatban lévő üzlet kártyaként látszik; ahogy halad az ügy, húzd a kártyát a következő
          szakaszba (mobilon: az üzlet oldalán koppints a szakaszra). Az üzlet oldalán a <b>„Mit kell most tenned?”</b> doboz
          mindig megmondja a teendőt.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {STAGE_ORDER.map((key, i) => (
            <Card key={key} className="flex flex-col gap-1.5 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs text-white">
                  {i + 1}
                </span>
                {STAGE_TITLES[key]}
              </div>
              <p className="text-muted">{DEFAULT_STAGE_GUIDANCE[key]}</p>
            </Card>
          ))}
        </div>
        <Tip>
          A szakaszok nevét és a hozzájuk tartozó útmutatót az iroda a{" "}
          <Ref href="/dashboard/pipeline/stages">Szakaszok</Ref> oldalon a saját folyamatára szabhatja.
        </Tip>
      </Section>

      <Section id="ingatlan">
        <Where web mobile />
        <Steps
          items={[
            <>
              <b>„Új felvétele” → „Új ingatlan”</b> (mobilon: <b>Ingatlanok</b> fül, <b>+</b> gomb).
            </>,
            <>
              Csak a <b>cím</b> kötelező, de add meg a hirdetés típusát (eladó/kiadó) és az árat is. A többi adat (fűtés,
              emelet, állapot, parkolás…) a „Részletek a hirdetéshez” résznél tölthető ki (mobilon: „További részletek”) —
              minél több, annál jobb a hirdetés és az AI-leírás.
            </>,
            <>
              <b>Fotók</b>: a weben az ingatlan űrlapjának „Fotó hozzáadása” mezőjével, mentésenként egyet; mobilon az
              ingatlan oldalán <b>„Fotózás”</b> (azonnal a kamerával) vagy <b>„Galériából”</b>, akár egyszerre többet.
            </>,
            <>
              A <b>„Nyilvános oldal”</b> / <b>„Megosztás”</b> gombbal az ingatlan linkje elküldhető az ügyfélnek; az oldalon
              érdeklődő-űrlap is van.
            </>,
          ]}
        />
      </Section>

      <Section id="terep">
        <Where mobile />
        <p>A telefonos alkalmazás a terepen dolgozó értékesítőknek készült:</p>
        <Steps
          items={[
            <>
              <b>Ma fül</b>: a mai teendőid, a felhívandó érdeklődők és az elakadt üzleteid. Felül választhatsz:{" "}
              <b>„Az én feladataim”</b> vagy <b>„Az egész iroda”</b>.
            </>,
            <>
              <b>Megtekintés után</b>: nyisd meg az ügyfelet vagy az üzletet, és rögzítsd jegyzetben a benyomásokat (mi
              tetszett, mi nem, mennyire komoly).
            </>,
            <>
              Ha egy teendőt <b>késznek jelölsz</b>, a telefon megkérdezi: <b>„Mi a következő lépés?”</b> — add meg rögtön,
              így az ügy nem akad el.
            </>,
            <>
              Új ügyfelet, ingatlant (fotókkal) és üzletet is felvehetsz a telefonról; minden azonnal megjelenik a weben is.
            </>,
          ]}
        />
        <Tip>A telefonos alkalmazásba ugyanazzal az e-mail címmel és jelszóval lépsz be, mint a weben.</Tip>
      </Section>

      <Section id="lezaras">
        <Where web mobile />
        <Steps
          items={[
            <>
              <b>Sikeres üzlet</b>: az üzlet oldalán <b>„Nyertesnek jelölés”</b>. Előtte add meg a <b>végleges árat</b> és a{" "}
              <b>jutalék %-át</b> — a rendszer kiszámolja a jutalékot, és megjelenik a riportokban.
            </>,
            <>
              Zárásnál érdemes létrehozni az <b>adásvételi ellenőrzőlistát</b> (foglaló, ügyvéd, földhivatal, közművek,
              kulcsátadás) és sorban kipipálni.
            </>,
            <>
              <b>Meghiúsult üzlet</b>: <b>„Elveszettnek jelölés”</b>, és írd be röviden az okát (pl. „máshol vásárolt”, „túl
              drága”). Az okokból a riportban látszik, min érdemes javítani. Egy elveszett üzlet bármikor{" "}
              <b>újranyitható</b>.
            </>,
          ]}
        />
      </Section>

      <Section id="ertesitesek">
        <Where mobile />
        <p>A telefonos alkalmazás értesítést küld, ha:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>új érdeklődő érkezett hozzád (vagy az irodához, ha még nincs felelőse),</li>
          <li>egy teendőd kb. egy órán belül esedékes,</li>
          <li>egy kolléga rád bízott egy ügyfelet, üzletet vagy feladatot,</li>
          <li>reggel: összefoglaló a napodról.</li>
        </ul>
        <Tip>
          Az első belépéskor a telefon engedélyt kér — nyomj az <b>Engedélyezés</b>-re. Ha véletlenül elutasítottad, a „Ma”
          fülön sárga sáv jelzi; koppints rá, és a telefon Beállításaiban kapcsold be. Az értesítésre koppintva rögtön a
          megfelelő ügyfél vagy üzlet nyílik meg.
        </Tip>
      </Section>

      <Section id="allapotok">
        <p>Az ügyfél (kontakt) állapota megmutatja, hol tart vele a kapcsolat:</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <Card key={key} className="p-4 text-sm">
              <div className="font-semibold text-foreground">{label}</div>
              <p className="mt-1 text-muted">{STATUS_HELP[key]}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="hibak">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <b>Elírtál valamit?</b> Minden adat utólag szerkeszthető: az ügyfél, üzlet vagy ingatlan oldalán (mobilon a
            jobb felső ceruza ikonnal), a bejegyzésekre kattintva pedig a teendők is.
          </li>
          <li>
            <b>Véletlenül töröltél?</b> A törölt ügyfelek, ingatlanok és üzletek <b>30 napig</b> a{" "}
            <Ref href="/dashboard/trash">Lomtárban</Ref> maradnak, onnan visszaállíthatók.
          </li>
          <li>
            <b>Kétszer vettél fel valakit?</b> A Kontaktok oldalon a <b>„Duplikátumok”</b> gombbal összevonhatók.
          </li>
          <li>
            <b>Ki módosította?</b> Az <Ref href="/dashboard/audit-log">Előzmények</Ref> oldal mutatja, ki mikor mit hozott
            létre, módosított vagy törölt.
          </li>
          <li>
            Egy funkcióval kapcsolatos részletes kérdésre a <Ref href="/dashboard/help">Súgó</Ref> válaszol.
          </li>
        </ul>
      </Section>

      <Section id="vezetoknek">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <b>Kollégák meghívása</b>: <Ref href="/dashboard/team">Csapat</Ref> oldal, e-mail cím megadásával. Admin
            szerepkörrel a kolléga a csapatot és a szakaszokat is kezelheti.
          </li>
          <li>
            <b>Ki kinek a felelőse</b>: az ügyfél és az üzlet adatainál a „Felelős” mező; a Kontaktok listán több ügyfél
            egyszerre is kiosztható. A weboldalról érkező érdeklődők automatikusan, sorban is kioszthatók (
            <Ref href="/dashboard/settings">Beállítások</Ref> → Iroda).
          </li>
          <li>
            <b>Szakaszok és útmutatók</b>: a <Ref href="/dashboard/pipeline/stages">Szakaszok</Ref> oldalon átnevezhetők,
            sorrendezhetők, és megírható, mit kell bennük tenni — ez jelenik meg mindenkinél a „Mit kell most tenned?”
            dobozban.
          </li>
          <li>
            <b>Áttekintés</b>: az Áttekintés oldalon a „Mai teendőid” mellett az iroda számai, a{" "}
            <Ref href="/dashboard/reports">Riportok</Ref> oldalon pedig a csapat teljesítménye, a várható bevétel és az
            elvesztett üzletek okai látszanak.
          </li>
          <li>
            A <Ref href="/dashboard/tasks">Teendők</Ref> oldalon a „Kié” szűrővel az egész iroda feladatai is
            megnézhetők.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ id, children }: { id: string; children: ReactNode }) {
  const meta = SECTIONS.find((s) => s.id === id)!;
  const Icon = meta.icon;
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3 break-inside-avoid text-sm leading-relaxed text-foreground">
      <h2 className="flex items-center gap-2 border-b border-border-subtle pb-2 text-lg font-semibold text-foreground">
        <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
        {meta.title}
      </h2>
      {children}
    </section>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-4 py-3 text-sm text-muted">
      <b className="text-foreground">Tipp: </b>
      {children}
    </div>
  );
}

function Where({ web, mobile }: { web?: boolean; mobile?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      {web && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">Weben</span>}
      {mobile && (
        <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">
          Telefonon
        </span>
      )}
    </div>
  );
}

function Ref({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  );
}

function RoleCard({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {title}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map(([label, anchor]) => (
          <li key={label}>
            <a href={`#${anchor}`} className="text-foreground hover:text-accent">
              → {label}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
