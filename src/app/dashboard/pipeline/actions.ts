"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCurrentUserProfile, requireOwnerOrAdmin } from "@/lib/agency";
import { anthropic, AI_MODEL } from "@/lib/claude";

export async function createDeal(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const contactId = String(formData.get("contact_id") ?? "");
  const propertyId = String(formData.get("property_id") ?? "");
  const ownerId = String(formData.get("owner_id") ?? "") || profile.id;

  if (!contactId) {
    throw new Error("A kontakt kiválasztása kötelező");
  }

  const { data: firstStage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id")
    .order("position")
    .limit(1)
    .single();

  if (stageError) throw stageError;

  const { error } = await supabase.from("deals").insert({
    agency_id: profile.agency_id,
    contact_id: contactId,
    property_id: propertyId || null,
    stage_id: firstStage.id,
    owner_id: ownerId,
  });

  if (error) throw error;

  revalidatePath("/dashboard/pipeline");
  redirect("/dashboard/pipeline");
}

// One-click "next step" from the pipeline board: schedules a follow-up
// reminder N days out (09:00 local server time) on the deal and its contact,
// so a deal with no planned activity can be fixed without leaving the board.
export async function scheduleDealFollowUp(dealId: string, days: number) {
  const { profile } = await ensureCurrentUserProfile();
  if (!Number.isInteger(days) || days < 0 || days > 365) {
    throw new Error("Érvénytelen határidő");
  }
  const supabase = await createClient();

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("contact_id")
    .eq("id", dealId)
    .single();
  if (dealError) throw dealError;

  const due = new Date();
  due.setDate(due.getDate() + days);
  due.setHours(9, 0, 0, 0);

  const { error } = await supabase.from("activities").insert({
    agency_id: profile.agency_id,
    contact_id: deal.contact_id,
    deal_id: dealId,
    type: "reminder",
    content: "Követés — következő lépés egyeztetése",
    due_at: due.toISOString(),
  });
  if (error) throw error;

  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard");
}

// Quick note/call log straight from the board. Logging counts as movement on
// the deal, so it also refreshes updated_at (clears the "stale" warning).
export async function logDealActivity(
  dealId: string,
  type: "note" | "call",
  content: string,
) {
  const { profile } = await ensureCurrentUserProfile();
  const text = content.trim();
  if (!text) throw new Error("A tartalom megadása kötelező");
  if (type !== "note" && type !== "call") throw new Error("Érvénytelen típus");
  const supabase = await createClient();

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("contact_id")
    .eq("id", dealId)
    .single();
  if (dealError) throw dealError;

  const { error } = await supabase.from("activities").insert({
    agency_id: profile.agency_id,
    contact_id: deal.contact_id,
    deal_id: dealId,
    type,
    content: text,
  });
  if (error) throw error;

  await supabase
    .from("deals")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", dealId);

  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard");
}

export async function moveDeal(dealId: string, stageId: string) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("deals")
    .update({ stage_id: stageId, updated_at: new Date().toISOString() })
    .eq("id", dealId);

  if (error) throw error;

  revalidatePath("/dashboard/pipeline");
}

export async function updateDealStage(dealId: string, formData: FormData) {
  const stageId = String(formData.get("stage_id") ?? "");
  if (!stageId) throw new Error("A szakasz kiválasztása kötelező");

  await moveDeal(dealId, stageId);
  revalidatePath(`/dashboard/pipeline/${dealId}`);
}

export async function updateDealOwner(dealId: string, formData: FormData) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const ownerId = String(formData.get("owner_id") ?? "") || null;

  const { error } = await supabase
    .from("deals")
    .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
    .eq("id", dealId);

  if (error) throw error;

  revalidatePath(`/dashboard/pipeline/${dealId}`);
}

export async function updateDealNotes(dealId: string, formData: FormData) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const notes = String(formData.get("notes") ?? "").trim();

  const { error } = await supabase
    .from("deals")
    .update({ notes: notes || null, updated_at: new Date().toISOString() })
    .eq("id", dealId);

  if (error) throw error;

  revalidatePath(`/dashboard/pipeline/${dealId}`);
}

