"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Kanban, ListChecks, Plus, UserPlus } from "lucide-react";

// "+ Új" gomb az oldalsávban: bárhonnan egy kattintással felvehető kontakt,
// ingatlan, üzlet vagy teendő — nem kell előbb a megfelelő oldalra navigálni.
const ITEMS = [
  { href: "/dashboard/contacts/new", label: "Új kontakt", hint: "érdeklődő, vevő, eladó", icon: UserPlus },
  { href: "/dashboard/properties/new", label: "Új ingatlan", hint: "eladó vagy kiadó", icon: Building2 },
  { href: "/dashboard/pipeline/new", label: "Új üzlet", hint: "egy kontakt vételi/bérlési ügye", icon: Kanban },
  { href: "/dashboard/tasks", label: "Új teendő", hint: "hívás, megtekintés, emlékeztető", icon: ListChecks },
];

export function QuickCreate() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Navigáció után és kívülre kattintva bezárul
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        Új felvétele
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          {ITEMS.map(({ href, label, hint, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-accent-soft ${
                pathname === href ? "bg-accent-soft" : ""
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
              <span>
                <span className="block font-medium text-foreground">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
