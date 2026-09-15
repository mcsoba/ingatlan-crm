import { HelpCircle } from "lucide-react";

export function HelpTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <HelpCircle
        tabIndex={0}
        className="h-3.5 w-3.5 shrink-0 cursor-help text-muted-subtle outline-none"
        strokeWidth={1.75}
      />
      <span className="pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-border bg-surface p-2 text-xs leading-snug font-normal text-muted opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  );
}