export async function updateDealCommission(dealId: string, formData: FormData) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const amountRaw = String(formData.get("deal_amount") ?? "").trim();
  const rateRaw = String(formData.get("commission_rate") ?? "").trim();

  const dealAmount = amountRaw ? Number(amountRaw.replace(",", ".")) : null;
  const commissionRate = rateRaw ? Number(rateRaw.replace(",", ".")) : null;

  const { error } = await supabase
    .from("deals")
    .update({
      deal_amount: dealAmount,
      commission_rate: commissionRate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);

  if (error) throw error;

  revalidatePath(`/dashboard/pipeline/${dealId}`);
}

const CHECKLIST_TEMPLATE = [
  "Foglaló befizetve",
  "Adásvételi szerződés ügyvédnél",
  "Hiteligénylés / finanszírozás elrendezve",
  "Energetikai tanúsítvány megvan",
  "Földhivatali bejegyzés benyújtva",
  "Közműórák leolvasva, átírás elindítva",
  "Kulcsátadás időpontja egyeztetve",
];

export async function seedTransactionChecklist(dealId: string) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("activities").insert(
    CHECKLIST_TEMPLATE.map((label) => ({
      agency_id: profile.agency_id,
      deal_id: dealId,
      type: "checklist",
      content: label,
      done: false,
    })),
  );

  if (error) throw error;

  revalidatePath(`/dashboard/pipeline/${dealId}`);
}

export async function markDealLost(dealId: string, formData: FormData) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const reason = String(formData.get("lost_reason") ?? "").trim();

  const { error } = await supabase
    .from("deals")
    .update({
      status: "lost",
      lost_reason: reason || null,
      lost_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);

  if (error) throw error;

  revalidatePath(`/dashboard/pipeline/${dealId}`);
  revalidatePath("/dashboard/pipeline");
}

export async function markDealWon(dealId: string) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: lastStage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  if (stageError) throw stageError;

  const { error } = await supabase
    .from("deals")
    .update({
      stage_id: lastStage.id,
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);

  if (error) throw error;

  revalidatePath(`/dashboard/pipeline/${dealId}`);
  revalidatePath("/dashboard/pipeline");
}

export async function reopenDeal(dealId: string) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("deals")
    .update({
      status: "open",
      lost_reason: null,
      lost_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);

  if (error) throw error;

  revalidatePath(`/dashboard/pipeline/${dealId}`);
  revalidatePath("/dashboard/pipeline");
}

export async function deleteDeal(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const id = String(formData.get("id"));

  // Admin client, not RLS-scoped: the deals SELECT policy excludes
  // deleted_at rows, and Postgres applies that policy to a plain UPDATE's
  // row-visibility/WITH CHECK too, so this write would fail (or silently
  // match nothing, for a restore) under RLS. The explicit agency_id filter
  // is what keeps this safe now that RLS isn't doing that job.
  const admin = createAdminClient();
  const { error } = await admin
    .from("deals")
    .update({ deleted_at: new Date().toISOString() })
    .eq("agency_id", profile.agency_id)
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/pipeline");
  redirect("/dashboard/pipeline");
}

export async function createStage(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A név megadása kötelező");

  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("pipeline_stages")
    .select("position")
    .eq("agency_id", profile.agency_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("pipeline_stages").insert({
    agency_id: profile.agency_id,
    name,
    position: (maxRow?.position ?? 0) + 1,
  });

  if (error) throw error;

  revalidatePath("/dashboard/pipeline/stages");
  revalidatePath("/dashboard/pipeline");
}

export async function renameStage(id: string, formData: FormData) {
  await requireOwnerOrAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A név megadása kötelező");

  const supabase = await createClient();
  const { error } = await supabase
    .from("pipeline_stages")
    .update({ name })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/dashboard/pipeline/stages");
  revalidatePath("/dashboard/pipeline");
}

export async function deleteStage(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "Ez a szakasz nem törölhető, mert vannak hozzá tartozó dealek — mozgasd át őket egy másik szakaszba előbb.",
      );
    }
    throw error;
  }

  revalidatePath("/dashboard/pipeline/stages");
  revalidatePath("/dashboard/pipeline");
}

export async function moveStage(id: string, direction: "up" | "down") {
  await requireOwnerOrAdmin();
  const supabase = await createClient();

  const { data: stages, error } = await supabase
    .from("pipeline_stages")
    .select("id, position")
    .order("position");

  if (error) throw error;

  const idx = stages.findIndex((s) => s.id === id);
  if (idx === -1) return;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= stages.length) return;

  const a = stages[idx];
  const b = stages[swapIdx];

  const { error: errorA } = await supabase
    .from("pipeline_stages")
    .update({ position: b.position })
    .eq("id", a.id);
  if (errorA) throw errorA;

  const { error: errorB } = await supabase
    .from("pipeline_stages")
    .update({ position: a.position })
    .eq("id", b.id);
  if (errorB) throw errorB;

  revalidatePath("/dashboard/pipeline/stages");
  revalidatePath("/dashboard/pipeline");
}

