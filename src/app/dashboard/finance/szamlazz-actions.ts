"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { formatPeriod, todayIso, type InvoiceRow } from "@/lib/finance";
import {
  SZAMLAZZ_VAT_CODES,
  buildInvoiceXml,
  buildQueryXml,
  buyerTaxSubject,
  explainSzamlazzError,
  parseInvoiceResponse,
} from "@/lib/szamlazz";
import { SzamlazzNetworkError, loadSzamlazzKey, postToSzamlazz } from "@/lib/szamlazz-server";

const RECEIPT_BUCKET = "finance-receipts";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SzamlazzActionState = { status: "idle" | "ok" | "error"; message?: string };

function text(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function errorMessage(raw: string, code: string | null): string {
  const hint = explainSzamlazzError(raw);
  return `A Számlázz.hu elutasította: ${raw}${code ? ` (hibakód ${code})` : ""}${hint ? ` — ${hint}` : ""}`;
}

/** A cég az aktuális irodához tartozik-e (a felhasználói kliens RLS-sel csak a sajátját látja). */
async function assertOwnCompany(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("finance_companies").select("id").eq("id", companyId).maybeSingle();
  if (!data) throw new Error("A cég nem található");
}

// ---------- beállítások (cég adatlapja) ----------

export async function saveSzamlazzSettings(_prev: SzamlazzActionState, formData: FormData): Promise<SzamlazzActionState> {
  const profile = await requireOwnerOrAdmin();
  const companyId = text(formData, "company_id");
  if (!companyId) return { status: "error", message: "Hiányzó cég" };
  await assertOwnCompany(companyId);

  const key = text(formData, "agent_key")?.replace(/\s+/g, "") ?? null;
  const prefix = text(formData, "invoice_prefix")?.toUpperCase() ?? null;
  if (prefix && !/^[A-Z0-9-]{1,10}$/.test(prefix)) {
    return { status: "error", message: "Az előtag csak betű, szám és kötőjel lehet (max. 10 karakter)" };
  }
  const settings = {
    invoice_prefix: prefix,
    e_invoice: formData.get("e_invoice") === "on",
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const existing = await loadSzamlazzKey(profile.agency_id, companyId);
  if (!existing && !key) return { status: "error", message: "Másold be az Agent-kulcsot" };
  if (key && key.length < 20) return { status: "error", message: "Ez nem tűnik Agent-kulcsnak — túl rövid" };

  const { error } = existing
    ? await admin
        .from("finance_company_szamlazz")
        .update({ ...settings, ...(key ? { agent_key: key, key_hint: key.slice(-4) } : {}) })
        .eq("company_id", companyId)
        .eq("agency_id", profile.agency_id)
    : await admin.from("finance_company_szamlazz").insert({
        company_id: companyId,
        agency_id: profile.agency_id,
        agent_key: key!,
        key_hint: key!.slice(-4),
        ...settings,
      });
  if (error) return { status: "error", message: `Mentés nem sikerült: ${error.message}` };
  revalidatePath(`/dashboard/finance/companies/${companyId}`);
  revalidatePath("/dashboard/finance", "layout");
  return { status: "ok", message: key ? "Agent-kulcs elmentve" : "Beállítások mentve" };
}

export async function removeSzamlazzSettings(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const companyId = text(formData, "company_id");
  if (!companyId) return;
  await assertOwnCompany(companyId);
  const { error } = await createAdminClient()
    .from("finance_company_szamlazz")
    .delete()
    .eq("company_id", companyId)
    .eq("agency_id", profile.agency_id);
  if (error) throw error;
  revalidatePath(`/dashboard/finance/companies/${companyId}`);
  revalidatePath("/dashboard/finance", "layout");
}

/**
 * Kulcs-ellenőrzés számlakészítés nélkül: egy nem létező számlaszámot kérdezünk le.
 * Jó kulcsnál „nincs ilyen számla” jellegű hiba jön, rossz kulcsnál bejelentkezési hiba.
 */
export async function testSzamlazzKey(_prev: SzamlazzActionState, formData: FormData): Promise<SzamlazzActionState> {
  const profile = await requireOwnerOrAdmin();
  const companyId = text(formData, "company_id");
  if (!companyId) return { status: "error", message: "Hiányzó cég" };
  await assertOwnCompany(companyId);
  const settings = await loadSzamlazzKey(profile.agency_id, companyId);
  if (!settings) return { status: "error", message: "Előbb mentsd el az Agent-kulcsot" };
  try {
    const res = await postToSzamlazz("action-szamla_agent_xml", buildQueryXml(settings.agent_key, "CRM-KAPCSOLATTESZT-0"));
    const parsed = parseInvoiceResponse(res.headers, res.body);
    if (parsed.ok) return { status: "ok", message: "A kapcsolat működik" };
    // 3 = sikertelen bejelentkezés (hibás / visszavont kulcs)
    const authProblem = parsed.code === "3" || explainSzamlazzError(parsed.message)?.startsWith("Az Agent-kulcs");
    return authProblem
      ? { status: "error", message: errorMessage(parsed.message, parsed.code) }
      : { status: "ok", message: `A kulcsot a Számlázz.hu elfogadta (a próbalekérdezésre ezt válaszolta: „${parsed.message}”)` };
  } catch (e) {
    return { status: "error", message: `A Számlázz.hu nem érhető el: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ---------- kiállítás (tétel adatlapja) ----------

export async function issueSzamlazzInvoice(_prev: SzamlazzActionState, formData: FormData): Promise<SzamlazzActionState> {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  if (!id) return { status: "error", message: "Hiányzó tétel" };
  const back = text(formData, "back");
  const supabase = await createClient();

  const { data } = await supabase
    .from("finance_invoices")
    .select(
      "id, company_id, partner_id, direction, doc_type, is_planned, invoice_number, counterparty_name, counterparty_tax_number, location, description, period_start, period_end, fulfillment_date, due_date, payment_method, currency, net_amount, vat_rate, vat_amount, gross_amount, szamlazz_requested_at",
    )
    .eq("id", id)
    .maybeSingle();
  const inv = data as (InvoiceRow & { szamlazz_requested_at: string | null }) | null;
  if (!inv) return { status: "error", message: "A tétel nem található" };
  if (inv.direction !== "out" || !inv.is_planned || inv.invoice_number) {
    return { status: "error", message: "Ez a tétel már ki van állítva, vagy nem kimenő számla" };
  }
  if (inv.doc_type !== "invoice" && inv.doc_type !== "proforma") {
    return { status: "error", message: "Bizonylat nélküli tételhez nem készül számla" };
  }
  if (inv.szamlazz_requested_at) {
    return { status: "error", message: "Ehhez a tételhez már indult egy kiállítás — nézd meg a Számlázz.hu-n, elkészült-e" };
  }

  const settings = await loadSzamlazzKey(profile.agency_id, inv.company_id);
  if (!settings) return { status: "error", message: "Ennél a cégnél nincs beállítva Számlázz.hu Agent-kulcs" };

  // Az űrlapon ellenőrzött / javított adatok
  const buyerName = text(formData, "buyer_name") ?? inv.counterparty_name;
  const zip = text(formData, "zip");
  const city = text(formData, "city");
  const street = text(formData, "street");
  if (!zip || !/^\d{4}$/.test(zip) || !city || !street) {
    return { status: "error", message: "Add meg a vevő címét: irányítószám (4 számjegy), település, utca, házszám" };
  }
  const taxNumber = text(formData, "tax_number");
  if (taxNumber && !/^\d{8}-?\d-?\d{2}$/.test(taxNumber)) {
    return { status: "error", message: "A vevő adószáma helyesen: 12345678-1-23" };
  }
  const vatCode = text(formData, "vat_code") ?? "";
  if (!SZAMLAZZ_VAT_CODES.some((c) => c.value === vatCode)) return { status: "error", message: "Válassz ÁFA-kódot" };
  const email = text(formData, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", message: "Hibás e-mail-cím" };
  const isPerson = formData.get("buyer_is_person") === "1";

  const today = todayIso();
  const issueDate = today;
  const fulfillment = inv.fulfillment_date && DATE_RE.test(inv.fulfillment_date) ? inv.fulfillment_date : today;
  const due = inv.due_date && DATE_RE.test(inv.due_date) ? inv.due_date : today;
  const { data: company } = await supabase.from("finance_companies").select("bank_name, bank_account").eq("id", inv.company_id).maybeSingle();
  const period = formatPeriod(inv.period_start, inv.period_end);

  // Zár: csak egy kérés mehet ki ugyanarra a tételre (dupla kattintás, két böngészőlap)
  const { data: claimed, error: claimError } = await supabase
    .from("finance_invoices")
    .update({ szamlazz_requested_at: new Date().toISOString() })
    .eq("id", id)
    .is("invoice_number", null)
    .is("szamlazz_requested_at", null)
    .select("id");
  if (claimError) return { status: "error", message: `Nem sikerült elindítani: ${claimError.message}` };
  if (!claimed?.length) return { status: "error", message: "Ehhez a tételhez már folyamatban van egy kiállítás" };
  const releaseLock = () => supabase.from("finance_invoices").update({ szamlazz_requested_at: null }).eq("id", id);

  const xml = buildInvoiceXml({
    agentKey: settings.agent_key,
    eInvoice: settings.e_invoice,
    prefix: settings.invoice_prefix,
    docType: inv.doc_type,
    issueDate,
    fulfillmentDate: fulfillment,
    dueDate: due,
    paymentMethod: inv.payment_method,
    currency: inv.currency,
    note: text(formData, "note"),
    seller: { bankName: company?.bank_name ?? null, bankAccount: company?.bank_account ?? null },
    buyer: {
      name: buyerName,
      zip,
      city,
      street,
      email,
      sendEmail: formData.get("send_email") === "on",
      taxNumber,
      taxSubject: buyerTaxSubject(taxNumber, isPerson),
    },
    item: {
      name: [inv.description, inv.location].filter(Boolean).join(" "),
      note: period ? `Időszak: ${period}` : null,
      unit: "db",
      net: Number(inv.net_amount),
      vatCode,
      vat: Number(inv.vat_amount),
      gross: Number(inv.gross_amount),
    },
  });

  let res: Awaited<ReturnType<typeof postToSzamlazz>>;
  try {
    res = await postToSzamlazz("action-xmlagentxmlfile", xml);
  } catch (e) {
    if (e instanceof SzamlazzNetworkError) {
      // Nem tudjuk, elkészült-e — a zár bent marad, a felhasználónak kell ellenőriznie
      revalidatePath(`/dashboard/finance/invoices/${id}`);
      return {
        status: "error",
        message:
          "Nem jött válasz a Számlázz.hu-tól, ezért nem tudjuk, elkészült-e a számla. Nézd meg a Számlázz.hu-n: ha igen, írd be lent a számlaszámot; ha nem, oldd fel a zárat és próbáld újra.",
      };
    }
    await releaseLock();
    throw e;
  }

  const parsed = parseInvoiceResponse(res.headers, res.body);
  if (!parsed.ok) {
    await releaseLock();
    return { status: "error", message: errorMessage(parsed.message, parsed.code) };
  }

  const { error: updateError } = await supabase
    .from("finance_invoices")
    .update({
      invoice_number: parsed.invoiceNumber,
      is_planned: false,
      issue_date: issueDate,
      fulfillment_date: fulfillment,
      due_date: due,
      counterparty_name: buyerName,
      counterparty_tax_number: taxNumber,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) {
    // A számla elkészült — ezt nem szabad elveszíteni, a zár bent marad
    return {
      status: "error",
      message: `A számla elkészült (${parsed.invoiceNumber}), de a CRM-be nem sikerült visszaírni: ${updateError.message}. Írd be a számlaszámot kézzel lent.`,
    };
  }

  // PDF a tétel csatolmányai közé
  if (parsed.pdfBase64) {
    const pdf = Buffer.from(parsed.pdfBase64, "base64");
    const filename = `${parsed.invoiceNumber.replace(/[^\w.\-]+/g, "_")}.pdf`;
    const path = `${profile.agency_id}/${id}/${crypto.randomUUID()}-${filename}`;
    const { error: uploadError } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, pdf, { contentType: "application/pdf" });
    if (!uploadError) {
      await supabase.from("finance_receipts").insert({
        agency_id: profile.agency_id,
        invoice_id: id,
        path,
        filename,
        size_bytes: pdf.length,
        content_type: "application/pdf",
      });
    }
  }

  // A partner hiányzó adatait pótoljuk, hogy legközelebb ne kelljen újra beírni
  if (inv.partner_id) {
    const { data: partner } = await supabase
      .from("finance_partners")
      .select("address, tax_number, contact_email")
      .eq("id", inv.partner_id)
      .maybeSingle();
    if (partner) {
      const patch: Record<string, string> = {};
      if (!partner.address) patch.address = `${zip} ${city}, ${street}`;
      if (!partner.tax_number && taxNumber) patch.tax_number = taxNumber;
      if (!partner.contact_email && email) patch.contact_email = email;
      if (Object.keys(patch).length) await supabase.from("finance_partners").update(patch).eq("id", inv.partner_id);
    }
  }

  revalidatePath("/dashboard/finance", "layout");
  revalidatePath("/dashboard");
  const qs = new URLSearchParams({ issued: parsed.invoiceNumber, ...(back ? { back } : {}) });
  redirect(`/dashboard/finance/invoices/${id}?${qs.toString()}`);
}

/** Félbemaradt kiállítás zárjának feloldása — a felhasználó ellenőrizte, hogy nem készült számla. */
export async function releaseSzamlazzLock(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("finance_invoices").update({ szamlazz_requested_at: null }).eq("id", id).is("invoice_number", null);
  if (error) throw error;
  revalidatePath(`/dashboard/finance/invoices/${id}`);
}
