"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { anthropic, AI_MODEL } from "@/lib/claude";
import { parseCsv } from "@/lib/csv";
import { getResend, EMAIL_FROM, textToHtml } from "@/lib/resend";
import { sendSms } from "@/lib/twilio";

const STATUS_LABELS: Record<string, string> = {
  new: "új, még nem vettük fel vele a kapcsolatot",
  contacted: "felvettük vele a kapcsolatot, várunk visszajelzést",
  qualified: "minősített, komoly érdeklődő",
  inactive: "inaktív, egy ideje nem reagál",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "weboldalon keresztül érkezett",
  referral: "ajánlásból érkezett",
  phone: "telefonon keresett meg minket",
  walk_in: "betért az irodánkba",
  other: "egyéb forrásból érkezett",
};

type ContactInput = {
  name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  notes: string;
};

function readContactInput(formData: FormData): ContactInput {
  return {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    source: String(formData.get("source") ?? "other"),
    status: String(formData.get("status") ?? "new"),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createContact(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const input = readContactInput(formData);

  if (!input.name) {
    throw new Error("A név megadása kötelező");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    agency_id: profile.agency_id,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    source: input.source,
    status: input.status,
    notes: input.notes || null,
  });

  if (error) throw error;

  revalidatePath("/dashboard/contacts");
  redirect("/dashboard/contacts");
}

export async function updateContact(id: string, formData: FormData) {
  await ensureCurrentUserProfile();
  const input = readContactInput(formData);

  if (!input.name) {
    throw new Error("A név megadása kötelező");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      source: input.source,
      status: input.status,
      notes: input.notes || null,
    })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/dashboard/contacts");
  redirect("/dashboard/contacts");
}

export async function generateFollowUpEmail(input: {
  name: string;
  status: string;
  source: string;
  notes: string;
}): Promise<string> {
  await ensureCurrentUserProfile();

  const name = input.name.trim();
  if (!name) {
    throw new Error("Adj meg legalább egy nevet a vázlat generálásához");
  }

  const details = [
    `Név: ${name}`,
    `Státusz: ${STATUS_LABELS[input.status] ?? input.status}`,
    `Forrás: ${SOURCE_LABELS[input.source] ?? input.source}`,
    input.notes.trim() ? `Jegyzet a kontaktról: ${input.notes.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content:
          "Írj egy rövid, barátságos, magyar nyelvű follow-up emailt egy ingatlanos ügynök nevében " +
          "az alábbi kontaktnak, a jegyzet és a státusz alapján igazítva a hangnemet és a tartalmat. " +
          "Ne találj ki konkrét ingatlant vagy adatot, ami nem szerepel az adatok között. " +
          "Az első sor legyen 'Tárgy: ...', utána egy üres sor, majd az email törzse " +
          "(megszólítás, 2-4 rövid bekezdés, elköszönés — aláírás/név nélkül, azt az ügynök pótolja).\n\n" +
          details,
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Az AI nem adott vissza email-vázlatot, próbáld újra");
  }

  return text;
}

export async function sendFollowUpEmail(contactId: string, draft: string) {
  const { user, profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, name, email")
    .eq("id", contactId)
    .maybeSingle();

  if (contactError) throw contactError;
  if (!contact) throw new Error("A kontakt nem található");
  if (!contact.email) {
    throw new Error("Ehhez a kontakthoz nincs megadva email cím");
  }

  const lines = draft.trim().split("\n");
  let subject = `Kapcsolatfelvétel — ${contact.name}`;
  let body = draft.trim();
  if (lines[0]?.toLowerCase().startsWith("tárgy:")) {
    subject = lines[0].slice(lines[0].indexOf(":") + 1).trim();
    body = lines.slice(1).join("\n").trim();
  }

  const { error: sendError } = await getResend().emails.send({
    from: EMAIL_FROM,
    to: contact.email,
    replyTo: user.email,
    subject,
    html: textToHtml(body),
    text: body,
  });

  if (sendError) {
    throw new Error(sendError.message || "Az email küldése nem sikerült");
  }

  await supabase.from("activities").insert({
    agency_id: profile.agency_id,
    contact_id: contactId,
    type: "note",
    content: `Email elküldve: „${subject}"`,
    email_body: body,
  });

  revalidatePath(`/dashboard/contacts/${contactId}/edit`);
}

