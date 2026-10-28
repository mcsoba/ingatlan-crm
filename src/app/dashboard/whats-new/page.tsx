import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { PRIVATE_EDITION } from "@/lib/edition";
import { Badge } from "@/components/ui/badge";

type Entry = { date: string; title: string; items: string[] };

const ENTRIES: Entry[] = [
  {
    date: "2026-09-18",
    title: "Nyertes/elveszett gyorsgombok, Lomtár, automatikus érdeklődő-kiosztás",
    items: [
      "Egy kattintással zárható egy üzlet nyertesre vagy vesztesre az üzlet oldalának tetejéről",
      "Törölt kontaktok/ingatlanok/üzletek 30 napig a Lomtárban maradnak, onnan visszaállíthatók",
      "Új publikus érdeklődő automatikusan, körbeforgó sorrendben kap felelős ügynököt",
      "Élőben frissülő értesítési harang — nem kell oldalt újratölteni",
      "Duplikátum-kontaktok kereső oldal, testreszabható lista-oszlopok",
    ],
  },
  {
    date: "2026-09-17",
    title: "Publikus katalógus, spam-védelem, admin-szerep",
    items: [
      "Megosztható link az iroda összes elérhető ingatlanjához, egyedi brandinggel",
      "Spam-védelem a nyilvános érdeklődés-űrlapon (honeypot + korlátozás)",
      "Előzmények (audit-log): ki mit módosított kontaktokon/ingatlanokon/dealeken",
      "Köztes „admin” csapat-szerep — a tulajdonos delegálhat anélkül, hogy mindent átadna",
      "Ingatlan- és kontakt-CSV import, megtekintés-számláló, GDPR adat-export",
      "Nyomtatható üzlet-összefoglaló, érdeklődő-webhook külső rendszerekhez",
    ],
  },
  {
    date: "2026-09-15",
    title: "Címkék, AI-eszközök, kampányok, sötét mód",
    items: [
      "Címke-rendszer kontaktokhoz és ingatlanokhoz, kampány-célzás címke szerint",
      "AI ingatlan-összehasonlító, megosztható linkkel ügyfeleknek",
      "Sötét/világos téma, mobil-oldalsáv, dashboard-grafikonok",
      "Tömeges műveletek listákon, dedikált Teendők oldal",
      "Elveszett üzlet nyomon követés, ingatlan-státusz, üzletérték összesítés",
    ],
  },
  {
    date: "2026-09-14",
    title: "Az alapok — CRM-mag és integrációk",
    items: [
      "Kontaktok, ingatlanok, pipeline (Kanban-tábla) többfelhasználós, iroda-szintű elkülönítéssel",
      "AI ingatlanleírás, follow-up email/SMS-vázlat, „Kérdezd a CRM-et” asszisztens",
      PRIVATE_EDITION ? "Email- (Resend) és SMS- (Twilio) integráció" : "Stripe-előfizetés, email- (Resend) és SMS- (Twilio) integráció",
      "Google Naptár szinkron (kétirányú), riportok, csapatkezelés",
    ],
  },
];

export default function WhatsNewPage() {
  if (PRIVATE_EDITION) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Újdonságok"
        description="Amit legutóbb hozzáadtunk a CRM-hez, dátum szerint."
      />
      <div className="flex flex-col gap-4">
        {ENTRIES.map((entry) => (
          <Card key={entry.date} className="p-4">
            <div className="flex items-center gap-2.5">
              <Badge variant="accent">{entry.date}</Badge>
              <h2 className="text-sm font-medium text-foreground">{entry.title}</h2>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 pl-4 text-sm text-muted">
              {entry.items.map((item) => (
                <li key={item} className="list-disc marker:text-muted-subtle">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
