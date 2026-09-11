import Link from "next/link";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await ensureCurrentUserProfile();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold">{profile.agencies.name}</span>
          <nav className="flex gap-4 text-sm text-neutral-600">
            <Link href="/dashboard" className="hover:text-neutral-900">
              Áttekintés
            </Link>
            <Link href="/dashboard/contacts" className="hover:text-neutral-900">
              Kontaktok
            </Link>
            <Link href="/dashboard/properties" className="hover:text-neutral-900">
              Ingatlanok
            </Link>
            <Link href="/dashboard/pipeline" className="hover:text-neutral-900">
              Pipeline
            </Link>
          </nav>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
