import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadFormOptions } from "../../data";
import { getSelectedCompanyId } from "@/lib/companies";
import { InvoiceForm } from "../../invoice-form";
import { PageHeader } from "@/components/ui/page-header";
import { linkClass } from "@/components/ui/styles";
import { ArrowDownLeft, ArrowUpRight, Receipt, Repeat } from "lucide-react";

// Ha nincs megadva, mit rögzít, egyszerű szavakkal rákérdezünk
const CHOICES = [
  {
    href: "/dashboard/finance/expenses",
    icon: Receipt,
    title: "Vásároltunk valamit / van egy blokk",
    text: "Tisztítószer, üzemanyag, irodaszer, kártyás vagy készpénzes fizetés — gyors rögzítés fotóval.",
  },
  {
    href: "/dashboard/finance/invoices/new?dir=in",
    icon: ArrowDownLeft,
    title: "Kaptunk egy számlát vagy díjbekérőt",
    text: "Nekünk kell kifizetni (pl. bérbeadó, közmű, szolgáltató, könyvelő).",
  },
  {
    href: "/dashboard/finance/invoices/new?dir=out",
    icon: ArrowUpRight,
    title: "Mi állítottunk ki számlát",
    text: "Nekünk fizetnek (pl. bérlő, ügyfél) — rögzítsd, hogy lássuk, mikor érkezik meg a pénz.",
  },
  {
    href: "/dashboard/finance/schedules/new",
    icon: Repeat,
    title: "Minden hónapban ismétlődik",
    text: "Pl. havi bérleti díj vagy rezsi — egyszer kell felvenni, utána a rendszer magától szól.",
  },
];

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const company = sp.company ?? (await getSelectedCompanyId()) ?? undefined;
  const dir = sp.dir;
  const supabase = await createClient();
  const options = await loadFormOptions(supabase);

  if (options.companies.length === 0) {
    return (
      <p className="text-sm text-muted">
        Előbb vegyél fel legalább egy céget a{" "}
        <Link href="/dashboard/finance/companies" className={linkClass}>
          Cégek
        </Link>{" "}
        fülön.
      </p>
    );
  }

  if (dir !== "in" && dir !== "out") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Mit szeretnél rögzíteni?" description="Válaszd ki, melyik illik rá — a megfelelő, egyszerű űrlap nyílik meg." />
        <div className="grid gap-3 sm:grid-cols-2">
          {CHOICES.map(({ href, icon: Icon, title, text }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-hover">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <div className="font-semibold text-foreground">{title}</div>
                <div className="mt-0.5 text-sm text-muted">{text}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={dir === "in" ? "Kapott számla vagy kiadás rögzítése" : "Kiállított számla rögzítése"}
        description={
          dir === "in"
            ? "Elég a csillagos mezőket kitölteni; a többi később is pótolható. Ha már kifizettétek, írd be a kifizetés dátumát."
            : "Elég a csillagos mezőket kitölteni. Ha a pénz megérkezett, a listában egy kattintással jelölheted."
        }
      />
      <InvoiceForm
        {...options}
        defaultDirection={dir === "out" ? "out" : "in"}
        defaultCompanyId={company}
        returnTo={`/dashboard/finance/invoices${company ? `?company=${company}` : ""}`}
      />
    </div>
  );
}
