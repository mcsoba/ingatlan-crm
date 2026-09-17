"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

export function MobileNavShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the mobile sidebar whenever the route changes, without an
  // extra effect round-trip — this is React's documented pattern for
  // resetting state when a prop-like value changes between renders.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 md:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menü megnyitása"
          className="text-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden print:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col justify-between bg-sidebar px-3 py-4 transition-transform duration-200 md:static md:translate-x-0 print:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      <div className="min-w-0 flex-1 bg-background print:w-full">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10 print:max-w-full print:p-0">
          {children}
        </div>
      </div>
    </div>
  );
}
