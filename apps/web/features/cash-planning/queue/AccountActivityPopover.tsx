"use client";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@skerp/ui/components/popver";

import { formatPaise } from "@/lib/money";
import { CompactMoney } from "../components/CompactMoney";

export type ActivityEntry = {
  id: string;
  label: string;
  detail?: string;
  amountPaise: number;
  at: string | Date;
  tag: "receipt" | "manual" | "payment" | "correction";
};

const tagDot: Record<ActivityEntry["tag"], string> = {
  receipt: "bg-emerald-500",
  manual: "bg-emerald-500",
  payment: "bg-red-500",
  correction: "bg-red-500",
};

const tagLabel: Record<ActivityEntry["tag"], string> = {
  receipt: "Receipt",
  manual: "Manual",
  payment: "Payment",
  correction: "Correction",
};

/**
 * Drill-down for one account's Received or Payment column: every adjustment
 * / approved payment that contributed to today's total, newest first.
 */
export function AccountActivityPopover({
  accountName,
  columnLabel,
  total,
  entries,
  emptyLabel,
}: {
  accountName: string;
  columnLabel: string;
  total: number;
  entries: ActivityEntry[];
  emptyLabel: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="-mx-1 rounded px-1 text-right transition-colors hover:bg-muted"
        >
          <CompactMoney value={total} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">
            {columnLabel} · {accountName}
          </p>
          <p className="text-xs text-muted-foreground">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"} today ·{" "}
            {formatPaise(total)}
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto p-3">
          {entries.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {entries.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    className={`absolute -left-[1.3rem] top-1 size-2 rounded-full ring-2 ring-card ${tagDot[e.tag]}`}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={e.label}>
                        {e.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tagLabel[e.tag]} ·{" "}
                        {new Date(e.at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {e.detail ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={e.detail}>
                          {e.detail}
                        </p>
                      ) : null}
                    </div>
                    <CompactMoney
                      className="shrink-0 text-sm font-medium"
                      value={e.amountPaise}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
