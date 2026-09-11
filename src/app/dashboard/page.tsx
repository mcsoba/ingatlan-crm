import { ensureCurrentUserProfile } from "@/lib/agency";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const { user, profile } = await ensureCurrentUserProfile();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{profile.agencies.name}</h1>
        <SignOutButton />
      </div>

      <p className="mt-2 text-neutral-600">
        Bejelentkezve mint {user.email} · szerep: {profile.role} · csomag:{" "}
        {profile.agencies.plan_tier}
      </p>

      <div className="mt-8 rounded border border-dashed border-neutral-300 p-6 text-neutral-500">
        Kontaktok, ingatlanok és a pipeline board a következő fejlesztési
        szeletekben kerül ide.
      </div>
    </main>
  );
}
