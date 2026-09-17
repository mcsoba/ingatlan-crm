import { MarketingHeader } from "@/components/marketing-header";
import { MarketingFooter } from "@/components/marketing-footer";
import { Card } from "@/components/ui/card";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. A szolgáltatás",
    body: [
      "A jelen Általános Szerződési Feltételek (ÁSZF) a [CÉGNÉV KFT.] (székhely: [SZÉKHELY CÍME], cégjegyzékszám: [CÉGJEGYZÉKSZÁM], adószám: [ADÓSZÁM], a továbbiakban: Szolgáltató) által üzemeltetett Ingatlan CRM elnevezésű, ingatlanos ügynökök és irodák számára nyújtott felhő alapú (SaaS) ügyfélkezelő szolgáltatás (a továbbiakban: Szolgáltatás) igénybevételének feltételeit tartalmazza.",
      "A Szolgáltatás regisztrációval, Ingyenes vagy Pro előfizetői csomag formájában vehető igénybe, az aktuális díjazást a /pricing oldal tartalmazza.",
    ],
  },
  {
    title: "2. Előfizetés és díjazás",
    body: [
      "A Pro csomag havidíjas előfizetés, amelynek díja a bankkártya-adatok megadásával, a Szolgáltatás fizetési szolgáltatóján (Stripe) keresztül kerül levonásra, a megrendeléstől számítva havonta ismétlődően.",
      "Az előfizetés bármikor, a következő számlázási ciklus kezdetéig lemondható a Szolgáltatáson belüli előfizetés-kezelő felületen. A már kiszámlázott, folyó időszakra eső díj nem jár vissza.",
      "A Szolgáltató fenntartja a jogot az árazás módosítására; a módosítás a meglévő előfizetőkre legkorábban a következő számlázási ciklustól, előzetes értesítést követően lép hatályba.",
    ],
  },
  {
    title: "3. Az Előfizető adatai, adatkezelés",
    body: [
      "A Szolgáltatás keretében az Előfizető saját ügyfeleinek (kontaktjainak) adatait rögzíti és kezeli. Ebben a viszonyban az Előfizető minősül adatkezelőnek, a Szolgáltató pedig adatfeldolgozóként jár el — az Előfizető felelőssége, hogy saját ügyfeleit a vonatkozó adatvédelmi jogszabályoknak (GDPR) megfelelően tájékoztassa és jogalapot biztosítson az adatkezeléshez.",
      "A Szolgáltató és az Előfizető közötti adatkezelésről a Szolgáltató saját Adatvédelmi tájékoztatója (/legal/privacy) ad tájékoztatást.",
    ],
  },
  {
    title: "4. Felelősségkorlátozás",
    body: [
      "A Szolgáltatás \"ahogy van\" alapon kerül biztosításra. A Szolgáltató a tőle elvárható gondossággal törekszik a folyamatos, hibamentes működésre, de nem vállal felelősséget a Szolgáltatás megszakadásából, az AI-funkciók (pl. automatikusan generált ingatlanleírás, email-vázlat, lead-pontozás) esetleges pontatlanságából, vagy harmadik fél szolgáltatóinak (fizetés, email-, SMS- és naptár-integrációk) kieséséből eredő közvetett károkért.",
      "Az AI által generált tartalmakat az Előfizető mindig köteles ellenőrizni és jóváhagyni felhasználás előtt.",
    ],
  },
  {
    title: "5. A szerződés megszűnése",
    body: [
      "Az Előfizető fiókját bármikor törölheti, illetve az előfizetést a 2. pont szerint mondhatja le. A Szolgáltató jogosult a Szolgáltatás igénybevételét felfüggeszteni vagy a szerződést felmondani, ha az Előfizető a jelen ÁSZF-et súlyosan megszegi.",
    ],
  },
  {
    title: "6. Egyéb rendelkezések",
    body: [
      "A jelen ÁSZF-ben nem szabályozott kérdésekben a magyar jog, elsősorban a Polgári Törvénykönyv rendelkezései irányadók.",
      "Kapcsolat: [KAPCSOLATI EMAIL]",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />

      <section className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Általános Szerződési Feltételek
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
