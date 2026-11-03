import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { FinanceNav } from "./finance-nav";

// A pénzügyek csak az irodavezetőknek (owner/admin) látszanak — az RLS is ezt érvényesíti.
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await ensureCurrentUserProfile();
  if (profile.role !== "owner" && profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: companies, error } = await supabase
    .from("finance_companies")
    .select("id, name, color")
    .order("sort_order")
    .order("name");

  if (error) {
    return (
      <Card className="p-4 text-sm text-muted">
        A pénzügyi modul adatbázis-frissítése (0042_finance.sql) még nem futott le — utána ez az oldal azonnal használható.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Suspense>
        <FinanceNav companies={companies ?? []} />
      </Suspense>
      {children}
    </div>
  );
}
