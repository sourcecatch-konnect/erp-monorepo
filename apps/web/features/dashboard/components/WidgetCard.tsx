"use client";

import * as React from "react";
import Link from "next/link";
import { IconArrowUpRight, type Icon } from "@tabler/icons-react";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@/lib/utils";

/**
 * The one card shell every widget uses, so the grid has a single rhythm:
 * bordered surface, a header with a quiet icon and title, a hairline, then the
 * body. No shadows — the page background sits below white, so a 1px border is
 * all the elevation a card needs (design.md §6).
 */
export function WidgetCard({
  title,
  icon: IconCmp,
  meta,
  href,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon: Icon;
  /** Period or total, printed right of the title. */
  meta?: React.ReactNode;
  /** Where the card's full list lives. Adds a hover-only drill-in arrow. */
  href?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3.5 py-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <IconCmp className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{title}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {meta ? (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {meta}
            </span>
          ) : null}
          {href ? (
            <Link
              href={href}
              aria-label={`Open ${title}`}
              // Dimmed-but-visible by default so the drill-in is discoverable
              // without a pointer; hover and focus bring it up on desktop.
              className="text-muted-foreground opacity-60 transition-opacity duration-150 hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <IconArrowUpRight className="size-4" />
            </Link>
          ) : null}
        </div>
      </header>
      <div className={cn("min-h-0 flex-1 p-3.5", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

/**
 * Placeholder with the same span as the real card, so the mosaic never
 * reflows when the data lands.
 */
export function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      className={cn(
        "flex min-w-0 flex-col rounded-lg border bg-card",
        className,
      )}
    >
      <div className="border-b px-3.5 py-2">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="flex-1 space-y-2 p-3.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

/**
 * Whole-page states. The grid is all a viewer gets on this page, so a failed
 * request or a scope with nothing in it has to say so — otherwise the page
 * sits on skeletons or renders empty (design.md: never a silent dead end).
 */
export function WidgetPanel({
  icon: IconCmp,
  title,
  children,
  action,
}: {
  icon: Icon;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-lg border bg-card px-6 py-12 text-center">
      <IconCmp className="size-6 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{children}</p>
      {action ? <div className="mt-2 flex gap-2">{action}</div> : null}
    </section>
  );
}

/** Shown inside a card when its rule found nothing — never a bare zero. */
export function WidgetEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * The delta badge. `goodWhen` matters: on cost or outstanding, a rise is bad,
 * so the colour follows the meaning rather than the sign.
 */
export function DeltaChip({
  label,
  pct,
  goodWhen = "up",
  title,
}: {
  label: string;
  pct: number;
  goodWhen?: "up" | "down";
  title?: string;
}) {
  const good = goodWhen === "up" ? pct >= 0 : pct <= 0;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 text-xs font-medium tabular-nums",
        good
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive",
      )}
    >
      {label}
    </span>
  );
}
