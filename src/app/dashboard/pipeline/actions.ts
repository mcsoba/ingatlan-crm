"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

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
