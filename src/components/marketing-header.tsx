import Link from "next/link";
import { Building2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
          <Building2 className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <span className="text-sm font-semibold text-foreground">
          Ingatlan CRM
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <Link href="/pricing" className={buttonVariants("ghost", "sm")}>
          Árazás
        </Link>
        <Link href="/login" className={buttonVariants("ghost", "sm")}>
          Bejelentkezés
        </Link>
        <Link href="/signup" className={buttonVariants("primary", "sm")}>
          Regisztráció
        </Link>
      </div>
    </header>
  );
}
