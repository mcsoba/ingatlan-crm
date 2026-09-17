import { MarketingHeader } from "@/components/marketing-header";
import { MarketingFooter } from "@/components/marketing-footer";
import { Card } from "@/components/ui/card";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Adatkezelő",
    body: [
      "Adatkezelő: [CÉGNÉV KFT.], székhely: [SZÉKHELY CÍME], adószám: [ADÓSZÁM], elérhetőség: [KAPCSOLATI EMAIL].",
      "Ez a tájékoztató a Szolgáltatás regisztrált felhasználóinak (ingatlanos ügynökök, irodatagok) adatkezelésére vonatkozik. Az Előfizető által a rendszerbe felvitt saját ügyfél- (kontakt-) adatokért az Előfizető, mint önálló adatkezelő felel — lásd az ÁSZF 3. pontját.",
    ],
  },
  {
    title: "2. Milyen adatokat kezelünk",
    body: [
      "Fiók- és profiladatok: név, email cím, telefonszám, iroda-hovatartozás, szerepkör.",
      "Az Előfizető által rögzített ügyfél-, ingatlan- és pipeline-adatok (kontaktok, ingatlanok, üzletek, jegyzetek, feladatok, csatolt dokumentumok).",
      "Fizetési adatok: az előfizetés kezeléséhez szükséges adatokat a Stripe fizetési szolgáltató kezeli, bankkártya-adatot mi magunk nem tárolunk.",
      "Harmadik fél integrációk használata esetén (Google Naptár, email-küldés, SMS-küldés) az adott szolgáltatáshoz szükséges hozzáférési adatok (pl. OAuth token) és a küldött üzenetek tartalma.",
      "Technikai naplóadatok (bejelentkezési időpontok, IP-cím) a rendszer biztonságos üzemeltetéséhez.",
    ],
  },
  {
    title: "3. Az adatkezelés célja és jogalapja",
    body: [
      "A Szolgáltatás nyújtása és a fiók üzemeltetése — jogalap: szerződés teljesítése (GDPR 6. cikk (1) b)).",
      "Számlázás és az előfizetési díj beszedése — jogalap: jogi kötelezettség teljesítése, illetve szerződés teljesítése.",
      "A Szolgáltatás biztonságának és megbízható működésének fenntartása — jogalap: jogos érdek.",
      "Az AI-funkciók (pl. ingatlanleírás-generálás, lead-pontozás) az Előfizető által megadott adatokat továbbítják a mesterséges intelligencia szolgáltatónak (Anthropic) a funkció végrehajtásához szükséges mértékben.",
    ],
  },
  {
    title: "4. Adattovábbítás, adatfeldolgozók",
    body: [
      "A Szolgáltatás működtetéséhez a következő adatfeldolgozókat vesszük igénybe: Supabase (adattárolás), Anthropic (AI-funkciók), Stripe (fizetés), valamint — az Előfizető saját döntése alapján, integrációnként bekapcsolva — Resend (email-küldés), Twilio (SMS-küldés) és a Google Calendar API (naptárszinkron).",
      "Ezen szolgáltatók mindegyike saját, önálló adatvédelmi szabályzattal rendelkezik, adattovábbítás csak a funkció működéséhez szükséges mértékben történik.",
    ],
  },
  {
    title: "5. Az érintettek jogai",
    body: [
      "Az érintett kérheti a rá vonatkozó személyes adatokhoz való hozzáférést, azok helyesbítését, törlését, kezelésének korlátozását, továbbá tiltakozhat az adatkezelés ellen, valamint élhet az adathordozhatósághoz való jogával.",
      "Ezen jogok gyakorlásához, illetve panasz esetén: [KAPCSOLATI EMAIL]. Az érintett a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH) is fordulhat.",
    ],
  },
  {
    title: "6. Adatmegőrzési idő",
    body: [
      "A fiók törlését követően az Előfizető és ügyfeleinek adatait [MEGŐRZÉSI IDŐ, PL. 30 NAP] belül véglegesen töröljük, kivéve, ha jogszabály (pl. számviteli előírás) ennél hosszabb megőrzést ír elő.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />

      <section className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Adatvédelmi tájékoztató
        </h1>
        <p className="mt-1 text-sm text-muted-subtle">
          Utolsó frissítés: [DÁTUM]
        </p>

        <Card className="mt-6 border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          Ez egy jogi lektorálás nélküli sablon-szöveg, minta-struktúrával —
          éles, fizető ügyfelek fogadása előtt ügyvéddel véglegesítendő,
          és a szögletes zárójeles [PLACEHOLDER] mezőket ki kell tölteni.
        </Card>

        <div className="mt-8 flex flex-col gap-8">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-base font-medium text-foreground">
                {section.title}
              </h2>
              <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-muted">
                {section.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
