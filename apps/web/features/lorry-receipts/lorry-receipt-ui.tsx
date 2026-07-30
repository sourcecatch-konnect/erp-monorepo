import * as React from "react";
import type { LRStatus, LRSource } from "@skerp/types";
import {
  IconBan,
  IconCircleCheck,
  IconFileCheck,
  IconList,
  IconPencil,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import type { StatusTabDef } from "@/components/data-table";

const STATUS_LABELS: Record<LRStatus, string> = {
  DRAFT: "Draft",
  FINALISED: "Finalised",
  DELIVERED: "Delivered",
  ACKNOWLEDGED: "POD received",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<LRStatus, string> = {
  DRAFT: "border-warning/40 bg-warning/15 text-warning-foreground",
  FINALISED: "border-primary/30 bg-primary/10 text-primary",
  DELIVERED: "border-success/35 bg-success/10 text-success",
  ACKNOWLEDGED: "border-success/50 bg-success/15 text-success",
  CANCELLED: "border-border bg-muted text-muted-foreground",
};

const isLRStatus = (
  status: string | null | undefined,
): status is LRStatus =>
  typeof status === "string" &&
  Object.prototype.hasOwnProperty.call(STATUS_LABELS, status);

export function LRStatusBadge({
  status,
}: {
  status?: string | null;
}) {
  if (!isLRStatus(status)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
          "border-border bg-muted text-sm font-semibold text-muted-foreground",
        )}
      >
        <span className="size-2 rounded-full bg-current opacity-60" />
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
        "text-sm font-semibold",
        STATUS_STYLES[status],
      )}
    >
      <span className="size-2 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}
export const SOURCE_LABELS: Record<LRSource, string> = {
  FROM_ORDER: "From Order",
  INSTANT: "Instant",
};

/**
 * Compact origin → destination flow: hollow start dot, dashed leg, filled
 * primary end dot — the inline sibling of trip-detail's branch-flow bar.
 */
export function RouteInline({
  from,
  to,
  className,
}: {
  from?: string | null;
  to?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="size-1.5 shrink-0 rounded-full border-[1.5px] border-muted-foreground" />
      <span className="truncate text-muted-foreground">{from ?? "—"}</span>
      <span className="w-4 min-w-3 shrink-0 border-t border-dashed border-muted-foreground/60" />
      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
      <span className="truncate font-medium text-foreground">{to ?? "—"}</span>
    </span>
  );
}

export const LR_STATUS_ORDER: StatusTabDef[] = [
  { key: "ALL", label: "All", icon: IconList },
  { key: "DRAFT", label: "Draft", icon: IconPencil },
  { key: "FINALISED", label: "Finalised", icon: IconCircleCheck },
  { key: "DELIVERED", label: "Delivered", icon: IconTruckDelivery },
  { key: "ACKNOWLEDGED", label: "POD received", icon: IconFileCheck },
  { key: "CANCELLED", label: "Cancelled", icon: IconBan },
];

/** Whole days elapsed since an ISO timestamp — worklist aging columns. */
export function daysSince(iso: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000),
  );
}

/* ------------------------------------------------------------------ */
/* LR-first display identity                                           */
/* ------------------------------------------------------------------ */

/**
 * The LR is the user-facing document; the group is the operational container
 * (one truckload — usually of exactly one LR). Every surface that names a
 * group must go through this helper so singleton groups present as their LR
 * and multi-LR groups present as the truckload.
 */
export type LRGroupLike = {
  groupNumber: string;
  status?: LRStatus | null;
  lorryReceipts?:
  | readonly { lrNumber: string; status?: LRStatus | null }[]
  | null;
};

export type LRGroupDisplay = {
  /** Primary user-facing identifier: the LR number for a single-LR group. */
  title: string;
  /** Quiet reference line: the group number for singletons, LR count otherwise. */
  subtitle: string;
  isSingleton: boolean;
  /** Live (non-cancelled) LR numbers, in creation order. */
  lrNumbers: string[];
  lrCount: number;
  /** Status to badge: the LR's own status for singletons, else the group's. */
  status: LRStatus | null;
};

export function lrGroupDisplay(g: LRGroupLike): LRGroupDisplay {
  const all = g.lorryReceipts ?? [];
  // A cancelled LR no longer counts toward the truckload — unless the whole
  // group is cancelled, where the original composition is what identifies it.
  const cancelled = g.status === "CANCELLED";
  const live = cancelled ? all : all.filter((lr) => lr.status !== "CANCELLED");
  const lrs = live.length > 0 ? live : all;

  if (lrs.length === 1) {
    const lr = lrs[0]!;
    return {
      title: lr.lrNumber,
      subtitle: `Group ${g.groupNumber}`,
      isSingleton: true,
      lrNumbers: [lr.lrNumber],
      lrCount: 1,
      status: lr.status ?? g.status ?? null,
    };
  }
  return {
    title: g.groupNumber,
    subtitle: lrs.length === 0 ? "No LRs yet" : `${lrs.length} LRs`,
    isSingleton: false,
    lrNumbers: lrs.map((lr) => lr.lrNumber),
    lrCount: lrs.length,
    status: g.status ?? null,
  };
}
