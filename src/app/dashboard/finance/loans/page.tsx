import Link from "next/link";
import { Building, HandCoins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getSelectedCompanyId, listCompanies } from "@/lib/companies";
import { PAYMENT_METHOD_LABELS, formatDate, formatMoney, todayIso, type PaymentMethod } from "@/lib/finance";
import { deleteInvoiceRow } from "../actions";
import { RowDelete } from "../row-delete";
import { LoanForm } from "./loan-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

type LoanRow = {
  id: string;
  direction: "in" | "out";
  counterparty_name: string;
  person_id: string | null;
  description: string;
  issue_date: string;
  paid_date: string | null;
  gross_amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
};

/**
 * Tagi kölcsön: a cég kölcsönt ad a tagnak (kifizetés → a tag tartozik a cégnek), a tag
 * visszafizeti (befizetés → csökken a tartozás). Tagonként a fennálló tartozás.
 */
export default async function LoansPage({ searchParams }: { searchParams: Promise<{ company?: string; person?: string }> }) {
  const sp = await searchParams;
  const today = todayIso();
  const companies = await listCompanies();
  const selected = await getSelectedCompanyId();
  const companyId = [sp.company, selected, companies[0]?.id].find((id) => id && companies.some((c) => c.id === id));
  if (!companyId) return <EmptyState icon={Building} title="Még nincs cég felvéve" description="Előbb vedd fel a cégeket a Cégek fülön." />;
  const supabase = await createClient();
  const [{ data: rows, error }, { data: peopleRows }] = await Promise.all([
    fetchAll<LoanRow>(() =>
      supabase
        .from("finance_invoices")
        .select("id, direction, counterparty_name, person_id, description, issue_date, paid_date, gross_amount, payment_method, notes")
        .eq("company_id", companyId)
        .eq("category", "loan")
        .order("issue_date", { ascending: false }),
    ),
    supabase.from("finance_company_people").select("id, name, role").eq("company_id", companyId).order("name"),
  ]);
  if (error) throw error;
  const people = (peopleRows ?? []) as { id: string; name: string; role: string }[];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  // Tag: a hozzárendelt személy, vagy (régi tételnél) a partner neve
  const keyOf = (r: LoanRow) => r.person_id ?? `name:${r.counterparty_name.trim().toLowerCase()}`;
  const labelOf = (k: string, r?: LoanRow) => (k.startsWith("name:") ? (r?.counterparty_name ?? k.slice(5)) : (nameOf.get(k) ?? "?"));

  type Sum = { key: string; label: string; lent: number; repaid: number; last: string; count: number };
  const sums = new Map<string, Sum>();
  for (const r of rows) {
    if (!r.paid_date) continue; // csak a ténylegesen kifizetett / visszakapott pénz számít
    const k = keyOf(r);
    const s = sums.get(k) ?? { key: k, label: labelOf(k, r), lent: 0, repaid: 0, last: r.paid_date, count: 0 };
    if (r.direction === "in") s.lent += Number(r.gross_amount);
    else s.repaid += Number(r.gross_amount);
    if (r.paid_date > s.last) s.last = r.paid_date;
    s.count++;
    sums.set(k, s);
  }
  const cards = [...sums.values()].sort((a, b) => b.lent - b.repaid - (a.lent - a.repaid));
  const total = cards.reduce((s, c) => s + c.lent - c.repaid, 0);
  const person = sp.person ?? "";
  const list = person ? rows.filter((r) => keyOf(r) === person) : rows;
  const formPeople = [...people.filter((p) => p.role === "owner" || sums.has(p.id)), ...people.filter((p) => p.role !== "owner" && !sums.has(p.id))];
  const link = (patch: Record<string, string>) => `/dashboard/finance/loans?${new URLSearchParams({ company: companyId, ...(person ? { person } : {}), ...patch })}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tagi kölcsön"
        description="A cég által a tagoknak adott kölcsönök és a visszafizetések — tagonként, mennyivel tartozik még a cégnek."
      />

      {companies.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {companies.map((c) => (
            <Link key={c.id} href={`/dashboard/finance/loans?company=${c.id}`} className={buttonVariants(c.id === companyId ? "primary" : "secondary", "sm")}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted">A tagok összesen tartoznak</span>
            <span className="text-xl font-semibold tabular-nums">{formatMoney(total)}</span>
            {person && (
              <Link href={link({ person: "" })} className="text-xs text-accent hover:underline">
                Minden tag tételei
              </Link>
            )}
          </Card>
          {cards.map((c) => {
            const owed = c.lent - c.repaid;
            return (
              <Link key={c.key} href={link({ person: c.key === person ? "" : c.key })}>
                <Card className={`flex h-full flex-col gap-1 p-4 transition-colors hover:border-accent/40 ${c.key === person ? "border-accent" : ""}`}>
                  <span className="text-xs text-muted">{c.label}</span>
                  <span className={`text-xl font-semibold tabular-nums ${owed < 0 ? "text-success" : ""}`}>{formatMoney(owed)}</span>
                  <span className="text-[11px] text-muted">
                    kapott {formatMoney(c.lent)} · visszafizetett {formatMoney(c.repaid)} · utolsó: {formatDate(c.last)}
                  </span>
                  {owed < 0 && <span className="text-[11px] text-success">Többet fizetett vissza, mint amennyit kapott — a cég tartozik neki.</span>}
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold">Új mozgás</h2>
        <LoanForm companyId={companyId} people={formPeople} today={today} />
      </Card>

      {list.length === 0 ? (
        <EmptyState icon={HandCoins} title="Még nincs tagi kölcsön" description="A fenti űrlappal rögzítheted a kiadott kölcsönt vagy a visszafizetést." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Dátum</th>
                <th className="px-2 py-2 font-medium">Tag</th>
                <th className="px-2 py-2 font-medium">Mi</th>
                <th className="px-2 py-2 font-medium">Mód</th>
                <th className="px-4 py-2 text-right font-medium">Tartozás változása</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-border-subtle last:border-0 hover:bg-background/60">
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDate(r.paid_date ?? r.issue_date)}</td>
                  <td className="px-2 py-2">{labelOf(keyOf(r), r)}</td>
                  <td className="px-2 py-2">
                    <Link href={`/dashboard/finance/invoices/${r.id}?back=${encodeURIComponent(link({}))}`} className="hover:underline">
                      {r.direction === "in" ? "Kölcsön a tagnak" : "Visszafizetés"}
                    </Link>
                    {r.notes && <div className="max-w-[360px] truncate text-xs text-muted">{r.notes.replace(/;?\s*Excel-import \([^)]*\)/, "")}</div>}
                    {!r.paid_date && <div className="text-xs text-warning">még nincs kifizetve — nem számít bele</div>}
                  </td>
                  <td className="px-2 py-2 text-xs text-muted">{PAYMENT_METHOD_LABELS[r.payment_method]}</td>
                  <td className={`whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums ${r.direction === "out" ? "text-success" : ""}`}>
                    {r.direction === "in" ? "+" : "−"}
                    {formatMoney(Number(r.gross_amount))}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <RowDelete id={r.id} action={deleteInvoiceRow} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
