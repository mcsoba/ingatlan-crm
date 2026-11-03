import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SCHEDULE_SELECT,
  addDays,
  computeGross,
  nextPeriodStart,
  occurrenceFrom,
  todayIso,
  type ScheduleRow,
} from "@/lib/finance";

// Egy futásban egy törzsből legfeljebb ennyi tétel készül (pl. ha valaki
// régi kezdődátumot ad meg) — a maradékot a következő futás hozza létre.
const MAX_PER_SCHEDULE = 24;

/**
 * Az aktív számla-törzsekből létrehozza azokat a tételeket, amelyek kiállítási
 * napja legfeljebb `lead_days` nap múlva esedékes. Idempotens: a törzs
 * `next_period_start` kurzora csak előre lép, és (schedule_id, period_start)
 * egyedi, így párhuzamos futás sem duplikál.
 *
 * `client` lehet a bejelentkezett (RLS-es) kliens — ekkor csak a saját iroda
 * törzsei látszanak — vagy a cron admin-kliense (összes iroda).
 */
export async function generateDueInvoices(client: SupabaseClient, today = todayIso()) {
  const { data, error } = await client
    .from("finance_schedules")
    .select(`agency_id, ${SCHEDULE_SELECT}`)
    .eq("active", true);
  if (error) return { created: 0, error: error.message };

  let created = 0;
  for (const s of (data ?? []) as (ScheduleRow & { agency_id: string })[]) {
    const horizon = addDays(today, s.lead_days);
    let cursor = s.next_period_start;
    const rows: Record<string, unknown>[] = [];

    for (let i = 0; i < MAX_PER_SCHEDULE; i++) {
      const occ = occurrenceFrom(s, cursor);
      if (!occ || occ.issueDate > horizon) break;
      const vatRate = s.vat_rate === null ? null : Number(s.vat_rate);
      const { vat, gross } = computeGross(occ.net, vatRate, s.currency);
      rows.push({
        agency_id: s.agency_id,
        company_id: s.company_id,
        schedule_id: s.id,
        direction: s.direction,
        doc_type: s.doc_type,
        category: s.category,
        is_planned: true,
        counterparty_name: s.counterparty_name,
        counterparty_tax_number: s.counterparty_tax_number,
        contact_id: s.contact_id,
        property_id: s.property_id,
        location: s.location,
        description: s.description,
        period_start: occ.periodStart,
        period_end: occ.periodEnd,
        issue_date: occ.issueDate,
        fulfillment_date: occ.issueDate,
        due_date: occ.dueDate,
        payment_method: s.payment_method,
        currency: s.currency,
        net_amount: occ.net,
        vat_rate: vatRate,
        vat_amount: vat,
        gross_amount: gross,
        szja_withheld: s.szja_withheld,
        notes: occ.ratio < 1 ? `Törthavi: ${Math.round(occ.ratio * 100)}% (${occ.periodStart} – ${occ.periodEnd})` : null,
      });
      cursor = nextPeriodStart(occ);
      if (s.frequency === "once") break;
    }

    if (!rows.length) continue;
    const { error: insertError } = await client
      .from("finance_invoices")
      .upsert(rows, { onConflict: "schedule_id,period_start", ignoreDuplicates: true });
    if (insertError) continue;
    // Csak akkor lépünk előre, ha a kurzor még ott áll, ahol olvastuk
    const { error: updateError } = await client
      .from("finance_schedules")
      .update({ next_period_start: cursor })
      .eq("id", s.id)
      .eq("next_period_start", s.next_period_start);
    if (!updateError) created += rows.length;
  }
  return { created, error: null };
}
