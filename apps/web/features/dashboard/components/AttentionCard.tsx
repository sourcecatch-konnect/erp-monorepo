"use client";

import Link from "next/link";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import type {
  DashboardAttentionRow,
  DashboardAttentionSeverity,
} from "@skerp/types";
import { cn } from "@/lib/utils";
import { WidgetCard } from "./WidgetCard";
import { ATTENTION_ROUTES } from "../routes";

/**
 * Exceptions — the things nobody has a queue for: freight sitting in transit
 * too long, delivered work never billed, a customer past its credit limit.
 * Severity is carried by a pip as well as by colour, so it survives a
 * colour-blind reader (design.md §9).
 */
const PIP: Record<DashboardAttentionSeverity, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-primary",
};

export function AttentionCard({
  rows,
  className,
}: {
  rows: DashboardAttentionRow[];
  className?: string;
}) {
  return (
    <WidgetCard
      title="Needs attention"
      icon={IconAlertTriangle}
      meta={
        rows.length > 0 ? (
          <span className="rounded-sm bg-destructive/10 px-1.5 font-medium tabular-nums text-destructive">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </span>
        ) : undefined
      }
      className={className}
      bodyClassName={rows.length === 0 ? "" : "flex flex-col py-1"}
    >
      {rows.length === 0 ? (
        <p className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
          <IconCircleCheck className="size-5 text-success" aria-hidden="true" />
          Nothing is slipping — every rule is clear.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rows.map((row, i) => (
            <li key={row.key}>
              <Link
                href={ATTENTION_ROUTES[row.key]}
                className={cn(
                  "flex items-center gap-2.5 rounded-sm px-1 py-2 transition-colors duration-150 hover:bg-muted/50",
                  i > 0 && "border-t",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    PIP[row.severity],
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">
                    {row.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.detail}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {row.value}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
