import type { SupabaseClient } from "@supabase/supabase-js";
import { INVOICE_SELECT, invoiceStatus, todayIso, type InvoiceRow, type InvoiceStatus } from "@/lib/finance";

export type InvoiceFilters = {
  company?: string;
  dir?: string;
  status?: string;
  cat?: string;
  year?: string;
  month?: string;
  q?: string;
};

export const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Minden állapot" },
  { value: "todo", label: "Rendezetlen (minden nyitott)" },
  { value: "planned", label: "Számlázandó / várható" },
  { value: "open", label: "Fizetésre vár" },
  { value: "overdue", label: "Lejárt" },
  { value: "paid", label: "Fizetve, könyvelésre vár" },
  { value: "done", label: "Rendezve" },
];

function matchesStatus(status: InvoiceStatus, filter: string): boolean {
  if (!filter) return true;
  if (filter === "todo") return status !== "done";
  return status === filter;
}

/** Szűrt tétellista (a Számlák oldal és a CSV-export közös forrása). */
export async function loadInvoices(supabase: SupabaseClient, f: InvoiceFilters): Promise<InvoiceRow[]> {
  const year = Number(f.year) || null;
  const month = Number(f.month) || null;

  let query = supabase.from("finance_invoices").select(INVOICE_SELECT);
  if (f.company) query = query.eq("company_id", f.company);
  if (f.dir === "out" || f.dir === "in") query = query.eq("direction", f.dir);
  if (f.cat) query = query.eq("category", f.cat);
  if (year && month) {
    const mm = String(month).padStart(2, "0");
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    query = query.gte("issue_date", `${year}-${mm}-01`).lte("issue_date", `${year}-${mm}-${last}`);
  } else if (year) {
    query = query.gte("issue_date", `${year}-01-01`).lte("issue_date", `${year}-12-31`);
  }
  const q = f.q?.trim().replace(/[%,()]/g, " ");
  if (q) {
    query = query.or(
      ["counterparty_name", "description", "invoice_number", "location", "notes"].map((c) => `${c}.ilike.%${q}%`).join(","),
    );
  }

  const { data, error } = await query.order("issue_date", { ascending: false }).limit(3000);
  if (error) throw error;
  const today = todayIso();
  return ((data ?? []) as InvoiceRow[]).filter((inv) => matchesStatus(invoiceStatus(inv, today), f.status ?? ""));
}

export async function loadFormOptions(supabase: SupabaseClient) {
  const [companies, properties, partners] = await Promise.all([
    supabase.from("finance_companies").select("id, name").order("sort_order").order("name"),
    supabase.from("properties").select("id, address").is("deleted_at", null).order("address"),
    supabase.from("finance_invoices").select("counterparty_name").order("created_at", { ascending: false }).limit(1000),
  ]);
  return {
    companies: (companies.data ?? []) as { id: string; name: string }[],
    properties: (properties.data ?? []) as { id: string; address: string }[],
    partners: [...new Set((partners.data ?? []).map((p) => p.counterparty_name as string))].sort((a, b) =>
      a.localeCompare(b, "hu"),
    ),
  };
}
