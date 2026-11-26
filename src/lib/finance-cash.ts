import { settledAmount, type InvoiceRow } from "@/lib/finance";

/**
 * Pénztár (kinél mennyi készpénz van) — a számítás egy helyen.
 *
 * Készpénzes tétel: kategóriája „Készpénz felvétel / befizetés”, vagy a fizetés módja készpénz.
 *  - kp felvétel (bejövő, cash kategória): + a felvevőnél
 *  - kp befizetés (kimenő, cash kategória): − annál, aki befizette
 *  - készpénzes kiadás (bejövő, kifizetve): − annál, aki fizette
 *  - készpénzes bevétel (kimenő, megérkezett): + annál, aki átvette
 * Átadás két személy között: − az átadónál, + az átvevőnél.
 */

export const CASH_INVOICE_SELECT =
  "id, company_id, direction, category, payment_method, counterparty_name, description, invoice_number, issue_date, paid_date, gross_amount, paid_amount, szja_withheld, currency, cash_person_id";

export type CashInvoice = Pick<
  InvoiceRow,
  "id" | "company_id" | "direction" | "category" | "payment_method" | "counterparty_name" | "description" | "invoice_number" | "issue_date" | "paid_date" | "gross_amount" | "paid_amount" | "szja_withheld" | "currency"
> & { cash_person_id: string | null };

export type CashTransfer = {
  id: string;
  company_id: string;
  transfer_date: string;
  amount: number;
  currency: "HUF" | "EUR";
  from_person_id: string | null;
  to_person_id: string | null;
  note: string | null;
};

export type CashKind = "withdrawal" | "deposit" | "expense" | "income";

export const CASH_KIND_LABELS: Record<CashKind, string> = {
  withdrawal: "Kp felvétel",
  deposit: "Kp befizetés a bankba",
  expense: "Készpénzes kiadás",
  income: "Készpénzes bevétel",
};

/** Számít-e a pénztárba (és ha igen, milyen mozgás), illetve mennyivel változtatja a kezelő egyenlegét. */
export function cashEffect(inv: CashInvoice): { kind: CashKind; date: string; amount: number } | null {
  if (inv.category === "cash") {
    const amount = Number(inv.gross_amount);
    const date = inv.paid_date ?? inv.issue_date;
    return inv.direction === "in" ? { kind: "withdrawal", date, amount } : { kind: "deposit", date, amount: -amount };
  }
  if (inv.payment_method !== "cash" || !inv.paid_date) return null;
  const amount = settledAmount(inv);
  return inv.direction === "in" ? { kind: "expense", date: inv.paid_date, amount: -amount } : { kind: "income", date: inv.paid_date, amount };
}

export type CashBalance = {
  personId: string;
  balance: number;
  withdrawn: number;
  deposited: number;
  spent: number;
  received: number;
  transferredIn: number;
  transferredOut: number;
  lastMove: string | null;
};

/** Személyenkénti egyenleg (csak forint — az euró készpénz külön ritka eset, nem keverjük). */
export function cashBalances(invoices: CashInvoice[], transfers: CashTransfer[]): Map<string, CashBalance> {
  const map = new Map<string, CashBalance>();
  const get = (id: string) => {
    if (!map.has(id)) map.set(id, { personId: id, balance: 0, withdrawn: 0, deposited: 0, spent: 0, received: 0, transferredIn: 0, transferredOut: 0, lastMove: null });
    return map.get(id)!;
  };
  const touch = (b: CashBalance, d: string) => {
    if (!b.lastMove || d > b.lastMove) b.lastMove = d;
  };
  for (const inv of invoices) {
    if (!inv.cash_person_id || inv.currency !== "HUF") continue;
    const e = cashEffect(inv);
    if (!e) continue;
    const b = get(inv.cash_person_id);
    b.balance += e.amount;
    if (e.kind === "withdrawal") b.withdrawn += e.amount;
    if (e.kind === "deposit") b.deposited -= e.amount;
    if (e.kind === "expense") b.spent -= e.amount;
    if (e.kind === "income") b.received += e.amount;
    touch(b, e.date);
  }
  for (const t of transfers) {
    if (t.currency !== "HUF") continue;
    const amount = Number(t.amount);
    if (t.from_person_id) {
      const b = get(t.from_person_id);
      b.balance -= amount;
      b.transferredOut += amount;
      touch(b, t.transfer_date);
    }
    if (t.to_person_id) {
      const b = get(t.to_person_id);
      b.balance += amount;
      b.transferredIn += amount;
      touch(b, t.transfer_date);
    }
  }
  return map;
}
