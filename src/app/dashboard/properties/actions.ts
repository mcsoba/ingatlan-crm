"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { anthropic, AI_MODEL } from "@/lib/claude";
import { parseCsv } from "@/lib/csv";
import {
  CONDITION_LABELS,
  ENERGY_RATINGS,
  HEATING_LABELS,
  LISTING_TYPE_LABELS,
  PARKING_LABELS,
  PROPERTY_TYPE_LABELS,
} from "./constants";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const VALID_STATUSES = ["available", "reserved", "sold", "rented"];

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseStatus(value: FormDataEntryValue | null): string {
  const status = String(value ?? "available");
  return VALID_STATUSES.includes(status) ? status : "available";
}

function parseChoice(
  value: FormDataEntryValue | null,
  allowed: Record<string, string> | string[],
): string | null {
  const v = String(value ?? "").trim();
  const keys = Array.isArray(allowed) ? allowed : Object.keys(allowed);
  return keys.includes(v) ? v : null;
}

function parseInt16(value: FormDataEntryValue | null): number | null {
  const n = parseNumber(value);
  return n == null ? null : Math.round(n);
}

// Tri-state checkbox fields: the form sends "yes"/"no"; anything else
// (including the field being absent) means "not specified".
function parseYesNo(value: FormDataEntryValue | null): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

// The structured listing fields (0037), shared by create and update.
function parseListingFields(formData: FormData) {
  const listingType = parseChoice(formData.get("listing_type"), LISTING_TYPE_LABELS);
  const rentOnly = <T,>(v: T) => (listingType === "rent" ? v : null);
  return {
    listing_type: listingType,
    property_type: parseChoice(formData.get("property_type"), PROPERTY_TYPE_LABELS),
    city: String(formData.get("city") ?? "").trim() || null,
    postal_code: String(formData.get("postal_code") ?? "").trim() || null,
    plot_sqm: parseNumber(formData.get("plot_sqm")),
    rooms: parseInt16(formData.get("rooms")),
    half_rooms: parseInt16(formData.get("half_rooms")),
    floor: parseInt16(formData.get("floor")),
    building_floors: parseInt16(formData.get("building_floors")),
    year_built: parseInt16(formData.get("year_built")),
    condition: parseChoice(formData.get("condition"), CONDITION_LABELS),
    heating: formData
      .getAll("heating")
      .map((v) => String(v))
      .filter((v) => v in HEATING_LABELS),
    energy_rating: parseChoice(formData.get("energy_rating"), ENERGY_RATINGS),
    parking: parseChoice(formData.get("parking"), PARKING_LABELS),
    balcony_sqm: parseNumber(formData.get("balcony_sqm")),
    has_lift: parseYesNo(formData.get("has_lift")),
    has_air_conditioning: parseYesNo(formData.get("has_air_conditioning")),
    has_garden_access: parseYesNo(formData.get("has_garden_access")),
    is_furnished: parseYesNo(formData.get("is_furnished")),
    monthly_common_cost: parseNumber(formData.get("monthly_common_cost")),
    min_lease_months: rentOnly(parseInt16(formData.get("min_lease_months"))),
    pets_allowed: rentOnly(parseYesNo(formData.get("pets_allowed"))),
  };
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
      ...parseListingFields(formData),
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
      ...parseListingFields(formData),
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

export async function reorderPropertyPhotos(
  propertyId: string,
  orderedPhotoIds: string[],
) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  // A property_photos sorok nem tárolják közvetlenül az agency_id-t a
  // policy-kban használt módon minden lekérdezésnél, ezért itt explicit
  // ellenőrizzük, hogy a fotók tényleg a hívó irodájához tartozó
  // ingatlanhoz kapcsolódnak, mielőtt bármit módosítanánk.
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("agency_id", profile.agency_id)
    .maybeSingle();
  if (!property) throw new Error("Nincs jogosultságod ehhez az ingatlanhoz");

  await Promise.all(
    orderedPhotoIds.map((photoId, index) =>
      supabase
        .from("property_photos")
        .update({ position: index })
        .eq("id", photoId)
        .eq("property_id", propertyId),
    ),
  );

  revalidatePath(`/dashboard/properties/${propertyId}/edit`);
  revalidatePath("/dashboard/properties");
  revalidatePath(`/p/${propertyId}`);
}

