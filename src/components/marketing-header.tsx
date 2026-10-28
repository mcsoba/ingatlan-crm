import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { BRAND } from "@/lib/brand";
import { buttonVariants } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2">
        <BrandMark />
        <span className="text-sm font-semibold text-foreground">
          {BRAND.name}
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
