// Pénzügyek modul: közös típusok, feliratok és tiszta (szerver-import nélküli)
// számítások — a kliens-űrlapok élő előnézete és a szerver ugyanezt használja.
// Dátumok mindenhol "YYYY-MM-DD" szövegként (date oszlopok), időzóna-mentesen.

export type Direction = "out" | "in";
export type DocType = "invoice" | "proforma" | "none";
export type PaymentMethod = "transfer" | "card" | "cash";
export type Currency = "HUF" | "EUR";
export type Frequency = "monthly" | "quarterly" | "yearly" | "once";
export type InvoiceStatus = "planned" | "open" | "overdue" | "paid" | "done";

export const DIRECTION_LABELS: Record<Direction, string> = {
  out: "Kimenő (bevétel)",
  in: "Bejövő (kiadás)",
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  invoice: "Számla",
  proforma: "Díjbekérő",
  none: "Bizonylat nélkül",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: "Átutalás",
  card: "Bankkártya",
  cash: "Készpénz",
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: "Havonta",
  quarterly: "Negyedévente",
  yearly: "Évente",
  once: "Egyszer (megadott napon)",
};

export const CATEGORIES: { value: string; label: string }[] = [
  { value: "rent", label: "Bérleti díj" },
  { value: "utility", label: "Rezsi / továbbszámlázott rezsi" },
  { value: "deposit", label: "Kaució" },
  { value: "service", label: "Szolgáltatás, díj" },
  { value: "supplies", label: "Beszerzés, eszköz, anyag" },
  { value: "salary", label: "Bér és járulék" },
  { value: "tax", label: "Adó (NAV, SZJA, TB, szocho)" },
  { value: "bank", label: "Bankköltség" },
  { value: "cash", label: "Készpénz felvétel / befizetés" },
  { value: "loan", label: "Tagi kölcsön" },
  { value: "other", label: "Egyéb" },
];

// Egyéb céges kiadások (a Kiadások fül és a gyors rögzítés ezeket mutatja) — a
// bérleti díj, rezsi, kaució, bér, adó és tagi kölcsön saját folyamatban fut.
export const EXPENSE_CATEGORY_VALUES = ["supplies", "service", "bank", "cash", "other"] as const;

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const VAT_OPTIONS: { value: string; label: string }[] = [
  { value: "27", label: "27%" },
  { value: "18", label: "18%" },
  { value: "5", label: "5%" },
  { value: "0", label: "0% / mentes (AAM, TAM)" },
  { value: "", label: "Nincs ÁFA" },
];

// A bemutató (minta) tételek jelölője — ez alapján törölhetők egy kattintással
export const SAMPLE_MARKER = "Mintaadat — a Pénzügyek áttekintésén egy kattintással törölhető";

// Magánszemély bérbeadótól bérelt lakásnál a kifizető vonja le az SZJA-t:
// a bérleti díj 90%-a (10% költséghányad) után 15%.
export const SZJA_BASE_RATIO = 0.9;
export const SZJA_RATE = 0.15;

export type InvoiceRow = {
  id: string;
  company_id: string;
  schedule_id: string | null;
  direction: Direction;
  doc_type: DocType;
  category: string;
  is_planned: boolean;
  invoice_number: string | null;
  counterparty_name: string;
  counterparty_tax_number: string | null;
  contact_id: string | null;
  property_id: string | null;
  location: string | null;
  description: string;
  period_start: string | null;
  period_end: string | null;
  issue_date: string;
  fulfillment_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  bank_booked_date: string | null;
  payment_method: PaymentMethod;
  currency: Currency;
  net_amount: number;
  vat_rate: number | null;
  vat_amount: number;
  gross_amount: number;
  szja_withheld: boolean;
  paid_amount: number | null;
  notes: string | null;
};

export const INVOICE_SELECT =
  "id, company_id, schedule_id, direction, doc_type, category, is_planned, invoice_number, counterparty_name, counterparty_tax_number, contact_id, property_id, location, description, period_start, period_end, issue_date, fulfillment_date, due_date, paid_date, bank_booked_date, payment_method, currency, net_amount, vat_rate, vat_amount, gross_amount, szja_withheld, paid_amount, notes";