export async function generateSmsDraft(input: {
  name: string;
  status: string;
  source: string;
  notes: string;
}): Promise<string> {
  await ensureCurrentUserProfile();

  const name = input.name.trim();
  if (!name) {
    throw new Error("Adj meg legalább egy nevet a vázlat generálásához");
  }

  const details = [
    `Név: ${name}`,
    `Státusz: ${STATUS_LABELS[input.status] ?? input.status}`,
    `Forrás: ${SOURCE_LABELS[input.source] ?? input.source}`,
    input.notes.trim() ? `Jegyzet a kontaktról: ${input.notes.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content:
          "Írj egy rövid, barátságos, magyar nyelvű SMS-t (max 300 karakter, aláírás nélkül) egy ingatlanos " +
          "ügynök nevében az alábbi kontaktnak, a jegyzet és a státusz alapján igazítva a tartalmat. " +
          "Ne találj ki konkrét ingatlant vagy adatot, ami nem szerepel az adatok között. Csak az SMS szövegét add vissza, " +
          "semmi mást.\n\n" + details,
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Az AI nem adott vissza SMS-vázlatot, próbáld újra");
  }

  return text;
}

export async function sendSmsToContact(contactId: string, body: string) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const text = body.trim();
  if (!text) throw new Error("Az SMS szövege nem lehet üres");

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, phone")
    .eq("id", contactId)
    .maybeSingle();

  if (contactError) throw contactError;
  if (!contact) throw new Error("A kontakt nem található");
  if (!contact.phone) {
    throw new Error("Ehhez a kontakthoz nincs megadva telefonszám");
  }

  await sendSms(contact.phone, text);

  await supabase.from("activities").insert({
    agency_id: profile.agency_id,
    contact_id: contactId,
    type: "note",
    content: `SMS elküldve: „${text}"`,
  });

  revalidatePath(`/dashboard/contacts/${contactId}/edit`);
}

export type PropertyMatch = {
  id: string;
  address: string;
  reason: string;
};