export async function generateDealFollowUp(input: {
  contactName: string;
  stageName: string;
  propertyAddress: string | null;
  notes: string;
}): Promise<string> {
  await ensureCurrentUserProfile();

  const name = input.contactName.trim();
  if (!name) {
    throw new Error("Nincs kontakt ehhez a dealhez");
  }

  const details = [
    `Kontakt neve: ${name}`,
    `Deal jelenlegi szakasza: ${input.stageName}`,
    input.propertyAddress ? `Kapcsolódó ingatlan: ${input.propertyAddress}` : null,
    input.notes.trim() ? `Jegyzet a dealről: ${input.notes.trim()}` : null,
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
          "ennek az ügyletnek (deal) a kontaktjához, a jelenlegi szakasz és a jegyzet alapján igazítva a hangnemet. " +
          "Ne találj ki konkrét adatot, ami nem szerepel az adatok között. " +
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

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function askDealAssistant(
  dealId: string,
  messages: ChatMessage[],
): Promise<string> {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const [{ data: deal }, { data: stages }, { data: activities }] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "notes, deal_amount, commission_rate, stage_id, contacts(name, email, phone, status, notes), properties(address, price, size_sqm, features)",
      )
      .eq("id", dealId)
      .maybeSingle(),
    supabase.from("pipeline_stages").select("id, name").order("position"),
    supabase
      .from("activities")
      .select("type, content, due_at, done, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!deal) throw new Error("A deal nem található");

  const contact = deal.contacts as unknown as {
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    notes: string | null;
  } | null;
  const property = deal.properties as unknown as {
    address: string;
    price: number | null;
    size_sqm: number | null;
    features: { notes?: string } | null;
  } | null;
  const stageName = stages?.find((s) => s.id === deal.stage_id)?.name ?? "—";

  const activityLines = (activities ?? [])
    .map(
      (a) =>
        `- [${a.type}${a.done ? ", lezárva" : ""}] ${a.content}${a.due_at ? ` (határidő: ${new Date(a.due_at).toLocaleDateString("hu-HU")})` : ""}`,
    )
    .join("\n");

  const context = [
    `Mai dátum: ${new Date().toLocaleDateString("hu-HU")}`,
    `Pipeline szakasz: ${stageName}`,
    `Deal jegyzet: ${deal.notes?.trim() || "nincs"}`,
    deal.deal_amount ? `Végleges ár: ${deal.deal_amount.toLocaleString("hu-HU")} Ft` : null,
    deal.commission_rate ? `Jutalék: ${deal.commission_rate}%` : null,
    "",
    "Kontakt:",
    contact
      ? [
          `- Név: ${contact.name}`,
          `- Státusz: ${contact.status}`,
          contact.email ? `- Email: ${contact.email}` : null,
          contact.phone ? `- Telefon: ${contact.phone}` : null,
          contact.notes ? `- Jegyzet: ${contact.notes}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "nincs kontakt",
    "",
    "Ingatlan:",
    property
      ? [
          `- Cím: ${property.address}`,
          property.price ? `- Ár: ${property.price.toLocaleString("hu-HU")} Ft` : null,
          property.size_sqm ? `- Méret: ${property.size_sqm} m²` : null,
          property.features?.notes ? `- Jellemzők: ${property.features.notes}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "nincs kapcsolódó ingatlan",
    "",
    "Aktivitás-történet (legfrissebb elöl):",
    activityLines || "nincs rögzített aktivitás",
  ].join("\n");

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 500,
    system:
      "Egy ingatlanos CRM beépített asszisztense vagy, egy konkrét ügylet (deal) oldalán. " +
      "Az alábbi adatok az egész kontextusod erről az ügyletről — csak ezekre támaszkodj, ne találj ki adatot, " +
      "ami nem szerepel bennük. Válaszolj magyarul, tömören (max 3-4 mondat, hacsak nem kérnek listát), " +
      "és ha kérdezik mi legyen a következő lépés, adj konkrét, az adatokból következő javaslatot.\n\n" +
      context,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Az AI nem adott választ, próbáld újra");
  }

  return text;
}