export async function generateDescription(input: {
  address: string;
  price: number | null;
  size_sqm: number | null;
  notes: string;
  // Human-readable structured facts from the form ("Típus: Tégla lakás", ...)
  facts?: string[];
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
    ...(input.facts ?? []).slice(0, 30).map((f) => String(f).slice(0, 200)),
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
          "Ne találj ki olyan adatot, ami nem szerepel az adatok között: ne állíts például költözhetőséget, kilátást, csendes környezetet, " +
          "városrészt vagy állapotot, ha az nincs megadva. Csak a leírás szövegét add vissza, cím vagy egyéb formázás nélkül.\n\n" +
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

  await softDeleteProperties([id]);

  revalidatePath("/dashboard/properties");
}

export async function bulkDeleteProperties(ids: string[]) {
  await ensureCurrentUserProfile();
  if (ids.length === 0) return;

  await softDeleteProperties(ids);

  revalidatePath("/dashboard/properties");
}

export async function bulkUpdatePropertyStatus(ids: string[], status: string) {
  const { profile } = await ensureCurrentUserProfile();
  if (ids.length === 0) return;
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Érvénytelen státusz");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({ status })
    .eq("agency_id", profile.agency_id)
    .in("id", ids);
  if (error) throw error;

  revalidatePath("/dashboard/properties");
}

// Soft-delete: sets deleted_at instead of removing the row, so it can be
// restored from /dashboard/trash within 30 days. Mirrors the FK behavior the
// hard-delete used to rely on (deleting a property used to null out the
// property_id on any deals pointing at it) by doing the same here.
//
// Goes through the soft_delete_properties RPC (security definer, 0035)
// rather than a plain client-side UPDATE -- see the matching comment on
// softDeleteContacts (contacts/actions.ts) for why: the admin client this
// used to go through has no user JWT, so the audit_log trigger attributed
// every delete to "Rendszer" instead of the actual team member.
async function softDeleteProperties(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_properties", { p_ids: ids });
  if (error) throw error;
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

export async function shareComparison(
  propertyIds: string[],
  analysis: PropertyComparison,
): Promise<string> {
  const { profile } = await ensureCurrentUserProfile();

  if (propertyIds.length < 2 || propertyIds.length > 4) {
    throw new Error("2 és 4 közötti számú ingatlant válassz a megosztáshoz");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_comparisons")
    .insert({
      agency_id: profile.agency_id,
      created_by: profile.id,
      property_ids: propertyIds,
      analysis,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export type ImportResult = { imported: number; skipped: number };

export async function importPropertiesCsv(formData: FormData): Promise<ImportResult> {
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
  const addressIdx = header.indexOf("address");
  if (addressIdx === -1) {
    throw new Error(
      "A CSV első sorában (fejléc) kötelező az 'address' oszlop. Elvárt formátum: address,price,size_sqm,status,notes (opcionálisan: listing_type,property_type,city,postal_code,rooms)",
    );
  }
  const priceIdx = header.indexOf("price");
  const sizeIdx = header.indexOf("size_sqm");
  const statusIdx = header.indexOf("status");
  const notesIdx = header.indexOf("notes");
  const listingTypeIdx = header.indexOf("listing_type");
  const propertyTypeIdx = header.indexOf("property_type");
  const cityIdx = header.indexOf("city");
  const postalIdx = header.indexOf("postal_code");
  const roomsIdx = header.indexOf("rooms");
  const cell = (row: string[], idx: number) => (idx === -1 ? "" : (row[idx] ?? "").trim());

  let imported = 0;
  let skipped = 0;
  const toInsert: {
    agency_id: string;
    address: string;
    price: number | null;
    size_sqm: number | null;
    status: string;
    features: { notes?: string };
    listing_type: string | null;
    property_type: string | null;
    city: string | null;
    postal_code: string | null;
    rooms: number | null;
  }[] = [];

  for (const row of rows.slice(1)) {
    const address = row[addressIdx]?.trim();
    if (!address) {
      skipped++;
      continue;
    }
    const status = row[statusIdx]?.trim().toLowerCase();
    const notes = row[notesIdx]?.trim();
    toInsert.push({
      agency_id: profile.agency_id,
      address,
      price: parseNumber(row[priceIdx] ?? null),
      size_sqm: parseNumber(row[sizeIdx] ?? null),
      status: VALID_STATUSES.includes(status) ? status : "available",
      features: notes ? { notes } : {},
      listing_type: parseChoice(cell(row, listingTypeIdx), LISTING_TYPE_LABELS),
      property_type: parseChoice(cell(row, propertyTypeIdx), PROPERTY_TYPE_LABELS),
      city: cell(row, cityIdx) || null,
      postal_code: cell(row, postalIdx) || null,
      rooms: parseInt16(cell(row, roomsIdx) || null),
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("properties").insert(toInsert);
    if (error) throw error;
    imported = toInsert.length;
  }

  revalidatePath("/dashboard/properties");
  return { imported, skipped };
}