export async function suggestMatchingProperties(
  contactId: string,
): Promise<PropertyMatch[]> {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("name, status, notes")
    .eq("id", contactId)
    .single();

  if (contactError) throw contactError;

  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id, address, price, size_sqm, features")
    .eq("agency_id", profile.agency_id)
    .limit(50);

  if (propertiesError) throw propertiesError;
  if (!properties || properties.length === 0) return [];

  const propertyList = properties
    .map((p) => {
      const notes = (p.features as { notes?: string } | null)?.notes;
      return [
        `id: ${p.id}`,
        `cím: ${p.address}`,
        p.price ? `ár: ${p.price.toLocaleString("hu-HU")} Ft` : null,
        p.size_sqm ? `méret: ${p.size_sqm} m²` : null,
        notes ? `jellemzők: ${notes}` : null,
      ]
        .filter(Boolean)
        .join(", ");
    })
    .join("\n");

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 600,
    system:
      "Csak valid JSON tömböt adj vissza, semmi mást (se magyarázat, se markdown code fence). " +
      'Formátum: [{"id": "...", "reason": "..."}]. Legfeljebb 3 elem, ' +
      "csak a megadott listában szereplő id-kat használd, a reason magyar nyelvű, 1 mondatos legyen.",
    messages: [
      {
        role: "user",
        content:
          `Kontakt: ${contact.name}, státusz: ${STATUS_LABELS[contact.status] ?? contact.status}, ` +
          `jegyzet: ${contact.notes?.trim() || "nincs jegyzet"}\n\n` +
          `Elérhető ingatlanok:\n${propertyList}\n\n` +
          "Melyik ingatlanok illenek legjobban ehhez a kontakthoz a jegyzete alapján? " +
          "Ha semmi nem illik egyértelműen, adj vissza üres tömböt.",
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const jsonStart = text.indexOf("[");
  const jsonEnd = text.lastIndexOf("]");
  const jsonSlice =
    jsonStart !== -1 && jsonEnd !== -1
      ? text.slice(jsonStart, jsonEnd + 1)
      : text;

  let parsed: { id: string; reason: string }[];
  try {
    parsed = JSON.parse(jsonSlice);
  } catch {
    throw new Error("Az AI válasza nem volt feldolgozható, próbáld újra");
  }

  const byId = new Map(properties.map((p) => [p.id, p]));
  return parsed
    .filter((m) => byId.has(m.id))
    .map((m) => ({
      id: m.id,
      address: byId.get(m.id)!.address,
      reason: m.reason,
    }));
}

export type LeadScoreResult = {
  score: number;
  reason: string;
};

export async function scoreContactLead(
  contactId: string,
): Promise<LeadScoreResult> {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const [{ data: contact, error: contactError }, { data: activities, error: activitiesError }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("name, status, source, notes, created_at")
        .eq("id", contactId)
        .single(),
      supabase
        .from("activities")
        .select("type, content, done, due_at, created_at")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (contactError) throw contactError;
  if (activitiesError) throw activitiesError;

  const activitySummary = (activities ?? [])
    .map(
      (a) =>
        `- [${a.type}${a.done ? ", lezárva" : ""}] ${a.content} (${new Date(a.created_at).toLocaleDateString("hu-HU")})`,
    )
    .join("\n");

  const details = [
    `Név: ${contact.name}`,
    `Státusz: ${STATUS_LABELS[contact.status] ?? contact.status}`,
    `Forrás: ${SOURCE_LABELS[contact.source] ?? contact.source}`,
    `Kontaktba kerülés dátuma: ${new Date(contact.created_at).toLocaleDateString("hu-HU")}`,
    contact.notes?.trim() ? `Jegyzet: ${contact.notes.trim()}` : null,
    activitySummary ? `Aktivitás-történet (legfrissebb elöl):\n${activitySummary}` : "Nincs rögzített aktivitás.",
  ]
    .filter(Boolean)
    .join("\n");

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 300,
    system:
      "Csak valid JSON objektumot adj vissza, semmi mást (se magyarázat, se markdown code fence). " +
      'Formátum: {"score": <0-100 egész szám>, "reason": "<1 mondatos magyar indoklás>"}. ' +
      "A score azt fejezze ki, mennyire valószínű, hogy ez a kontakt hamarosan vásárol/elad (komoly érdeklődés, " +
      "aktív kommunikáció, konkrét igény = magas pontszám; régi, válasz nélküli, vagy inaktív jelzésű kontakt = alacsony).",
    messages: [
      {
        role: "user",
        content: `Pontozd ezt az ingatlanos kontaktot a rendelkezésre álló adatok alapján:\n\n${details}`,
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const jsonSlice =
    jsonStart !== -1 && jsonEnd !== -1 ? text.slice(jsonStart, jsonEnd + 1) : text;

  let parsed: LeadScoreResult;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch {
    throw new Error("Az AI válasza nem volt feldolgozható, próbáld újra");
  }

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ lead_score: score, lead_score_reason: parsed.reason })
    .eq("id", contactId);

  if (updateError) throw updateError;

  revalidatePath(`/dashboard/contacts/${contactId}/edit`);
  revalidatePath("/dashboard/contacts");

  return { score, reason: parsed.reason };
}

export type DuplicateMatch = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  matchedOn: "email" | "phone" | "name";
};

export async function checkDuplicateContact(input: {
  name: string;
  email: string;
  phone: string;
  excludeId?: string;
}): Promise<DuplicateMatch[]> {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();

  if (!email && !phone && !name) return [];

  const orClauses: string[] = [];
  if (email) orClauses.push(`email.eq.${email}`);
  if (phone) orClauses.push(`phone.eq.${phone}`);
  if (name) orClauses.push(`name.ilike.${name}`);
  if (orClauses.length === 0) return [];

  let query = supabase
    .from("contacts")
    .select("id, name, email, phone")
    .eq("agency_id", profile.agency_id)
    .or(orClauses.join(","))
    .limit(5);

  if (input.excludeId) query = query.neq("id", input.excludeId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((c) => ({
    ...c,
    matchedOn: (c.email && c.email === email
      ? "email"
      : c.phone && c.phone === phone
        ? "phone"
        : "name") as DuplicateMatch["matchedOn"],
  }));
}

// Merges `duplicateId` into `keepId`: fills in any email/phone/notes the
// kept contact is missing, reassigns every linked deal/activity/attachment/
// campaign-enrollment, then deletes the duplicate row. Email-sequence
// enrollments have a unique(sequence_id, contact_id) constraint, so a
// duplicate's enrollment in a sequence the kept contact is already in gets
// dropped instead of reassigned (can't have both).
export async function mergeContacts(keepId: string, duplicateId: string) {
  const { profile } = await ensureCurrentUserProfile();
  if (keepId === duplicateId) throw new Error("Nem lehet önmagával összevonni egy kontaktot");

  const supabase = await createClient();

  const [{ data: keep, error: keepError }, { data: duplicate, error: duplicateError }] =
    await Promise.all([
      supabase.from("contacts").select("email, phone, notes").eq("id", keepId).single(),
      supabase.from("contacts").select("email, phone, notes").eq("id", duplicateId).single(),
    ]);
  if (keepError) throw keepError;
  if (duplicateError) throw duplicateError;

  const patch: { email?: string; phone?: string; notes?: string } = {};
  if (!keep.email && duplicate.email) patch.email = duplicate.email;
  if (!keep.phone && duplicate.phone) patch.phone = duplicate.phone;
  if (duplicate.notes?.trim()) {
    patch.notes = keep.notes?.trim()
      ? `${keep.notes.trim()}\n\n${duplicate.notes.trim()}`
      : duplicate.notes.trim();
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("contacts").update(patch).eq("id", keepId);
    if (error) throw error;
  }

  for (const table of ["activities", "deals", "attachments"] as const) {
    const { error } = await supabase
      .from(table)
      .update({ contact_id: keepId })
      .eq("contact_id", duplicateId);
    if (error) throw error;
  }

  const { data: duplicateEnrollments } = await supabase
    .from("email_sequence_enrollments")
    .select("id, sequence_id")
    .eq("contact_id", duplicateId);

  if (duplicateEnrollments && duplicateEnrollments.length > 0) {
    const { data: keepEnrollments } = await supabase
      .from("email_sequence_enrollments")
      .select("sequence_id")
      .eq("contact_id", keepId);
    const keepSequenceIds = new Set((keepEnrollments ?? []).map((e) => e.sequence_id));

    const toDrop = duplicateEnrollments
      .filter((e) => keepSequenceIds.has(e.sequence_id))
      .map((e) => e.id);
    const toReassign = duplicateEnrollments
      .filter((e) => !keepSequenceIds.has(e.sequence_id))
      .map((e) => e.id);

    if (toDrop.length > 0) {
      await supabase.from("email_sequence_enrollments").delete().in("id", toDrop);
    }
    if (toReassign.length > 0) {
      await supabase
        .from("email_sequence_enrollments")
        .update({ contact_id: keepId })
        .in("id", toReassign);
    }
  }

  await softDeleteContacts(profile.agency_id, [duplicateId]);

  revalidatePath("/dashboard/contacts");
  revalidatePath(`/dashboard/contacts/${keepId}/edit`);
}

// Merges an entire duplicate cluster (from /dashboard/contacts/duplicates)
// into one kept contact, by calling mergeContacts once per other member.
// Sequential, not parallel -- each merge reassigns rows by contact_id, and
// running them concurrently against the same keepId risks interleaved
// reads of `keep` (email/phone/notes) between calls.
export async function mergeClusterContacts(keepId: string, otherIds: string[]) {
  for (const id of otherIds) {
    if (id === keepId) continue;
    await mergeContacts(keepId, id);
  }
  revalidatePath("/dashboard/contacts/duplicates");
}

const VALID_SOURCES = ["website", "referral", "phone", "walk_in", "other"];
const VALID_STATUSES = ["new", "contacted", "qualified", "inactive"];

export type ImportResult = { imported: number; skipped: number };

export async function importContactsCsv(formData: FormData): Promise<ImportResult> {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Válassz ki egy CSV fájlt");
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return { imported: 0, skipped: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) {
    throw new Error(
      "A CSV első sorában (fejléc) kötelező a 'name' oszlop. Elvárt formátum: name,email,phone,source,status,notes",
    );
  }
  const emailIdx = header.indexOf("email");
  const phoneIdx = header.indexOf("phone");
  const sourceIdx = header.indexOf("source");
  const statusIdx = header.indexOf("status");
  const notesIdx = header.indexOf("notes");

  let imported = 0;
  let skipped = 0;
  const toInsert: {
    agency_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    source: string;
    status: string;
    notes: string | null;
  }[] = [];

  for (const row of rows.slice(1)) {
    const name = row[nameIdx]?.trim();
    if (!name) {
      skipped++;
      continue;
    }
    const source = row[sourceIdx]?.trim().toLowerCase();
    const status = row[statusIdx]?.trim().toLowerCase();
    toInsert.push({
      agency_id: profile.agency_id,
      name,
      email: row[emailIdx]?.trim() || null,
      phone: row[phoneIdx]?.trim() || null,
      source: VALID_SOURCES.includes(source) ? source : "other",
      status: VALID_STATUSES.includes(status) ? status : "new",
      notes: row[notesIdx]?.trim() || null,
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("contacts").insert(toInsert);
    if (error) throw error;
    imported = toInsert.length;
  }

  revalidatePath("/dashboard/contacts");
  return { imported, skipped };
}

export async function deleteContact(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const id = String(formData.get("id"));

  await softDeleteContacts(profile.agency_id, [id]);

  revalidatePath("/dashboard/contacts");
}

export async function bulkDeleteContacts(ids: string[]) {
  const { profile } = await ensureCurrentUserProfile();
  if (ids.length === 0) return;

  await softDeleteContacts(profile.agency_id, ids);

  revalidatePath("/dashboard/contacts");
}

// Soft-delete: sets deleted_at instead of removing the row, so it can be
// restored from /dashboard/trash within 30 days. Mirrors the FK cascade the
// hard-delete used to rely on (deleting a contact used to cascade-delete its
// deals) by soft-deleting the contact's own open deals alongside it.
//
// Uses the admin client, not the RLS-scoped one: the contacts SELECT policy
// now excludes deleted_at rows, and Postgres applies that same policy to an
// UPDATE's row-visibility and WITH CHECK -- so under RLS, setting deleted_at
// away from null fails WITH CHECK, and setting it back to null (restore)
// silently matches zero rows. The explicit agency_id filter below is what
// keeps this safe now that RLS isn't doing that job.
async function softDeleteContacts(agencyId: string, ids: string[]) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin
    .from("contacts")
    .update({ deleted_at: now })
    .eq("agency_id", agencyId)
    .in("id", ids);
  if (error) throw error;

  const { error: dealsError } = await admin
    .from("deals")
    .update({ deleted_at: now })
    .eq("agency_id", agencyId)
    .in("contact_id", ids)
    .is("deleted_at", null);
  if (dealsError) throw dealsError;
}

export async function bulkUpdateContactStatus(ids: string[], status: string) {
  await ensureCurrentUserProfile();
  if (ids.length === 0) return;
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Érvénytelen státusz");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ status })
    .in("id", ids);
  if (error) throw error;

  revalidatePath("/dashboard/contacts");
}
