"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Columns3 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const OPTIONAL_COLUMNS = [
  { key: "email", label: "Elérhetőség" },
  { key: "tags", label: "Címkék" },
  { key: "source", label: "Forrás" },
  { key: "owner", label: "Ügynök" },
  { key: "status", label: "Státusz" },
  { key: "score", label: "Pontszám" },
  { key: "created", label: "Létrehozva" },
  { key: "lastActivity", label: "Utolsó aktivitás" },
] as const;

export type ColumnKey = (typeof OPTIONAL_COLUMNS)[number]["key"];

const DEFAULT_VISIBLE: ColumnKey[] = ["email", "tags", "source", "owner", "status", "score"];
const STORAGE_KEY = "ingatlan-crm-contacts-columns";
const COLUMNS_EVENT = "ingatlan-crm-contacts-columns-change";

function subscribe(callback: () => void) {
  window.addEventListener(COLUMNS_EVENT, callback);
  return () => window.removeEventListener(COLUMNS_EVENT, callback);
}

// useSyncExternalStore needs a snapshot that's reference-stable when nothing
// changed -- returning the raw JSON string (a primitive) does that for free;
// parsing into an array happens separately in useMemo, keyed off that string.
function getSnapshot(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

function parseVisible(raw: string | null): ColumnKey[] {
  if (!raw) return DEFAULT_VISIBLE;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE;
    const valid = OPTIONAL_COLUMNS.map((c) => c.key).filter((k) => parsed.includes(k));
    return valid;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

export function useVisibleColumns(): Set<ColumnKey> {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => new Set(parseVisible(raw)), [raw]);
}

function setVisible(keys: ColumnKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  window.dispatchEvent(new Event(COLUMNS_EVENT));
}

export function ColumnPicker() {
  const visible = useVisibleColumns();

  function toggle(key: ColumnKey) {
    const next = new Set(visible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setVisible(OPTIONAL_COLUMNS.map((c) => c.key).filter((k) => next.has(k)));
  }

  return (
    <details className="relative">
      <summary className={`${buttonVariants("secondary")} list-none [&::-webkit-details-marker]:hidden`}>
        <Columns3 className="h-4 w-4" strokeWidth={1.75} />
        Oszlopok
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-surface p-2 shadow-lg">
        <p className="px-2 py-1 text-xs font-medium text-muted-subtle">
          Megjelenő oszlopok
        </p>
        {OPTIONAL_COLUMNS.map((c) => (
          <label
            key={c.key}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-background"
          >
            <input
              type="checkbox"
              checked={visible.has(c.key)}
              onChange={() => toggle(c.key)}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            {c.label}
          </label>
        ))}
      </div>
    </details>
  );
}
