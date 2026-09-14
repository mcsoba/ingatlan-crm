import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const { agencyId, propertyId, name, email, phone, message } = body as Record<
    string,
    unknown
  >;

  if (typeof agencyId !== "string" || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "A név és az iroda azonosítója kötelező" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: agency } = await admin
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .maybeSingle();

  if (!agency) {
    return NextResponse.json({ error: "Ismeretlen iroda" }, { status: 404 });
  }

  let notes = typeof message === "string" ? message.trim() : "";
  if (typeof propertyId === "string" && propertyId) {
    const { data: property } = await admin
      .from("properties")
      .select("address")
      .eq("id", propertyId)
      .maybeSingle();
    if (property) {
      notes = `Érdeklődés ingatlanra: ${property.address}${notes ? `\n\n${notes}` : ""}`;
    }
  }

  const { error } = await admin.from("contacts").insert({
    agency_id: agencyId,
    name: name.trim(),
    email: typeof email === "string" && email.trim() ? email.trim() : null,
    phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
    source: "website",
    status: "new",
    notes: notes || null,
  });

  if (error) {
    return NextResponse.json({ error: "Hiba történt a mentés során" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
