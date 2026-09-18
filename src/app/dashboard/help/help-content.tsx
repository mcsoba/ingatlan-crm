"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass, sectionLabelClass } from "@/components/ui/styles";
import { FAQ_SECTIONS } from "./faq-data";

export function HelpContent() {
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_SECTIONS;

    return FAQ_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q),
      ),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés a súgóban…"
          className={`${inputClass} w-full pl-9`}
        />
      </div>

      {filteredSections.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nincs találat"
          description="Próbálj más kulcsszót."
        />
      ) : (
        filteredSections.map((section) => (
          <div key={section.category} className="flex flex-col gap-2">
            <div className={sectionLabelClass}>{section.category}</div>
            <Card className="divide-y divide-border">
              {section.items.map((item) => (
                <details key={item.question} className="group p-3.5">
                  <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-none">
                    <span className="flex items-center justify-between gap-2">
                      {item.question}
                      <span className="shrink-0 text-muted-subtle transition-transform group-open:rotate-180">
                        ⌄
                      </span>
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-muted">{item.answer}</p>
                </details>
              ))}
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
