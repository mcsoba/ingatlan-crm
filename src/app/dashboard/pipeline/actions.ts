"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { anthropic, AI_MODEL } from "@/lib/claude";

export async function createDeal(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const contactId = String(formData.get("contact_id") ?? "");
  const propertyId = String(formData.get("property_id") ?? "");

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
  });

  if (error) throw error;

  revalidatePath("/dashboard/pipeline");
  redirect("/dashboard/pipeline");
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

export async function deleteDeal(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/pipeline");
  redirect("/dashboard/pipeline");
}

export async function createStage(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
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
  await ensureCurrentUserProfile();
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
  await ensureCurrentUserProfile();
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
  await ensureCurrentUserProfile();
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
