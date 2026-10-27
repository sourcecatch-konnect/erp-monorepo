import * as React from "react";
import { IconCircleArrowRight } from "@tabler/icons-react";

import { cn } from "../lib/util";

/**
 * Tells the user what to do next on a document, based on where it is now
 * ("Order confirmed. Next: create the LRs."). At most one per screen.
 */
function NextStep({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      data-slot="next-step"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <IconCircleArrowRight className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {children ? (
            <p className="text-sm text-muted-foreground">{children}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { NextStep };
