import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";

// Teljes iroda-adatexport GDPR-adathordozhatosaghoz/biztonsagi mentesnek.
// A rendes (RLS-es) klienst hasznaljuk, ugyanugy mint a mar meglevo
// pipeline/contacts CSV export route-oknal -- a policy-k mar ugy is csak
// a hivo sajat agency_id-jahoz tartozo sorokat engedik at, nem kell kulon
// szurni.
export async function GET() {
  const profile = await requireOwnerOrAdmin();
  const supabase = await createClient();

  const [
    { data: contacts, error: contactsError },
    { data: properties, error: propertiesError },
    { data: deals, error: dealsError },
    { data: activities, error: activitiesError },
  ] = await Promise.all([
    supabase.from("contacts").select("*").order("created_at"),
    supabase.from("properties").select("*").order("created_at"),
    supabase.from("deals").select("*").order("created_at"),
    supabase.from("activities").select("*").order("created_at"),
  ]);

  if (contactsError) throw contactsError;
  if (propertiesError) throw propertiesError;
  if (dealsError) throw dealsError;
  if (activitiesError) throw activitiesError;

  const exportPayload = {
    exported_at: new Date().toISOString(),
    agency_id: profile.agency_id,
    contacts: contacts ?? [],
    properties: properties ?? [],
    deals: deals ?? [],
    activities: activities ?? [],
  };

  return new Response(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ingatlan-crm-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
