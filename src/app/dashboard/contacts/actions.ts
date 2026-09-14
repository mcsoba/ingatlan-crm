"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { anthropic, AI_MODEL } from "@/lib/claude";
import { parseCsv } from "@/lib/csv";
import { getResend, EMAIL_FROM, textToHtml } from "@/lib/resend";

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
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/contacts");
}