export type ScheduleRow = {
  id: string;
  company_id: string;
  direction: Direction;
  doc_type: DocType;
  category: string;
  counterparty_name: string;
  counterparty_tax_number: string | null;
  contact_id: string | null;
  property_id: string | null;
  location: string | null;
  description: string;
  currency: Currency;
  net_amount: number;
  vat_rate: number | null;
  szja_withheld: boolean;
  payment_method: PaymentMethod;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  issue_day: number;
  payment_days: number;
  prorate: boolean;
  lead_days: number;
  active: boolean;
  next_period_start: string;
  notes: string | null;
};

export const SCHEDULE_SELECT =
  "id, company_id, direction, doc_type, category, counterparty_name, counterparty_tax_number, contact_id, property_id, location, description, currency, net_amount, vat_rate, szja_withheld, payment_method, frequency, start_date, end_date, issue_day, payment_days, prorate, lead_days, active, next_period_start, notes";

export type CompanyRow = {
  id: string;
  name: string;
  tax_number: string | null;
  address: string | null;
  bank_account: string | null;
  color: string | null;
};

// ---------- pénz ----------

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Forint egészre, euró 2 tizedesre kerekítve. */
export function roundMoney(n: number, currency: Currency): number {
  return currency === "HUF" ? Math.round(n) : round2(n);
}

