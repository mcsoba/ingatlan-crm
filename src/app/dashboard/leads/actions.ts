"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

function revalidateLeadViews() {
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/pipeline");
}

async function setContactStatus(contactId: string, status: string) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ status })
    .eq("id", contactId);
  if (error) throw error;
}

export async function markLeadContacted(contactId: string) {
  await setContactStatus(contactId, "contacted");
  revalidateLeadViews();
}

export async function dismissLead(contactId: string) {
  await setContactStatus(contactId, "inactive");
  revalidateLeadViews();
}

// Qualifying a lead = the contact becomes "qualified" and a deal is opened
// in the first pipeline stage, owned by whoever qualified it. Unlike
// createDeal there is no redirect: the agent stays in the inbox and keeps
// working through the queue.
export async function qualifyLead(contactId: string) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: firstStage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id")
    .order("position")
    .limit(1)
    .single();
  if (stageError) throw stageError;

  const { error: dealError } = await supabase.from("deals").insert({
    agency_id: profile.agency_id,
    contact_id: contactId,
    stage_id: firstStage.id,
    owner_id: profile.id,
  });
  if (dealError) throw dealError;

  await setContactStatus(contactId, "qualified");
  revalidateLeadViews();
}
