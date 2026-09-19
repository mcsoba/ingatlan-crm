"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  User,
  Building2,
  Kanban,
  Loader2,
  Plus,
  Inbox,
  ListChecks,
  BarChart3,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { globalSearch, type SearchResult } from "./search-actions";

type PaletteAction = { label: string; href: string; icon: LucideIcon; keywords: string };

const ACTIONS: PaletteAction[] = [
  { label: "Új kontakt", href: "/dashboard/contacts/new", icon: Plus, keywords: "uj kontakt hozzaadas letrehoz create contact" },
  { label: "Új ingatlan", href: "/dashboard/properties/new", icon: Plus, keywords: "uj ingatlan hozzaadas letrehoz create property" },
  { label: "Új deal", href: "/dashboard/pipeline/new", icon: Plus, keywords: "uj deal uzlet hozzaadas letrehoz create" },
  { label: "Lead-postaláda", href: "/dashboard/leads", icon: Inbox, keywords: "lead postalada uj erdeklodo inbox" },
  { label: "Pipeline", href: "/dashboard/pipeline", icon: Kanban, keywords: "pipeline deal tabla kanban" },
  { label: "Teendők", href: "/dashboard/tasks", icon: ListChecks, keywords: "teendo feladat task" },
  { label: "Naptár", href: "/dashboard/calendar", icon: CalendarDays, keywords: "naptar calendar" },
  { label: "Riportok", href: "/dashboard/reports", icon: BarChart3, keywords: "riport jelentes statisztika report" },
];

// Accent-insensitive so "uj" finds "Új" and "postalada" finds "postaláda".
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const TYPE_ICONS = {
  contact: User,
  property: Building2,
  deal: Kanban,
} as const;

const TYPE_LABELS = {
  contact: "Kontakt",
  property: "Ingatlan",
  deal: "Deal",
} as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSearching, startSearching] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closePalette() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) {
            setQuery("");
            setResults([]);
          }
          return !prev;
        });
      } else if (e.key === "Escape") {
        closePalette();
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;

    debounceRef.current = setTimeout(() => {
      startSearching(async () => {
        const found = await globalSearch(query);
        setResults(found);
      });
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function goTo(href: string) {
    closePalette();
    router.push(href);
  }

  if (!open) return null;

  const visibleResults = query.trim() ? results : [];
  const foldedQuery = fold(query.trim());
  const visibleActions = ACTIONS.filter(
    (a) => !foldedQuery || fold(`${a.label} ${a.keywords}`).includes(foldedQuery),
  );
  const items = [
    ...visibleActions.map((a) => ({
      key: `action-${a.href}`,
      href: a.href,
      title: a.label,
      subtitle: null as string | null,
      tag: "Művelet",
      Icon: a.icon,
    })),
    ...visibleResults.map((r) => ({
      key: `${r.type}-${r.id}`,
      href: r.href,
      title: r.title,
      subtitle: r.subtitle,
      tag: TYPE_LABELS[r.type],
      Icon: TYPE_ICONS[r.type],
    })),
  ];
  const safeIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((safeIndex + 1) % Math.max(items.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((safeIndex - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter" && items[safeIndex]) {
      e.preventDefault();
      goTo(items[safeIndex].href);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={closePalette}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Keresés vagy művelet…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-subtle"
          />
          {isSearching && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-subtle" />
          )}
        </div>

        {items.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-1.5">
            {items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => goTo(item.href)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                  index === safeIndex ? "bg-background" : ""
                }`}
              >
                <item.Icon className="h-4 w-4 shrink-0 text-muted-subtle" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{item.title}</div>
                  {item.subtitle && (
                    <div className="truncate text-xs text-muted">{item.subtitle}</div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-subtle">{item.tag}</span>
              </button>
            ))}
          </div>
        )}

        {query.trim() && !isSearching && items.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted">
            Nincs találat.
          </div>
        )}

        <div className="border-t border-border-subtle px-4 py-2 text-xs text-muted-subtle">
          <kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd> választás ·{" "}
          <kbd className="rounded border border-border px-1 py-0.5">Enter</kbd> megnyitás ·{" "}
          <kbd className="rounded border border-border px-1 py-0.5">Esc</kbd> bezárás
        </div>
      </div>
    </div>
  );
}