/** "1 234 567,5" / "1234567.5" / "1 234 567 Ft" → szám; üres/hibás → null. */
export function parseAmount(raw: unknown): number | null {
  const s = String(raw ?? "")
    .replace(/\s|Ft|€|EUR|HUF/gi, "")
    .replace(",", ".")
    .trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(n: number | null | undefined, currency: Currency = "HUF"): string {
  if (n === null || n === undefined) return "—";
  return currency === "HUF"
    ? `${Math.round(n).toLocaleString("hu-HU")} Ft`
    : `${n.toLocaleString("hu-HU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Bruttó és ÁFA a nettóból (a kulcs null = nincs ÁFA). */
export function computeGross(net: number, vatRate: number | null, currency: Currency) {
  const vat = vatRate ? roundMoney((net * vatRate) / 100, currency) : 0;
  return { vat, gross: roundMoney(net + vat, currency) };
}

export function szjaAmount(gross: number, currency: Currency = "HUF"): number {
  return roundMoney(gross * SZJA_BASE_RATIO * SZJA_RATE, currency);
}

/** Ténylegesen fizetendő összeg: SZJA-levonásnál a bruttó mínusz a levont adó. */
export function payableAmount(inv: Pick<InvoiceRow, "gross_amount" | "szja_withheld" | "currency">): number {
  const gross = Number(inv.gross_amount);
  return inv.szja_withheld ? gross - szjaAmount(gross, inv.currency) : gross;
}

/** A pénzmozgásban szereplő összeg: a ténylegesen fizetett, különben a fizetendő. */
export function settledAmount(inv: Pick<InvoiceRow, "gross_amount" | "szja_withheld" | "currency" | "paid_amount">): number {
  return inv.paid_amount !== null && inv.paid_amount !== undefined ? Number(inv.paid_amount) : payableAmount(inv);
}

// ---------- dátum ----------

export function todayIso(): string {
  // Budapesti naptári nap (a szerver UTC-ben fut)
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(dateIso: string, days: number): string {
  const [y, m, d] = parts(dateIso);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function addMonths(dateIso: string, months: number): string {
  const [y, m] = parts(dateIso);
  const total = y * 12 + (m - 1) + months;
  return iso(Math.floor(total / 12), (total % 12) + 1, 1);
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  return d.replaceAll("-", ".");
}

export function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return "";
  return end && end !== start ? `${formatDate(start)}–${formatDate(end)}` : formatDate(start);
}

// ---------- státusz ----------

export function invoiceStatus(inv: Pick<InvoiceRow, "is_planned" | "paid_date" | "bank_booked_date" | "payment_method" | "due_date">, today = todayIso()): InvoiceStatus {
  if (inv.is_planned) return "planned";
  if (inv.paid_date) {
    // Készpénznél nincs banki könyvelés, a kifizetés a végállapot
    return inv.bank_booked_date || inv.payment_method === "cash" ? "done" : "paid";
  }
  if (inv.due_date && inv.due_date < today) return "overdue";
  return "open";
}

export function statusLabel(status: InvoiceStatus, direction: Direction): string {
  switch (status) {
    case "planned":
      return direction === "out" ? "Számlázandó" : "Várható";
    case "open":
      return direction === "out" ? "Kiállítva, nincs fizetve" : "Fizetendő";
    case "overdue":
      return "Lejárt";
    case "paid":
      return "Fizetve, könyvelésre vár";
    case "done":
      return "Rendezve";
  }
}

export const STATUS_VARIANT: Record<InvoiceStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  planned: "accent",
  open: "warning",
  overdue: "danger",
  paid: "neutral",
  done: "success",
};

// ---------- számla-törzs időszakai ----------

export type Occurrence = {
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  net: number;
  /** Törthavi arányosításnál: napok / teljes időszak napjai */
  ratio: number;
};

const FREQ_MONTHS: Record<Exclude<Frequency, "once">, number> = { monthly: 1, quarterly: 3, yearly: 12 };

type ScheduleTiming = Pick<
  ScheduleRow,
  "frequency" | "start_date" | "end_date" | "issue_day" | "payment_days" | "prorate" | "net_amount" | "currency"
>;

/**
 * Egy időszak a `from` napon kezdődőtől: a naptári hónap(ok)hoz igazított
 * teljes időszakot a szerződés kezdetével / végével metszi. Törthavi
 * arányosításnál a nettó a lefedett napok arányában csökken. A kiállítás
 * napja az időszak első hónapjának `issue_day`-e, de nem korábbi az időszak
 * kezdeténél (hó közepén induló bérletnél a kezdőnap).
 */
export function occurrenceFrom(s: ScheduleTiming, from: string): Occurrence | null {
  if (s.end_date && from > s.end_date) return null;
  const net = Number(s.net_amount);

  if (s.frequency === "once") {
    if (from > s.start_date) return null;
    const end = s.end_date ?? s.start_date;
    return {
      periodStart: s.start_date,
      periodEnd: end,
      issueDate: s.start_date,
      dueDate: addDays(s.start_date, s.payment_days),
      net: roundMoney(net, s.currency),
      ratio: 1,
    };
  }

  const months = FREQ_MONTHS[s.frequency];
  const [sy, sm] = parts(s.start_date);
  const anchor = iso(sy, sm, 1);
  // Melyik teljes időszakba esik a `from`?
  const [fy, fm] = parts(from);
  const offset = (fy * 12 + fm - (sy * 12 + sm));
  const fullStart = addMonths(anchor, Math.floor(offset / months) * months);
  const fullEnd = addDays(addMonths(fullStart, months), -1);

  const periodStart = from > fullStart ? from : fullStart;
  const periodEnd = s.end_date && s.end_date < fullEnd ? s.end_date : fullEnd;
  if (periodEnd < periodStart) return null;

  const fullDays = dayDiff(fullStart, fullEnd) + 1;
  const coveredDays = dayDiff(periodStart, periodEnd) + 1;
  const ratio = s.prorate ? coveredDays / fullDays : 1;

  const [py, pm] = parts(fullStart);
  const nominalIssue = iso(py, pm, Math.min(s.issue_day, daysInMonth(py, pm)));
  const issueDate = periodStart > nominalIssue ? periodStart : nominalIssue;

  return {
    periodStart,
    periodEnd,
    issueDate,
    dueDate: addDays(issueDate, s.payment_days),
    net: roundMoney(net * ratio, s.currency),
    ratio,
  };
}

/** A következő időszak kezdete egy adott időszak után. */
export function nextPeriodStart(occ: Occurrence): string {
  return addDays(occ.periodEnd, 1);
}

/** Előnézet: a következő `count` esedékesség a megadott naptól. */
export function previewOccurrences(s: ScheduleTiming, from: string, count: number): Occurrence[] {
  const out: Occurrence[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    const occ = occurrenceFrom(s, cursor);
    if (!occ) break;
    out.push(occ);
    if (s.frequency === "once") break;
    cursor = nextPeriodStart(occ);
  }
  return out;
}
