import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold">Ingatlan CRM</h1>
      <p className="text-neutral-600">
        AI-alapú CRM ingatlanos ügynököknek és irodáknak.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded bg-neutral-900 px-4 py-2 text-white"
        >
          Regisztráció
        </Link>
        <Link
          href="/login"
          className="rounded border border-neutral-300 px-4 py-2"
        >
          Bejelentkezés
        </Link>
      </div>
    </main>
  );
}
