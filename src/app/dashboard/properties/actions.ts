"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { anthropic, AI_MODEL } from "@/lib/claude";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const VALID_STATUSES = ["available", "reserved", "sold", "rented"];

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseStatus(value: FormDataEntryValue | null): string {
  const status = String(value ?? "available");
  return VALID_STATUSES.includes(status) ? status : "available";
}

async function uploadPhotoIfPresent(
  supabase: SupabaseClient,
  agencyId: string,
  propertyId: string,
  formData: FormData,
): Promise<void> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${agencyId}/${propertyId}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("property-photos")
    .upload(path, file, { contentType: file.type });

  if (uploadError) throw uploadError;

  const { count } = await supabase
    .from("property_photos")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  const { error: insertError } = await supabase.from("property_photos").insert({
    agency_id: agencyId,
    property_id: propertyId,
    path,
    position: count ?? 0,
  });

  if (insertError) throw insertError;
}

export async function createProperty(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const address = String(formData.get("address") ?? "").trim();
  if (!address) {
    throw new Error("A cím megadása kötelező");
  }

  const notes = String(formData.get("notes") ?? "").trim();
  const aiDescription = String(formData.get("ai_description") ?? "").trim();

  const { data: property, error } = await supabase
    .from("properties")
    .insert({
      agency_id: profile.agency_id,
      address,
      price: parseNumber(formData.get("price")),
      size_sqm: parseNumber(formData.get("size_sqm")),
      status: parseStatus(formData.get("status")),
      features: notes ? { notes } : {},
      ai_description: aiDescription || null,
    })
    .select("id")
    .single();

  if (error) throw error;

  await uploadPhotoIfPresent(supabase, profile.agency_id, property.id, formData);

  revalidatePath("/dashboard/properties");
  redirect("/dashboard/properties");
}

export async function updateProperty(id: string, formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const address = String(formData.get("address") ?? "").trim();
  if (!address) {
    throw new Error("A cím megadása kötelező");
  }

  const notes = String(formData.get("notes") ?? "").trim();
  const aiDescription = String(formData.get("ai_description") ?? "").trim();

  const { error } = await supabase
    .from("properties")
    .update({
      address,
      price: parseNumber(formData.get("price")),
      size_sqm: parseNumber(formData.get("size_sqm")),
      status: parseStatus(formData.get("status")),
      features: notes ? { notes } : {},
      ai_description: aiDescription || null,
    })
    .eq("id", id);

  if (error) throw error;

  await uploadPhotoIfPresent(supabase, profile.agency_id, id, formData);

  revalidatePath("/dashboard/properties");
  redirect("/dashboard/properties");
}

export async function deletePropertyPhoto(formData: FormData) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const photoId = String(formData.get("photo_id"));
  const propertyId = String(formData.get("property_id"));

  const { data: photo, error: fetchError } = await supabase
    .from("property_photos")
    .select("path")
    .eq("id", photoId)
    .single();

  if (fetchError) throw fetchError;

  const { error: deleteRowError } = await supabase
    .from("property_photos")
    .delete()
    .eq("id", photoId);

  if (deleteRowError) throw deleteRowError;

  await supabase.storage.from("property-photos").remove([photo.path]);

  revalidatePath(`/dashboard/properties/${propertyId}/edit`);
  revalidatePath("/dashboard/properties");
}

export async function generateDescription(input: {
  address: string;
  price: number | null;
  size_sqm: number | null;
  notes: string;
}): Promise<string> {
  await ensureCurrentUserProfile();

  const address = input.address.trim();
  if (!address) {
    throw new Error("Adj meg legalább egy címet a leírás generálásához");
  }

  const details = [
    `Cím: ${address}`,
    input.price ? `Ár: ${input.price.toLocaleString("hu-HU")} Ft` : null,
    input.size_sqm ? `Alapterület: ${input.size_sqm} m²` : null,
    input.notes.trim() ? `Jellemzők: ${input.notes.trim()}` : null,
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
          "Írj egy vonzó, magyar nyelvű ingatlanhirdetés-leírást (3-5 mondat) az alábbi adatok alapján. " +
          "Ne találj ki olyan adatot, ami nem szerepel az adatok között. Csak a leírás szövegét add vissza, cím vagy egyéb formázás nélkül.\n\n" +
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
    throw new Error("Az AI nem adott vissza leírást, próbáld újra");
  }

  return text;
}

export async function deleteProperty(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/properties");
}

export async function bulkDeleteProperties(ids: string[]) {
  await ensureCurrentUserProfile();
  if (ids.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("properties").delete().in("id", ids);
  if (error) throw error;

  revalidatePath("/dashboard/properties");
}

export type PropertyComparison = {
  perProperty: { id: string; pros: string[]; cons: string[] }[];
  recommendation: string;
};

export async function compareProperties(
  propertyIds: string[],
): Promise<PropertyComparison> {
  await ensureCurrentUserProfile();

  if (propertyIds.length < 2 || propertyIds.length > 4) {
    throw new Error("2 és 4 közötti számú ingatlant válassz az összehasonlításhoz");
  }

  const supabase = await createClient();
  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, address, price, size_sqm, features")
    .in("id", propertyIds);

  if (error) throw error;
  if (!properties || properties.length < 2) {
    throw new Error("Nem található elég ingatlan az összehasonlításhoz");
  }

  const propertyList = properties
    .map((p) => {
      const notes = (p.features as { notes?: string } | null)?.notes;
      return [
        `id: ${p.id}`,
        `cím: ${p.address}`,
        p.price ? `ár: ${p.price.toLocaleString("hu-HU")} Ft` : "ár: nincs megadva",
        p.size_sqm ? `méret: ${p.size_sqm} m²` : "méret: nincs megadva",
        p.price && p.size_sqm ? `ár/m²: ${Math.round(p.price / p.size_sqm).toLocaleString("hu-HU")} Ft/m²` : null,
        notes ? `jellemzők: ${notes}` : "jellemzők: nincs jegyzet",
      ]
        .filter(Boolean)
        .join(", ");
    })
    .join("\n");

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 900,
    system:
      "Csak valid JSON objektumot adj vissza, semmi mást (se magyarázat, se markdown code fence). " +
      'Formátum: {"perProperty": [{"id": "...", "pros": ["..."], "cons": ["..."]}], "recommendation": "..."}. ' +
      "Minden ingatlanhoz legfeljebb 3 előny és 3 hátrány, magyarul, rövid (néhány szavas) pontokban, kizárólag a megadott adatokból következtetve (ne találj ki adatot). " +
      "A recommendation mező 2-3 mondatban foglalja össze, melyik ingatlan melyik ügyfél-igényhez illik jobban (ár-érték, méret, elhelyezkedés alapján, amennyiben ezek az adatokból kiderülnek).",
    messages: [
      {
        role: "user",
        content: `Hasonlítsd össze az alábbi ingatlanokat:\n\n${propertyList}`,
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

  let parsed: PropertyComparison;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch {
    throw new Error("Az AI válasza nem volt feldolgozható, próbáld újra");
  }

  const validIds = new Set(properties.map((p) => p.id));
  return {
    perProperty: (parsed.perProperty ?? []).filter((p) => validIds.has(p.id)),
    recommendation: parsed.recommendation ?? "",
  };
}
