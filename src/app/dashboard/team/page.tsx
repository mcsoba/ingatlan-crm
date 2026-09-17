import { UserRound, Crown, ShieldCheck, Phone } from "lucide-react";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inviteTeamMember,
  removeTeamMember,
  updateMyPhone,
  updateTeamMemberRole,
} from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

const ROLE_LABELS: Record<string, string> = {
  owner: "Tulajdonos",
  admin: "Admin",
  agent: "Ügynök",
};

export default async function TeamPage() {
  const { profile } = await ensureCurrentUserProfile();
  const canManageTeam = profile.role === "owner" || profile.role === "admin";
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone")
    .order("created_at");

  if (error) throw error;

  const emailById = new Map<string, string>();
  if (canManageTeam && members && members.length > 0) {
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
      <PageHeader title="Csapat" description="Az iroda tagjai és szerepkörük." />

      <div className="mt-6 flex flex-col gap-2">
        {(members ?? []).map((member) => (
          <Card key={member.id} className="flex items-center gap-3 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
              {member.role === "owner" ? (
                <Crown className="h-4 w-4" strokeWidth={1.75} />
              ) : member.role === "admin" ? (
                <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <UserRound className="h-4 w-4" strokeWidth={1.75} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {member.full_name || emailById.get(member.id) || "—"}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Badge variant={member.role === "owner" ? "accent" : "neutral"}>
                  {ROLE_LABELS[member.role] ?? member.role}
                </Badge>
                {emailById.get(member.id) && (
                  <span className="truncate">{emailById.get(member.id)}</span>
                )}
                {member.id !== profile.id && member.phone && (
                  <span className="truncate">· {member.phone}</span>
                )}
              </div>
              {member.id === profile.id && (
                <form action={updateMyPhone} className="mt-1.5 flex items-center gap-1.5">
                  <Phone className="h-3 w-3 shrink-0 text-muted-subtle" />
                  <input
                    name="phone"
                    defaultValue={member.phone ?? ""}
                    placeholder="+36301234567 (SMS-értesítésekhez)"
                    className={`${inputClass} flex-1 py-1 text-xs`}
                  />
                  <button
                    type="submit"
                    className="shrink-0 text-xs text-muted hover:text-accent"
                  >
                    Mentés
                  </button>
                </form>
              )}
              {profile.role === "owner" && member.role !== "owner" && (
                <form action={updateTeamMemberRole} className="mt-1.5">
                  <input type="hidden" name="id" value={member.id} />
                  <input
                    type="hidden"
                    name="role"
                    value={member.role === "admin" ? "agent" : "admin"}
                  />
                  <button
                    type="submit"
                    className="text-xs text-muted hover:text-accent"
                  >
                    {member.role === "admin" ? "Admin jog visszavonása" : "Admin-ná tétel"}
                  </button>
                </form>
              )}
            </div>
            {((profile.role === "owner" && member.id !== profile.id) ||
              (profile.role === "admin" && member.role === "agent")) && (
              <form action={removeTeamMember}>
                <input type="hidden" name="id" value={member.id} />
                <button
                  type="submit"
                  className="text-xs text-muted hover:text-danger"
                >
                  Eltávolítás
                </button>
              </form>
            )}
          </Card>
        ))}
      </div>

      {canManageTeam ? (
        <form
          action={inviteTeamMember}
          className="mt-6 flex gap-2 border-t border-border-subtle pt-4"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="kollega@email.hu"
            className={`${inputClass} flex-1`}
          />
          <Button type="submit">Meghívás</Button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Csak az iroda tulajdonosa vagy admin tagja hívhat meg új csapattagot.
        </p>
      )}
    </div>
  );
}
