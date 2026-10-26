import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TeamMember = { id: string; name: string };

// Az iroda tagjai megjeleníthető névvel (teljes név, különben e-mail cím) —
// pl. a "Kinek a feladata?" választóhoz.
export async function listTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data: members } = await supabase.from("profiles").select("id, full_name").order("created_at");
  if (!members?.length) return [];

  const emailById = new Map<string, string>();
  if (members.some((m) => !m.full_name)) {
    const { data: usersPage } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
    for (const user of usersPage?.users ?? []) emailById.set(user.id, user.email ?? "");
  }
  return members.map((m) => ({ id: m.id, name: m.full_name || emailById.get(m.id) || "Ismeretlen" }));
}
