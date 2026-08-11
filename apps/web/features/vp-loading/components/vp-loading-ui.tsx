import * as React from "react";

import { cn } from "@/lib/utils";

export type VPScheduleLoadingStatus =
  | "MRRR_CREATED"
  | "LOADING"
  | "LOADED"
  | "VERIFIED";

const STATUS_LABELS: Record<VPScheduleLoadingStatus, string> = {
  MRRR_CREATED: "Ready for loading",
  LOADING: "Loading",
  LOADED: "Loaded",
  VERIFIED: "Verified",
};

const STATUS_STYLES: Record<VPScheduleLoadingStatus, string> = {
  MRRR_CREATED:
    "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",

  LOADING:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",

  LOADED:
    "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",

  VERIFIED:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export function VPLoadingStatusBadge({
  status,
  className,
}: {
  status: VPScheduleLoadingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1",
        "text-xs font-semibold shadow-sm",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />

      {STATUS_LABELS[status]}
    </span>
  );
}

export const VP_LOADING_STATUS_ORDER: {
  key: "ALL" | VPScheduleLoadingStatus;
  label: string;
}[] = [
    { key: "ALL", label: "All" },
    { key: "MRRR_CREATED", label: "Ready for loading" },
    { key: "LOADING", label: "Loading" },
    { key: "LOADED", label: "Loaded" },
    { key: "VERIFIED", label: "Verified" },
  ];

export type VPWagonLoadingStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "VERIFIED"
  | "CANCELLED";

const STATUS_CONFIG: Record<
  VPWagonLoadingStatus,
  {
    label: string;
    className: string;
  }
> = {
  DRAFT: {
    label: "Not started",
    className: "border-muted bg-muted/30 text-muted-foreground",
  },

  IN_PROGRESS: {
    label: "Loading",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },

  COMPLETED: {
    label: "Loaded",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },

  VERIFIED: {
    label: "Loaded",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },

  CANCELLED: {
    label: "Cancelled",
    className: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
  },
};

export function VPWagonLoadingStatusBadge({
  status,
  className,
}: {
  status?: VPWagonLoadingStatus | null;
  className?: string;
}) {
  const config = STATUS_CONFIG[status ?? "DRAFT"];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold shadow-sm",
        config.className,
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />

      {config.label}
    </span>
  );
}
