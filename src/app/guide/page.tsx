import type { Metadata } from "next";
import { GuideContent } from "../dashboard/guide/guide-content";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Használati útmutató · ${BRAND.name}` };

// Belépés nélkül is olvasható (nincs benne ügyféladat) — a mobilapp
// „Használati útmutató” linkje ezt nyitja meg a telefon böngészőjében.
export default function PublicGuidePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <GuideContent />
      </div>
    </main>
  );
}
