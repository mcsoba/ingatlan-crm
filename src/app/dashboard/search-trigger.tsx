"use client";

import { Search } from "lucide-react";

export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      className="mb-4 flex w-full items-center justify-between gap-2 rounded-lg border border-sidebar-active bg-sidebar-active/40 px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-active"
    >
      <span className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
        Keresés
      </span>
      <kbd className="rounded border border-sidebar-muted/30 px-1 text-[10px]">
        ⌘K
      </kbd>
    </button>
  );
}
