"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { anthropic, AI_MODEL } from "@/lib/claude";

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

export async function deleteContact(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/contacts");
}
