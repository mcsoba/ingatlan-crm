"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Sun, Moon, MonitorCog, type LucideIcon } from "lucide-react";

type Theme = "light" | "dark" | "system";

const ORDER: Theme[] = ["system", "light", "dark"];
const ICONS: Record<Theme, LucideIcon> = { system: MonitorCog, light: Sun, dark: Moon };
const LABELS: Record<Theme, string> = { system: "Rendszer", light: "Világos", dark: "Sötét" };
const THEME_EVENT = "ingatlan-crm-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function getSnapshot(): Theme {
  const stored = localStorage.getItem("theme");
  return stored === "dark" || stored === "light" ? stored : "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const cycle = useCallback(() => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    if (next === "system") {
      localStorage.removeItem("theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, [theme]);

  const Icon = ICONS[theme];

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Téma: ${LABELS[theme]} (kattints a váltáshoz)`}
      className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
