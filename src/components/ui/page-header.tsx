import { ReactNode } from "react";
import { HelpTooltip } from "./help-tooltip";

export function PageHeader({
  title,
  description,
  action,
  helpText,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  helpText?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight text-foreground">
          {title}
          {helpText && <HelpTooltip text={helpText} />}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
