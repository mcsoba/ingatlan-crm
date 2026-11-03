import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Az iroda cégei (pl. Bluegate, Interprop, Workerbase) — a webbel egyezően a
// finance_companies táblából. Ha nincs egy sem, a cég-mezők sehol nem jelennek meg.
export type Company = { id: string; name: string; color: string };

const FALLBACK_COLORS = ["#2e6ff2", "#d9a54e", "#16a34a", "#db2777", "#7c3aed", "#0891b2"];
const STORAGE_KEY = "crm_company";

let cache: Company[] | null = null;

export function useCompanies(): Company[] {
  const [companies, setCompanies] = useState<Company[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    supabase
      .from("finance_companies")
      .select("id, name, color")
      .order("sort_order")
      .order("name")
      .then(({ data, error }) => {
        if (error) return;
        cache = (data ?? []).map((row, i) => ({
          id: row.id as string,
          name: row.name as string,
          color: (row.color as string | null) || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        }));
        setCompanies(cache);
      });
  }, []);
  return companies;
}

/** Kijelentkezéskor (másik iroda is beléphet ugyanazon a telefonon). */
export function resetCompanies() {
  cache = null;
  setSelectedCompany(null);
}

// ---- kiválasztott cég (Kontaktok és Üzletek szűrője), az app újraindítása után is megmarad ----

function readStored(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

let selected: string | null = readStored();
const listeners = new Set<(id: string | null) => void>();

export function setSelectedCompany(id: string | null) {
  selected = id;
  try {
    if (id) globalThis.localStorage?.setItem(STORAGE_KEY, id);
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // tárhely nem elérhető — csak a munkamenet idejére marad meg
  }
  listeners.forEach((l) => l(id));
}

/** A kiválasztott cég azonosítója; egy már nem létező cég „összes cégnek” számít. */
export function useSelectedCompany(): string | null {
  const companies = useCompanies();
  const [id, setId] = useState(selected);
  useEffect(() => {
    listeners.add(setId);
    return () => {
      listeners.delete(setId);
    };
  }, []);
  if (!id) return null;
  return companies.length === 0 || companies.some((c) => c.id === id) ? id : null;
}

export function pickCompanies(companies: Company[], ids: (string | null | undefined)[] | null | undefined): Company[] {
  const set = new Set((ids ?? []).filter(Boolean));
  return companies.filter((c) => set.has(c.id));
}
