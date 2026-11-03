import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { loadInvoices, type InvoiceFilters } from "../data";
import {
  DOC_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  categoryLabel,
  formatDate,
  invoiceStatus,
  payableAmount,
  statusLabel,
  todayIso,
} from "@/lib/finance";

// A magyar Excel pontosvesszős CSV-t vár, BOM-mal (különben az ékezetek elromlanak),
// és tizedesvesszőt — így dupla kattintásra jól nyílik meg.
function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function num(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(Number(n)).replace(".", ",");
}

export async function GET(request: Request) {
  await requireOwnerOrAdmin();
  const supabase = await createClient();
  const params = Object.fromEntries(new URL(request.url).searchParams) as InvoiceFilters;
  const filters = { ...params, year: params.year ?? String(new Date().getFullYear()) };
  const [invoices, { data: companies }] = await Promise.all([
    loadInvoices(supabase, filters),
    supabase.from("finance_companies").select("id, name"),
  ]);
  const companyName = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
  const today = todayIso();

  const headers = [
    "Cég", "Irány", "Bizonylat", "Kategória", "Számla száma", "Partner", "Partner adószáma", "Számla tartalma", "Helyszín",
    "Időszak kezdete", "Időszak vége", "Kelte", "Teljesítés", "Fizetési határidő", "Kifizetés dátuma", "Bank könyvelés dátuma",
    "Fizetés módja", "Pénznem", "Nettó", "ÁFA-kulcs", "ÁFA", "Bruttó", "SZJA-levonás", "Fizetendő", "Ténylegesen fizetett",
    "Állapot", "Megjegyzés",
  ];
  const rows = invoices.map((inv) => [
    companyName.get(inv.company_id) ?? "",
    inv.direction === "out" ? "Kimenő" : "Bejövő",
    DOC_TYPE_LABELS[inv.doc_type],
    categoryLabel(inv.category),
    inv.invoice_number,
    inv.counterparty_name,
    inv.counterparty_tax_number,
    inv.description,
    inv.location,
    formatDate(inv.period_start),
    formatDate(inv.period_end),
    formatDate(inv.issue_date),
    formatDate(inv.fulfillment_date),
    formatDate(inv.due_date),
    formatDate(inv.paid_date),
    formatDate(inv.bank_booked_date),
    PAYMENT_METHOD_LABELS[inv.payment_method],
    inv.currency,
    num(inv.net_amount),
    inv.vat_rate === null ? "" : `${Number(inv.vat_rate)}%`,
    num(inv.vat_amount),
    num(inv.gross_amount),
    inv.szja_withheld ? "igen" : "",
    num(payableAmount(inv)),
    num(inv.paid_amount),
    statusLabel(invoiceStatus(inv, today), inv.direction),
    inv.notes,
  ]);

  const csv = "﻿" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="penzugyek-${filters.year}${filters.month ? `-${filters.month}` : ""}.csv"`,
    },
  });
}
