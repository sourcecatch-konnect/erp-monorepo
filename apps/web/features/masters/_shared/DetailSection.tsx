import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bordered card used to give a detail page's content real sections
 * (header info, line items, linked documents, receiving history, ...)
 * instead of one flat column. Mirrors the "border-b bg-muted/30 title bar"
 * pattern already used ad hoc for line-item tables across the workshop
 * detail pages — this just makes it a single reusable shell so every
 * section (grid or table) looks the same.
 */
export function DetailSection({
  title,
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("rounded-md border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
        <span className="text-sm font-semibold">{title}</span>
        {action}
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
