import { categoryLabel, settledAmount, type InvoiceRow } from "@/lib/finance";

/**
 * Havi pénzmozgás a bankszámlán — a tételekből számolva.
 *
 * Bankmozgás: minden kifizetett tétel, ami nem készpénzben ment (átutalás, kártya), plusz a
 * kp felvétel (a bankból ki) és a kp befizetés (a bankba be). A készpénzes blokk NEM bankmozgás
 * (az a Pénztárban látszik). A sztornózott tételek kimaradnak (nem mozgott pénz).
 * Dátum: a banki könyvelés napja, ha nincs, a fizetésé.
 */
export type FlowInvoice = Pick<
  InvoiceRow,
  "id" | "direction" | "category" | "payment_method" | "paid_date" | "bank_booked_date" | "gross_amount" | "paid_amount" | "szja_withheld" | "currency" | "counterparty_name"
>;

export type BankMove = { id: string; date: string; amount: number; group: string };

export function bankMoves(rows: FlowInvoice[], cancelled: Set<string>): BankMove[] {
  const out: BankMove[] = [];
  for (const r of rows) {
    if (!r.paid_date || r.currency !== "HUF" || cancelled.has(r.id)) continue;
    if (r.category !== "cash" && r.payment_method === "cash") continue;
    const amount = settledAmount(r) * (r.direction === "out" ? 1 : -1);
    if (!amount) continue;
    // Csoportosítás, ahogy a „Kimutatás” lapon: a rendszeres tételek a partner nevén, a többi kategóriánként
    const group =
      r.category === "cash"
        ? r.direction === "in"
          ? "Kp felvétel"
          : "Kp befizetés"
        : ["bank", "salary", "tax", "loan"].includes(r.category)
          ? categoryLabel(r.category)
          : r.counterparty_name;
    out.push({ id: r.id, date: r.bank_booked_date ?? r.paid_date, amount, group });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export type Checkpoint = { id: string; balance_date: string; balance: number; note: string | null };

export type MonthFlow = {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  opening: number;
  closing: number;
  /** a hónapban rögzített tényleges egyenleg(ek) és az eltérés a számítotthoz képest */
  checks: { checkpoint: Checkpoint; computed: number; diff: number }[];
  incomeGroups: [string, number][];
  expenseGroups: [string, number][];
};

const monthEnd = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
};

/**
 * Egyenleg-lánc: egy nap végén az egyenleg = a legutóbbi (aznapi vagy korábbi) tényleges
 * egyenleg + az azóta történt mozgások; tényleges egyenleg nélkül 0-ról indul.
 */
export function monthlyFlows(moves: BankMove[], checkpoints: Checkpoint[], months: string[]): MonthFlow[] {
  const cps = [...checkpoints].sort((a, b) => a.balance_date.localeCompare(b.balance_date));
  const balanceAt = (day: string, excludeCheckpointOn?: string) => {
    const anchor = [...cps].reverse().find((c) => c.balance_date <= day && c.balance_date !== excludeCheckpointOn);
    const from = anchor?.balance_date ?? "0000-00-00";
    let bal = anchor ? Number(anchor.balance) : 0;
    for (const m of moves) if (m.date > from && m.date <= day) bal += m.amount;
    return bal;
  };
  const prevDay = (d: string) => {
    const t = new Date(d + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() - 1);
    return t.toISOString().slice(0, 10);
  };
  return months.map((month) => {
    const start = `${month}-01`;
    const end = monthEnd(month);
    const inMonth = moves.filter((m) => m.date >= start && m.date <= end);
    const groups = (sign: 1 | -1) => {
      const g = new Map<string, number>();
      for (const m of inMonth) if (Math.sign(m.amount) === sign) g.set(m.group, (g.get(m.group) ?? 0) + Math.abs(m.amount));
      return [...g.entries()].sort((a, b) => b[1] - a[1]);
    };
    const checks = cps
      .filter((c) => c.balance_date >= start && c.balance_date <= end)
      .map((c) => {
        const computed = balanceAt(c.balance_date, c.balance_date);
        return { checkpoint: c, computed, diff: Number(c.balance) - computed };
      });
    return {
      month,
      income: inMonth.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0),
      expense: -inMonth.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0),
      opening: balanceAt(prevDay(start)),
      closing: balanceAt(end),
      checks,
      incomeGroups: groups(1),
      expenseGroups: groups(-1),
    };
  });
}
