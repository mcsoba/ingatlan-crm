"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, User, Building2, Kanban, Loader2 } from "lucide-react";
import { globalSearch, type SearchResult } from "./search-actions";

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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés kontaktok, ingatlanok, dealek között…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-subtle"
          />
          {isSearching && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-subtle" />
          )}
        </div>

        {visibleResults.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-1.5">
            {visibleResults.map((result) => {
              const Icon = TYPE_ICONS[result.type];
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => goTo(result.href)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-background"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-subtle" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">{result.title}</div>
                    {result.subtitle && (
                      <div className="truncate text-xs text-muted">
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-subtle">
                    {TYPE_LABELS[result.type]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {query.trim() && !isSearching && visibleResults.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted">
            Nincs találat.
          </div>
        )}

        {!query.trim() && (
          <div className="px-4 py-3 text-xs text-muted-subtle">
            Írj a kereséshez, vagy nyomj{" "}
            <kbd className="rounded border border-border px-1 py-0.5">Esc</kbd>-t
            a bezáráshoz.
          </div>
        )}
      </div>
    </div>
  );
}
