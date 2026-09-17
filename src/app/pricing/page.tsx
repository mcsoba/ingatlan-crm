import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { PRO_PLAN_PRICE_HUF } from "@/lib/stripe";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing-header";
import { MarketingFooter } from "@/components/marketing-footer";

const FREE_FEATURES = [
  "Kontaktok és ingatlanok kezelése",
  "Pipeline kanban tábla",
  "AI ingatlanleírás és follow-up email",
];

const PRO_FEATURES = [
  "Minden az Ingyenes csomagból",
  "Korlátlan csapattag-meghívás",
  "AI lead-pontozás és 'Kérdezd a CRM-et' asszisztens",
  "Csapat-teljesítmény riportok",
  "Nyilvános ingatlan-oldalak és lead-befogó űrlap",
];

export default function PricingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Egyszerű, átlátható árazás
        </h1>
        <p className="max-w-xl text-muted">
          Kezdd ingyen, és válts Pro-ra, amikor az irodádnak már kellenek a
          csapat- és AI-funkciók. Bármikor lemondható.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-2">
        <Card className="p-6">
          <div className="text-sm font-medium text-muted">Ingyenes</div>
          <div className="mt-1 text-3xl font-semibold text-foreground">
            0 Ft
          </div>
          <p className="mt-1 text-xs text-muted-subtle">örökre, kártya nélkül</p>
          <ul className="mt-5 flex flex-col gap-2.5 text-sm text-muted">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-subtle" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className={`${buttonVariants("secondary")} mt-6 w-full`}
          >
            Kezdés ingyen
          </Link>
        </Card>

        <Card className="border-accent/40 bg-accent-soft/40 p-6">
          <div className="flex items-center gap-1.5 text-sm font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Pro
          </div>
          <div className="mt-1 text-3xl font-semibold text-foreground">
            {PRO_PLAN_PRICE_HUF.toLocaleString("hu-HU")} Ft{" "}
            <span className="text-sm font-normal text-muted">/ hó</span>
          </div>
          <p className="mt-1 text-xs text-muted-subtle">
            irodánként, bármikor lemondható
          </p>
          <ul className="mt-5 flex flex-col gap-2.5 text-sm text-muted">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className={`${buttonVariants("primary")} mt-6 w-full`}
          >
            Kezdés Pro-val
          </Link>
        </Card>
      </section>

      <MarketingFooter />
    </main>
  );
}
