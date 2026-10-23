"use client";

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClockHour4,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type RowUrgency = "verylate" | "late" | "near" | "ontime";

/** Late items more than this many days past their deadline turn red. */
export const VERY_LATE_DAYS = 3;

/**
 * Same bands as the server: "due soon" from 70% of the limit, late at the
 * limit (orange), very late more than VERY_LATE_DAYS past it (red).
 */
export function rowUrgency(
  ageDays: number,
  lateAfterDays: number,
  isLate: boolean,
): RowUrgency {
  if (isLate) {
    return ageDays - lateAfterDays + 1 > VERY_LATE_DAYS ? "verylate" : "late";
  }
  return ageDays >= Math.floor(lateAfterDays * 0.7) ? "near" : "ontime";
}

/**
 * Plain words for how an item stands: "Due today", "Late by 3 days".
 * An item turns late at `lateAfterDays` old, so its last day is one before.
 */
export function dueText(ageDays: number, lateAfterDays: number, isLate: boolean) {
  if (isLate) {
    const over = ageDays - lateAfterDays + 1;
    return over === 1 ? "Late by 1 day" : `Late by ${over} days`;
  }
  const daysLeft = lateAfterDays - ageDays - 1;
  if (daysLeft <= 0) return "Due today";
  return daysLeft === 1 ? "Due tomorrow" : `Due in ${daysLeft} days`;
}

export const URGENCY_STYLE: Record<
  RowUrgency,
  { icon: Icon; text: string; tint: string; dot: string }
> = {
  verylate: {
    icon: IconAlertTriangle,
    text: "text-destructive",
    tint: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  late: {
    icon: IconAlertTriangle,
    text: "text-warning",
    tint: "bg-warning/15 text-warning",
    dot: "bg-warning",
  },
  near: {
    icon: IconClockHour4,
    text: "text-foreground",
    tint: "bg-muted text-warning",
    dot: "bg-warning",
  },
  ontime: {
    icon: IconCircleCheck,
    text: "text-success",
    tint: "bg-success/10 text-success",
    dot: "bg-success",
  },
};

/** Icon + words, so the state never depends on colour alone. */
export function DueLabel({
  ageDays,
  lateAfterDays,
  isLate,
  className,
}: {
  ageDays: number;
  lateAfterDays: number;
  isLate: boolean;
  className?: string;
}) {
  const urgency = rowUrgency(ageDays, lateAfterDays, isLate);
  const style = URGENCY_STYLE[urgency];
  const IconCmp = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium",
        urgency === "ontime" ? "text-muted-foreground" : style.text,
        className,
      )}
    >
      <IconCmp
        className={cn("size-3.5 shrink-0", urgency === "near" ? "text-warning" : style.text)}
      />
      {dueText(ageDays, lateAfterDays, isLate)}
    </span>
  );
}
