// Shared className strings for raw form elements — kept as plain strings
// (rather than wrapper components) so existing <input name="..."> server
// action forms don't need restructuring, just a consistent look.

export const inputClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-subtle transition-shadow";

export const labelClass = "text-sm font-medium text-foreground";

export const fieldGroupClass = "flex flex-col gap-1.5";

export const sectionLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-muted";

export const linkClass = "text-accent hover:text-accent-hover hover:underline";
