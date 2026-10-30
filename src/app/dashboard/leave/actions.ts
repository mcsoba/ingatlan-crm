"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile, requireOwnerOrAdmin } from "@/lib/agency";
import { countWorkdays } from "./workdays";

function parseDays(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? Math.round(n * 2) / 2 : null;
}

function revalidateLeave() {
  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/calendar");
}

/** Éves szabadságkeret beállítása egy munkatársnak (csak irodavezető). */
export async function setLeaveAllowance(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const profileId = String(formData.get("profile_id") ?? "");
  const year = Number(formData.get("year"));
  const days = parseDays(formData.get("days"));
  if (!profileId || !Number.isInteger(year)) throw new Error("Hiányzó adat");

  const supabase = await createClient();
  if (days === null || String(formData.get("days") ?? "").trim() === "") {
    const { error } = await supabase
      .from("leave_allowances")
      .delete()
      .eq("profile_id", profileId)
      .eq("year", year);
    if (error) throw error;
  } else {
    if (days < 0) throw new Error("A keret nem lehet negatív");
    const { error } = await supabase.from("leave_allowances").upsert({
      agency_id: profile.agency_id,
      profile_id: profileId,
      year,
      days,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
  revalidateLeave();
}

/**
 * Szabadság rögzítése. Munkatárs csak magának, irodavezető bárkinek. Ha a
 * napok száma üres, a két dátum közötti munkanapok (H–P) számítanak.
 */
export async function createLeave(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const isManager = profile.role === "owner" || profile.role === "admin";
  const profileId = isManager ? String(formData.get("profile_id") || profile.id) : profile.id;
  const start = String(formData.get("start_date") ?? "");
  const end = String(formData.get("end_date") || start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error("Add meg a szabadság kezdő napját");
  }
  if (end < start) throw new Error("A záró nap nem lehet a kezdő nap előtt");
  if (start.slice(0, 4) !== end.slice(0, 4)) {
    throw new Error("Évfordulón átnyúló szabadságot két részletben rögzíts (évenként külön keret van)");
  }

  const days = String(formData.get("days") ?? "").trim()
    ? parseDays(formData.get("days"))
    : countWorkdays(start, end);
  if (!days || days <= 0) throw new Error("A szabadság legalább fél nap legyen");

  const note = String(formData.get("note") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("leaves").insert({
    agency_id: profile.agency_id,
    profile_id: profileId,
    start_date: start,
    end_date: end,
    days,
    note,
  });
  if (error) throw error;
  revalidateLeave();
}

export async function deleteLeave(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  // Az RLS gondoskodik róla, hogy csak a saját vagy (irodavezetőként) bárki szabadsága törölhető
  const { error } = await supabase.from("leaves").delete().eq("id", id);
  if (error) throw error;
  revalidateLeave();
}
