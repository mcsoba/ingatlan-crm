import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

export default async function DashboardPage() {
  const { user, profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const [{ count: contactCount }, { count: propertyCount }, { count: dealCount }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true }),
    ]);

  return (
    <div>
      <p className="text-neutral-600">
        Bejelentkezve mint {user.email} · szerep: {profile.role} · csomag:{" "}
        {profile.agencies.plan_tier}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Link
          href="/dashboard/contacts"
          className="rounded border border-neutral-200 p-6 hover:bg-neutral-50"
        >
          <div className="text-3xl font-semibold">{contactCount ?? 0}</div>
          <div className="text-neutral-600">Kontakt</div>
        </Link>

        <Link
          href="/dashboard/properties"
          className="rounded border border-neutral-200 p-6 hover:bg-neutral-50"
        >
          <div className="text-3xl font-semibold">{propertyCount ?? 0}</div>
          <div className="text-neutral-600">Ingatlan</div>
        </Link>

        <Link
          href="/dashboard/pipeline"
          className="rounded border border-neutral-200 p-6 hover:bg-neutral-50"
        >
          <div className="text-3xl font-semibold">{dealCount ?? 0}</div>
          <div className="text-neutral-600">Deal</div>
        </Link>
      </div>
    </div>
  );
}
