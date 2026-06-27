"use client";

import { IconHistory } from "@tabler/icons-react";

import type { CashReceipt } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@skerp/ui/components/popver";

import { CompactMoney } from "./CompactMoney";

/** A vertical timeline of every receipt recorded against a receivable. */
export function ReceiptTimeline({ receipts }: { receipts: CashReceipt[] }) {
  const total = receipts.reduce((s, r) => s + r.amount, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Receipt history"
          className="text-muted-foreground hover:bg-muted"
        >
          <IconHistory size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">Receipt timeline</p>
          <p className="text-xs text-muted-foreground">
            {receipts.length} receipt{receipts.length === 1 ? "" : "s"} ·{" "}
            <CompactMoney value={total} /> received
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto p-3">
          <ol className="relative space-y-3 border-l border-border pl-4">
            {receipts.map((rc) => (
              <li key={rc.id} className="relative">
                <span className="absolute -left-[1.3rem] top-1 size-2 rounded-full bg-emerald-500 ring-2 ring-card" />
                <div className="flex items-center justify-between gap-2">
                  <CompactMoney className="text-sm font-medium" value={rc.amount} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(rc.receivedAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                </div>
                {rc.note ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{rc.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </PopoverContent>
    </Popover>
  );
}
