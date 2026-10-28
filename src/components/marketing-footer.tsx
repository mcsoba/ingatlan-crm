import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-6 py-8 text-xs text-muted-subtle sm:flex-row sm:justify-between">
        <span>&copy; {new Date().getFullYear()} {BRAND.name}</span>
        <nav className="flex items-center gap-4">
          <Link href="/pricing" className="hover:text-foreground">
            Árazás
          </Link>
          <Link href="/legal/terms" className="hover:text-foreground">
            ÁSZF
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground">
            Adatvédelem
          </Link>
        </nav>
      </div>
    </footer>
  );
}
