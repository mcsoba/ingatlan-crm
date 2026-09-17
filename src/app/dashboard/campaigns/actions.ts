"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

export async function createSequence(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const name = String(formData.get("name") ?? "").trim();
  const trigger = String(formData.get("trigger") ?? "manual");

  if (!name) throw new Error("A kampány nevének megadása kötelező");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_sequences")
    .insert({ agency_id: profile.agency_id, name, trigger })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/campaigns/${data.id}`);
}

export async function toggleSequenceActive(id: string, active: boolean) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("email_sequences")
    .update({ active: !active })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${id}`);
}

export async function deleteSequence(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("email_sequences").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/campaigns");
  redirect("/dashboard/campaigns");
}

export async function addStep(sequenceId: string, formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const delayDays = Number(formData.get("delay_days") ?? 0);
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!subject || !body) {
    throw new Error("A tárgy és a törzs megadása kötelező");
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("email_sequence_steps")
    .select("id", { count: "exact", head: true })
    .eq("sequence_id", sequenceId);

  const { error } = await supabase.from("email_sequence_steps").insert({
    agency_id: profile.agency_id,
    sequence_id: sequenceId,
    step_order: (count ?? 0) + 1,
    delay_days: Number.isFinite(delayDays) ? Math.max(0, delayDays) : 0,
    subject,
    body,
  });

  if (error) throw error;

  revalidatePath(`/dashboard/campaigns/${sequenceId}`);
}

export async function deleteStep(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));
  const sequenceId = String(formData.get("sequenceId"));

  const supabase = await createClient();
  const { error } = await supabase.from("email_sequence_steps").delete().eq("id", id);
  if (error) throw error;

  revalidatePath(`/dashboard/campaigns/${sequenceId}`);
}

export type SequenceOption = { id: string; name: string };

export async function listActiveSequences(): Promise<SequenceOption[]> {
  await ensureCurrentUserProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_sequences")
    .select("id, name")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export type Enrollment = {
  id: string;
  status: string;
  current_step: number;
  next_send_at: string | null;
  email_sequences: { id: string; name: string } | null;
};

export async function listContactEnrollments(contactId: string): Promise<Enrollment[]> {
  await ensureCurrentUserProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_sequence_enrollments")
    .select("id, status, current_step, next_send_at, email_sequences(id, name)")
    .eq("contact_id", contactId)
    .order("enrolled_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Enrollment[];
}

export async function enrollContact(contactId: string, sequenceId: string) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const [{ data: contact, error: contactError }, { data: steps, error: stepsError }] =
    await Promise.all([
      supabase.from("contacts").select("email").eq("id", contactId).single(),
      supabase
        .from("email_sequence_steps")
        .select("delay_days")
        .eq("sequence_id", sequenceId)
        .order("step_order", { ascending: true })
        .limit(1),
    ]);

  if (contactError) throw contactError;
  if (!contact.email) {
    throw new Error("Ehhez a kontakthoz nincs megadva email cím");
  }
  if (stepsError) throw stepsError;
  if (!steps || steps.length === 0) {
    throw new Error("Ehhez a kampányhoz még nincs egyetlen lépés sem hozzáadva");
  }

  const now = new Date();
  const nextSendAt = new Date(now.getTime() + steps[0].delay_days * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("email_sequence_enrollments").insert({
    agency_id: profile.agency_id,
    sequence_id: sequenceId,
    contact_id: contactId,
    status: "active",
    current_step: 0,
    next_send_at: nextSendAt.toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ez a kontakt már be van iratkozva ebbe a kampányba");
    }
    throw error;
  }

  revalidatePath(`/dashboard/contacts/${contactId}/edit`);
}

export async function bulkEnrollByTag(sequenceId: string, formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const tagId = String(formData.get("tag_id") ?? "");

  if (!tagId) {
    redirect(
      `/dashboard/campaigns/${sequenceId}?enroll_error=${encodeURIComponent("Válassz egy címkét")}`,
    );
  }

  const supabase = await createClient();

  const [{ data: steps, error: stepsError }, { data: tagged, error: tagError }] =
    await Promise.all([
      supabase
        .from("email_sequence_steps")
        .select("delay_days")
        .eq("sequence_id", sequenceId)
        .order("step_order", { ascending: true })
        .limit(1),
      supabase
        .from("contact_tags")
        .select("contact_id, contacts(id, email)")
        .eq("tag_id", tagId),
    ]);

  if (stepsError) throw stepsError;
  if (tagError) throw tagError;

  if (!steps || steps.length === 0) {
    redirect(
      `/dashboard/campaigns/${sequenceId}?enroll_error=${encodeURIComponent(
        "Ehhez a kampányhoz még nincs egyetlen lépés sem hozzáadva",
      )}`,
    );
  }

  const contactsWithEmail = (tagged ?? [])
    .map((row) => row.contacts as unknown as { id: string; email: string | null } | null)
    .filter((c): c is { id: string; email: string } => !!c?.email);

  if (contactsWithEmail.length === 0) {
    redirect(
      `/dashboard/campaigns/${sequenceId}?enroll_error=${encodeURIComponent(
        "Ezzel a címkével nincs email-címmel rendelkező kontakt",
      )}`,
    );
  }

  const now = new Date();
  const nextSendAt = new Date(now.getTime() + steps[0].delay_days * 24 * 60 * 60 * 1000);

  const rows = contactsWithEmail.map((contact) => ({
    agency_id: profile.agency_id,
    sequence_id: sequenceId,
    contact_id: contact.id,
    status: "active",
    current_step: 0,
    next_send_at: nextSendAt.toISOString(),
  }));

  const { data: inserted, error } = await supabase
    .from("email_sequence_enrollments")
    .upsert(rows, { onConflict: "sequence_id,contact_id", ignoreDuplicates: true })
    .select("id");

  if (error) throw error;

  const enrolled = inserted?.length ?? 0;
  const skipped = rows.length - enrolled;

  revalidatePath(`/dashboard/campaigns/${sequenceId}`);
  redirect(`/dashboard/campaigns/${sequenceId}?enrolled=${enrolled}&skipped=${skipped}`);
}

export async function cancelEnrollment(enrollmentId: string, contactId: string) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("email_sequence_enrollments")
    .update({ status: "cancelled", next_send_at: null })
    .eq("id", enrollmentId);
  if (error) throw error;

  revalidatePath(`/dashboard/contacts/${contactId}/edit`);
}
