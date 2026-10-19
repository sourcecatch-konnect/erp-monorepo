"use client";

import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import type { MyWorkRow } from "@skerp/types";
import { formatPaiseCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

const ageLabel = (days: number) => (days < 1 ? "today" : `${days}d`);

type Props = {
  row: MyWorkRow;
  actionLabel: string;
  lateAfterDays: number;
  /** Shown above the row when it sits outside its own queue card. */
  queueTitle?: string;
};

export function MyWorkRowItem({
  row,
  actionLabel,
  lateAfterDays,
  queueTitle,
}: Props) {
  const nearLate = !row.isLate && row.ageDays >= lateAfterDays * 0.7;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          row.isLate
            ? "bg-destructive"
            : nearLate
              ? "bg-warning"
              : "bg-muted-foreground/40",
        )}
      />

      <div className="min-w-0 flex-1 basis-60">
        {queueTitle && (
          <p className="text-xs text-muted-foreground">{queueTitle}</p>
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
        <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end text-right">
        <span
          className={cn(
            "text-sm tabular-nums",
            row.isLate ? "font-medium text-destructive" : "text-muted-foreground",
          )}
          title={`${row.ageDays} day(s) in this step`}
        >
          {ageLabel(row.ageDays)}
        </span>
        {row.amountPaise !== null && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatPaiseCompact(Number(row.amountPaise))}
          </span>
        )}
      </div>

      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href={row.href}>
          {actionLabel}
          <IconArrowRight />
        </Link>
      </Button>
    </li>
  );
}
