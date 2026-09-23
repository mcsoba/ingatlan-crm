"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
};

type ToastItem = ToastInput & { id: string };

type PendingToast = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  undo?: { table: string; id: string; label?: string };
};

const STORAGE_KEY = "crm-pending-toast";

/** Queue a toast to show after a client-side navigation (e.g. right before
 * a server action redirects away from the current page). `undo` is data,
 * not a closure, because it has to survive a sessionStorage round-trip —
 * ToastProvider reconstructs the restoreRecord() call on the other side. */
export function queueToast(toast: PendingToast) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toast));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — the toast is
    // skipped, not worth failing the action over.
  }
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-accent",
};

const variantIcons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pathname = usePathname();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...toast, id }]);
      const timer = setTimeout(() => dismiss(id), toast.action ? 7000 : 4000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  // Picks up a toast queued (via queueToast) just before a redirect on the
  // previous page — runs on every pathname change, since this provider
  // lives in the dashboard layout and doesn't remount on in-segment
  // navigation.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const pending: PendingToast = JSON.parse(raw);
      // Syncing React state from an external store (sessionStorage) read on
      // navigation is exactly what this effect is for, not a derivable value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      push({
        title: pending.title,
        description: pending.description,
        variant: pending.variant,
        action: pending.undo
          ? {
              label: pending.undo.label ?? "Visszavonás",
              onClick: () => {
                startTransition(async () => {
                  const { restoreRecord } = await import(
                    "@/app/dashboard/trash/actions"
                  );
                  restoreRecord(pending.undo!.table, pending.undo!.id);
                });
              },
            }
          : undefined,
      });
    } catch {
      // malformed payload — ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-100 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6">
        {toasts.map((t) => {
          const variant = t.variant ?? "info";
          const Icon = variantIcons[variant];
          return (
            <div
              key={t.id}
              role="status"
              className="animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-lg"
            >
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${variantStyles[variant]}`}
                strokeWidth={1.75}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-muted">{t.description}</p>
                )}
              </div>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="shrink-0 text-xs font-medium text-accent hover:text-accent-hover"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Bezárás"
                className="shrink-0 text-muted-subtle hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
