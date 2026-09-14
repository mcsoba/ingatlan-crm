import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM, textToHtml } from "@/lib/resend";

async function autoEnroll(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
  contactId: string,
  hasEmail: boolean,
) {
  if (!hasEmail) return;

  try {
    const { data: sequences } = await admin
      .from("email_sequences")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("trigger", "new_lead")
      .eq("active", true);

    if (!sequences || sequences.length === 0) return;

    for (const sequence of sequences) {
      const { data: firstStep } = await admin
        .from("email_sequence_steps")
        .select("delay_days")
        .eq("sequence_id", sequence.id)
        .eq("step_order", 1)
        .maybeSingle();

      if (!firstStep) continue;

      const nextSendAt = new Date(
        Date.now() + firstStep.delay_days * 24 * 60 * 60 * 1000,
      );

      await admin.from("email_sequence_enrollments").insert({
        agency_id: agencyId,
        sequence_id: sequence.id,
        contact_id: contactId,
        status: "active",
        current_step: 0,
        next_send_at: nextSendAt.toISOString(),
      });
    }
  } catch {
    // Nem kritikus — a lead a CRM-ben már mentve van, a kampány-beiratkozás
    // hiánya miatt nem szabad hibát dobni a beküldőnek.
  }
}

async function notifyAgency(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
  agencyName: string,
  lead: { name: string; email: string | null; phone: string | null; notes: string },
) {
  try {
    const { data: members } = await admin
      .from("profiles")
      .select("id")
      .eq("agency_id", agencyId);

    if (!members || members.length === 0) return;

    const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
    const emailById = new Map((usersPage?.users ?? []).map((u) => [u.id, u.email]));
    const recipients = members
      .map((m) => emailById.get(m.id))
      .filter((e): e is string => Boolean(e));

    if (recipients.length === 0) return;

    const bodyLines = [
      `Új érdeklődő érkezett a(z) ${agencyName} weboldaláról:`,
      "",
      `Név: ${lead.name}`,
      lead.email ? `Email: ${lead.email}` : null,
      lead.phone ? `Telefon: ${lead.phone}` : null,
      lead.notes ? `\n${lead.notes}` : null,
    ]
      .filter((l): l is string => l !== null)
      .join("\n");

    await getResend().emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject: `Új érdeklődő: ${lead.name}`,
      html: textToHtml(bodyLines),
      text: bodyLines,
    });
  } catch {
    // Az email-értesítés nem kritikus — a lead a CRM-ben már mentve van,
    // egy sikertelen küldés miatt nem szabad hibát dobni a beküldőnek.
  }
}

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
    .select("id, name")
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

  const leadEmail = typeof email === "string" && email.trim() ? email.trim() : null;
  const leadPhone = typeof phone === "string" && phone.trim() ? phone.trim() : null;

  const { data: insertedContact, error } = await admin
    .from("contacts")
    .insert({
      agency_id: agencyId,
      name: name.trim(),
      email: leadEmail,
      phone: leadPhone,
      source: "website",
      status: "new",
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Hiba történt a mentés során" }, { status: 500 });
  }

  await Promise.all([
    notifyAgency(admin, agencyId, agency.name, {
      name: name.trim(),
      email: leadEmail,
      phone: leadPhone,
      notes,
    }),
    autoEnroll(admin, agencyId, insertedContact.id, Boolean(leadEmail)),
  ]);

  return NextResponse.json({ ok: true });
}
