import { ensureCurrentUserProfile } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteTeamMember, removeTeamMember } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  owner: "Tulajdonos",
  agent: "Ügynök",
};

export default async function TeamPage() {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .order("created_at");

  if (error) throw error;

  const emailById = new Map<string, string>();
  if (profile.role === "owner" && members && members.length > 0) {
    const admin = createAdminClient();
    const { data: usersPage } = await admin.auth.admin.listUsers({
      perPage: 200,
    });
    const memberIds = new Set(members.map((m) => m.id));
    for (const user of usersPage?.users ?? []) {
      if (memberIds.has(user.id)) emailById.set(user.id, user.email ?? "");
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold">Csapat</h1>

      <div className="mt-6 flex flex-col gap-2">
        {(members ?? []).map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded border border-neutral-200 p-2 text-sm"
          >
            <div>
              <div className="font-medium">
                {member.full_name || emailById.get(member.id) || "—"}
              </div>
              <div className="text-neutral-500">
                {ROLE_LABELS[member.role] ?? member.role}
                {emailById.get(member.id) && ` · ${emailById.get(member.id)}`}
              </div>
            </div>
            {profile.role === "owner" && member.id !== profile.id && (
              <form action={removeTeamMember}>
                <input type="hidden" name="id" value={member.id} />
                <button
                  type="submit"
                  className="text-xs text-red-600 hover:underline"
                >
                  Eltávolítás
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {profile.role === "owner" ? (
        <form
          action={inviteTeamMember}
          className="mt-6 flex gap-2 border-t border-neutral-200 pt-4"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="kollega@email.hu"
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
          >
            Meghívás
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-neutral-500">
          Csak az iroda tulajdonosa hívhat meg új csapattagot.
        </p>
      )}
    </div>
  );
}
