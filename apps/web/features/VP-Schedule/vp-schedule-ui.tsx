import * as React from "react";
import type { VPSchedule } from "@skerp/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@skerp/ui/components/tooltip";

export type VPScheduleStatus = VPSchedule["status"];

const STATUS_LABELS: Record<VPScheduleStatus, string> = {
  DRAFT: "Draft",
  PLANNED: "Open",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<VPScheduleStatus, string> = {
  DRAFT: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  PLANNED: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  CANCELLED: "bg-red-500/10 text-red-700 border-red-500/20",
};

const isVPScheduleStatus = (
  status: string | null | undefined,
): status is VPScheduleStatus => {
  return status === "DRAFT" || status === "PLANNED" || status === "CANCELLED";
};

export function VPScheduleStatusBadge({
  status,
}: {
  status?: string | null;
}) {
  if (!isVPScheduleStatus(status)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
          "text-xs font-semibold shadow-sm",
          "bg-muted text-muted-foreground border-border",
        )}
      >
        <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1",
        "text-xs font-semibold shadow-sm",
        STATUS_STYLES[status],
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_3px_currentColor]/10" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export const VP_SCHEDULE_STATUS_ORDER: {
  key: "ALL" | VPScheduleStatus;
  label: string;
}[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "PLANNED", label: "Open" },
  { key: "CANCELLED", label: "Cancelled" },
];

export const formatVPScheduleDate = (date?: string | Date | null) => {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatVPScheduleDateTime = (date?: string | Date | null) => {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
export function TruncatedTooltipText({
  value,
  tooltipValue,
  className,
}: {
  value: string;
  tooltipValue?: string;
  className?: string;
}) {
  const displayValue = value || "—";
  const tooltipText = tooltipValue || displayValue;

  if (!displayValue || displayValue === "—") {
    return <span>—</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`block max-w-full truncate cursor-help ${className ?? ""}`}
        >
          {displayValue}
        </span>
      </TooltipTrigger>

      <TooltipContent
        side="top"
        className="z-50 max-w-sm whitespace-pre-line break-words"
      >
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}