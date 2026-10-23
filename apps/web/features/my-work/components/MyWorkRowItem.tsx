"use client";

import Link from "next/link";
import { IconArchive } from "@tabler/icons-react";
import type { MyWorkRow } from "@skerp/types";
import { formatPaiseCompact } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ActionButton } from "./ActionButton";
import { DueLabel, rowUrgency, URGENCY_STYLE } from "./urgency";

type Props = {
  row: MyWorkRow;
  actionLabel: string;
  lateAfterDays: number;
  /** Which step the row is waiting in, e.g. "Make LR for confirmed orders". */
  queueTitle?: string;
  /** Waiting on someone's approval decision. */
  needsApproval?: boolean;
  /** An old leftover: show its age, not a deadline. */
  stale?: boolean;
  /** The one primary action on the page. */
  primary?: boolean;
  /** Finish the step in place instead of opening its screen. */
  onAction?: () => void;
};

/** One item in the My Work list: what it is, how urgent, and the next step. */
export function MyWorkRowItem({
  row,
  actionLabel,
  lateAfterDays,
  queueTitle,
  needsApproval,
  stale,
  primary,
  onAction,
}: Props) {
  const style = stale
    ? { icon: IconArchive, tint: "bg-muted text-muted-foreground" }
    : URGENCY_STYLE[rowUrgency(row.ageDays, lateAfterDays, row.isLate)];
  const IconCmp = style.icon;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors",
        // The first task gets a faint highlight; everything else stays plain.
        primary ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40",
      )}
    >
      <span
        aria-hidden
        className={cn("grid size-8 shrink-0 place-items-center rounded-md", style.tint)}
      >
        <IconCmp className="size-4" />
      </span>

      <div className="min-w-0 flex-1 basis-56">
        {(queueTitle || needsApproval || primary) && (
          <p className="flex min-w-0 items-center gap-2 text-xs">
            {primary && (
              <span className="shrink-0 rounded-sm bg-primary px-1.5 font-medium text-primary-foreground">
                Do this first
              </span>
            )}
            {queueTitle && (
              <span className="truncate font-medium text-muted-foreground">
                {queueTitle}
              </span>
            )}
            {needsApproval && (
              <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 font-medium text-primary">
                Approval
              </span>
            )}
          </p>
        )}
        <p className="truncate text-sm">
          <Link
            href={row.recordHref}
            className="font-medium text-foreground transition-colors hover:text-primary hover:underline"
          >
            {row.number}
          </Link>
          <span className="text-muted-foreground"> · {row.party}</span>
        </p>
        {row.detail && (
          <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-4">
        <div className="flex flex-col items-end gap-0.5">
          {stale ? (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {row.ageDays} days old
            </span>
          ) : (
            <DueLabel
              ageDays={row.ageDays}
              lateAfterDays={lateAfterDays}
              isLate={row.isLate}
            />
          )}
          {row.amountPaise !== null && (
            <span className="text-sm font-medium tabular-nums text-foreground">
              {formatPaiseCompact(Number(row.amountPaise))}
            </span>
          )}
        </div>
        {onAction ? (
          <ActionButton label={actionLabel} onClick={onAction} primary={primary} />
        ) : (
          <ActionButton label={actionLabel} href={row.href} primary={primary} />
        )}
      </div>
    </li>
  );
}
