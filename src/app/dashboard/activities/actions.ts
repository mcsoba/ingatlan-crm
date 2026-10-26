"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { anthropic, AI_MODEL } from "@/lib/claude";
import { syncActivityStatusChange, syncActivityDeletion } from "@/lib/google-calendar-sync";
import { sendPushToProfiles } from "@/lib/push";

const TYPE_LABELS: Record<string, string> = {
  note: "jegyzet",
  call: "telefonhívás",
  viewing: "ingatlan-megtekintés",
  reminder: "emlékeztető",
};

export async function createActivity(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const content = String(formData.get("content") ?? "").trim();
  if (!content) {
    throw new Error("A tartalom megadása kötelező");
  }

  const contactId = String(formData.get("contact_id") ?? "") || null;
  const dealId = String(formData.get("deal_id") ?? "") || null;
  const type = String(formData.get("type") ?? "note");
  const dueAtRaw = String(formData.get("due_at") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? "");
  const recurrenceRaw = String(formData.get("recurrence") ?? "none");
  const recurrence = ["none", "daily", "weekly", "monthly"].includes(recurrenceRaw)
    ? recurrenceRaw
    : "none";

  // Felelős: csak az iroda tagja lehet (a profiles RLS csak a saját irodát látja);
  // ha nincs megadva, az adatbázis alapértéke a létrehozó (auth.uid()).
  const assignedRaw = String(formData.get("assigned_to") ?? "");
  let assignedTo: string | null = null;
  if (assignedRaw) {
    const { data: member } = await supabase.from("profiles").select("id").eq("id", assignedRaw).maybeSingle();
    assignedTo = member?.id ?? null;
  }

  const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : null;
  const { error } = await supabase.from("activities").insert({
    agency_id: profile.agency_id,
    contact_id: contactId,
    deal_id: dealId,
    type,
    content,
    due_at: dueAt,
    recurrence,
    ...(assignedTo ? { assigned_to: assignedTo } : {}),
  });

  if (error) throw error;

  if (assignedTo && assignedTo !== profile.id) {
    await sendPushToProfiles(createAdminClient(), [assignedTo], {
      title: "Új feladatot kaptál",
      body: `${profile.full_name || "Egy kollégád"}: ${content}${dueAt ? ` (határidő: ${new Date(dueAt).toLocaleDateString("hu-HU")})` : ""}`,
      url: dealId ? `/deal/${dealId}` : contactId ? `/contact/${contactId}` : "/",
    });
  }

  if (redirectTo) revalidatePath(redirectTo);
  revalidatePath("/dashboard");
}

export async function toggleActivityDone(
  id: string,
  done: boolean,
  redirectTo: string,
) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("activities")
    .update({ done })
    .eq("id", id);

  if (error) throw error;

  try {
    await syncActivityStatusChange(createAdminClient(), id, done);
  } catch (err) {
    // A Google Naptár szinkron hibája sose akassza el a CRM-műveletet --
    // ugyanaz a minta, mint a többi 3rd-party integrációnál a projektben.
    console.error("Google Naptár szinkron sikertelen (aktivitás állapot)", err);
  }

  if (redirectTo) revalidatePath(redirectTo);
  revalidatePath("/dashboard");
}

export async function summarizeActivityNote(input: {
  type: string;
  rawText: string;
}): Promise<string> {
  await ensureCurrentUserProfile();

  const rawText = input.rawText.trim();
  if (!rawText) {
    throw new Error("Írj be valamilyen nyers jegyzetet az összefoglaláshoz");
  }

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content:
          `Az alábbi nyers, gyorsan bediktált/beírt jegyzet egy ingatlanos ügynök ${TYPE_LABELS[input.type] ?? input.type}-éről szól. ` +
          "Strukturáld át röviden, magyarul, két részre: 'Összefoglaló: ...' (1-3 mondat) és 'Következő lépés: ...' " +
          "(1 mondat, csak akkor javasolj konkrét lépést, ha az a szövegből következik, egyébként írd hogy nincs egyértelmű következő lépés). " +
          "Ne találj ki adatot, ami nincs a szövegben.\n\n" +
          rawText,
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Az AI nem adott vissza összefoglalót, próbáld újra");
  }

  return text;
}

export async function deleteActivity(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));
  const redirectTo = String(formData.get("redirect_to") ?? "");

  try {
    // A törlés előtt kell meghívni -- az activity_google_events sorok
    // on delete cascade-del automatikusan eltűnnek az aktivitással együtt.
    await syncActivityDeletion(createAdminClient(), id);
  } catch (err) {
    console.error("Google Naptár szinkron sikertelen (aktivitás törlés)", err);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) throw error;

  if (redirectTo) revalidatePath(redirectTo);
  revalidatePath("/dashboard");
}
