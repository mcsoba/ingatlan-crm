import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  Sparkles,
  Kanban,
  Users,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI ír helyetted",
    description:
      "Hirdetési szöveg, follow-up email, hívásjegyzet-összefoglaló — egy kattintással, a saját adataidból, nem kitalálva.",
  },
  {
    icon: Kanban,
    title: "Testreszabható pipeline",
    description:
      "Húzd-és-ejtsd kanban tábla, saját szakaszokkal — pontosan úgy, ahogy az irodád dolgozik.",
  },
  {
    icon: ListChecks,
    title: "Semmi nem marad el",
    description:
      "Hívások, megtekintések, emlékeztetők egy helyen, határidővel — a kezdőlapon mindig látod, mi a következő teendő.",
  },
  {
    icon: Users,
    title: "Csapatmunka",
    description:
      "Hívd meg a kollégáidat egy kattintással, mindenki ugyanazt a kontakt- és ingatlan-adatbázist látja.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
            <Building2 className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <span className="text-sm font-semibold text-foreground">
            Ingatlan CRM
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants("ghost", "sm")}>
            Bejelentkezés
          </Link>
          <Link href="/signup" className={buttonVariants("primary", "sm")}>
            Regisztráció
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          AI-alapú CRM ingatlanosoknak
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          A CRM, ami tényleg{" "}
          <span className="text-accent">levesz a válladról</span> egy csomó
          munkát
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Kontaktok, ingatlanok és a pipeline egy helyen — az AI pedig megírja
          a hirdetést, a follow-up emailt, és összefoglalja a hívásjegyzetet,
          amíg te a következő ügyfélre koncentrálsz.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <Link href="/signup" className={buttonVariants("primary")}>
            Kezdés ingyen
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link href="/login" className={buttonVariants("secondary")}>
            Bejelentkezés
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-hover">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </div>
            <h3 className="mt-3 font-medium text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
