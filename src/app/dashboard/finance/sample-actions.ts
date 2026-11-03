"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { SAMPLE_MARKER, addDays, addMonths, computeGross, szjaAmount, todayIso } from "@/lib/finance";

/**
 * Bemutató adatok a pénzügyekhez, a mai naphoz igazítva — hogy az iroda
 * kipróbálhassa a pipálást, a számlázást és a grafikonokat, mielőtt a valódi
 * adatokat felviszi. Minden mintatétel a SAMPLE_MARKER megjegyzést kapja, és
 * egy kattintással törölhető (a valódi adatokhoz nem nyúl).
 */
export async function loadSampleData() {
  const profile = await requireOwnerOrAdmin();
  const supabase = await createClient();
  const { data: companies } = await supabase.from("finance_companies").select("id, name").order("sort_order").order("name");
  if (!companies?.length) throw new Error("Előbb vegyél fel legalább egy céget");
  const pick = (name: string, fallback: number) =>
    (companies.find((c) => c.name.toLowerCase().includes(name)) ?? companies[fallback % companies.length]).id as string;
  const workerbase = pick("workerbase", 0);
  const interprop = pick("interprop", 1);
  const bluegate = pick("bluegate", 2);

  const today = todayIso();
  const thisMonth = `${today.slice(0, 7)}-01`;
  const month = (offset: number, day: number) => addDays(addMonths(thisMonth, offset), day - 1);
  const monthEnd = (offset: number) => addDays(addMonths(thisMonth, offset + 1), -1);

  type Row = Record<string, unknown>;
  const base = { agency_id: profile.agency_id, notes: SAMPLE_MARKER };
  const item = (r: Row): Row => {
    const net = Number(r.net_amount);
    const rate = (r.vat_rate as number | null | undefined) ?? null;
    const { vat, gross } = computeGross(net, rate, "HUF");
    return { ...base, currency: "HUF", vat_rate: rate, vat_amount: vat, gross_amount: gross, doc_type: "invoice", ...r };
  };

  const invoices: Row[] = [];
  // Kimenő bérleti díjak az elmúlt 3 hónapra — rendezve
  for (const off of [-3, -2, -1]) {
    invoices.push(
      item({
        company_id: workerbase, direction: "out", category: "rent", invoice_number: `MINTA-WRKR-${10 + off}`,
        counterparty_name: "Minta Bérlő Kft.", location: "Szeged, Minta utca 1.", description: "ingatlan bérleti díj",
        period_start: month(off, 1), period_end: monthEnd(off), issue_date: month(off, 2), fulfillment_date: month(off, 2),
        due_date: month(off, 12), paid_date: month(off, 10), bank_booked_date: month(off, 11), payment_method: "transfer",
        net_amount: 1_100_000, vat_rate: 0,
      }),
    );
  }
  // Továbbszámlázott rezsi — lejárt, nem fizették (kintlévőség)
  invoices.push(
    item({
      company_id: workerbase, direction: "out", category: "utility", invoice_number: "MINTA-WRKR-REZSI",
      counterparty_name: "Minta Bérlő Kft.", location: "Szeged, Minta utca 1.", description: "továbbszámlázott rezsi",
      issue_date: month(-1, 20), fulfillment_date: month(-1, 20), due_date: month(-1, 28),
      payment_method: "transfer", net_amount: 64_734, vat_rate: 0,
    }),
  );
  // Közvetítési jutalék — kiállítva, határidőn belül
  invoices.push(
    item({
      company_id: interprop, direction: "out", category: "service", invoice_number: "MINTA-IP-001",
      counterparty_name: "Minta Vevő Bt.", description: "ingatlanközvetítési jutalék",
      issue_date: addDays(today, -2), fulfillment_date: addDays(today, -2), due_date: addDays(today, 6),
      payment_method: "transfer", net_amount: 1_500_000, vat_rate: 27,
    }),
  );
  // Bérbeadónak fizetett díj magánszemélytől (SZJA-levonással) — előző hónapok rendezve
  for (const off of [-2, -1]) {
    const gross = 800_000;
    invoices.push(
      item({
        company_id: bluegate, direction: "in", category: "rent", doc_type: "none",
        counterparty_name: "Minta Bérbeadó (magánszemély)", location: "Debrecen, Minta tér 2.", description: "ingatlan bérleti díj",
        period_start: month(off, 1), period_end: monthEnd(off), issue_date: month(off, 1), due_date: month(off, 10),
        paid_date: month(off, 5), bank_booked_date: month(off, 6), paid_amount: gross - szjaAmount(gross),
        payment_method: "transfer", net_amount: gross, vat_rate: null, szja_withheld: true,
      }),
    );
  }
  // Közműszámla — 7 napon belül fizetendő
  invoices.push(
    item({
      company_id: bluegate, direction: "in", category: "utility", invoice_number: "MINTA-KOZMU-77",
      counterparty_name: "Minta Közmű Zrt.", description: "áramdíj", issue_date: addDays(today, -6),
      fulfillment_date: addDays(today, -6), due_date: addDays(today, 4), payment_method: "transfer", net_amount: 66_929, vat_rate: 27,
    }),
  );
  // Egyéb kiadások (Kiadások fül) — vegyesen
  const expense = (company: string, daysAgo: number, description: string, partner: string, amount: number, category: string, method: string, booked: boolean) =>
    item({
      company_id: company, direction: "in", category, doc_type: method === "cash" ? "none" : "invoice",
      counterparty_name: partner, description, issue_date: addDays(today, -daysAgo), fulfillment_date: addDays(today, -daysAgo),
      due_date: addDays(today, -daysAgo), paid_date: addDays(today, -daysAgo), paid_amount: amount,
      bank_booked_date: booked ? addDays(today, -daysAgo + 1) : null, payment_method: method, net_amount: amount, vat_rate: null,
    });
  invoices.push(
    expense(bluegate, 1, "tisztítószerek", "Minta Áruház", 12_990, "supplies", "card", false),
    expense(workerbase, 2, "üzemanyag", "Minta Benzinkút", 25_000, "supplies", "card", false),
    expense(bluegate, 3, "irodaszer", "Minta Papírbolt", 4_500, "supplies", "cash", false),
    expense(interprop, 8, "könyvelési díj", "Minta Könyvelő Kft.", 60_000, "service", "transfer", true),
    expense(bluegate, 12, "számlavezetési díj", "Minta Bank", 1_200, "bank", "transfer", true),
    expense(workerbase, 40, "matrac (2 db)", "Minta Bútor Kft.", 89_980, "supplies", "transfer", true),
  );

  // defaultToNull: false — a sorokban hiányzó oszlopok az adatbázis alapértékét kapják (pl. szja_withheld = false)
  const { error } = await supabase.from("finance_invoices").insert(invoices, { defaultToNull: false });
  if (error) throw error;

  // Két számla-törzs: egy kimenő havi bérleti díj (a mostani hónap a „Számlázni kell” listára kerül)
  // és egy bejövő, bérbeadónak fizetendő díj SZJA-levonással
  const { error: scheduleError } = await supabase.from("finance_schedules").insert([
    {
      ...base, company_id: workerbase, direction: "out", doc_type: "invoice", category: "rent",
      counterparty_name: "Minta Bérlő Kft.", location: "Szeged, Minta utca 1.", description: "ingatlan bérleti díj",
      currency: "HUF", net_amount: 1_100_000, vat_rate: 0, payment_method: "transfer", frequency: "monthly",
      start_date: month(-3, 1), issue_day: 2, payment_days: 10, prorate: true, lead_days: 7, next_period_start: thisMonth,
    },
    {
      ...base, company_id: bluegate, direction: "in", doc_type: "none", category: "rent",
      counterparty_name: "Minta Bérbeadó (magánszemély)", location: "Debrecen, Minta tér 2.", description: "ingatlan bérleti díj",
      currency: "HUF", net_amount: 800_000, vat_rate: null, szja_withheld: true, payment_method: "transfer", frequency: "monthly",
      start_date: month(-2, 1), issue_day: 1, payment_days: 10, prorate: true, lead_days: 7, next_period_start: thisMonth,
    },
  ], { defaultToNull: false });
  if (scheduleError) throw scheduleError;

  revalidatePath("/dashboard/finance", "layout");
  revalidatePath("/dashboard");
}

/** Csak a mintaadatokat törli (a jelölő megjegyzés és a mintatörzsek alapján). */
export async function deleteSampleData() {
  await requireOwnerOrAdmin();
  const supabase = await createClient();
  const { data: schedules } = await supabase.from("finance_schedules").select("id").eq("notes", SAMPLE_MARKER);
  const scheduleIds = (schedules ?? []).map((s) => s.id as string);
  if (scheduleIds.length) {
    const { error } = await supabase.from("finance_invoices").delete().in("schedule_id", scheduleIds);
    if (error) throw error;
  }
  const { error: invoiceError } = await supabase.from("finance_invoices").delete().eq("notes", SAMPLE_MARKER);
  if (invoiceError) throw invoiceError;
  const { error: scheduleError } = await supabase.from("finance_schedules").delete().eq("notes", SAMPLE_MARKER);
  if (scheduleError) throw scheduleError;
  revalidatePath("/dashboard/finance", "layout");
  revalidatePath("/dashboard");
}
