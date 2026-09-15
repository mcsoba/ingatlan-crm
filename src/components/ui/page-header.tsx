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
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight text-foreground">
          {title}
          {helpText && <HelpTooltip text={helpText} />}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
