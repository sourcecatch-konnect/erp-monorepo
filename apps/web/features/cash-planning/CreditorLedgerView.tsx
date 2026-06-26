"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { IconReceipt, IconCoins } from "@tabler/icons-react";

import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { TooltipProvider } from "@skerp/ui/components/tooltip";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";
import { CompactMoney } from "./CompactMoney";

const labelOf = (v: string) =>
  v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function CreditorLedgerView() {
  const ledger = useQuery({
    queryKey: cashPlanningKeys.ledger(),
    queryFn: () => cashPlanningApi.ledger(),
  });

  if (ledger.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[68px] w-full rounded-md" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const data = ledger.data;
  if (!data || data.groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-16 text-center">
        <IconReceipt size={28} className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No creditor outstanding balances yet. Add creditors with an outstanding
          amount in the Creditors master.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <IconCoins size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Total Outstanding
            </p>
            <CompactMoney
              className="block text-xl font-semibold"
              value={data.grandTotal}
            />
          </div>
        </div>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          {data.groups.length} categor{data.groups.length === 1 ? "y" : "ies"} · auto-totalled
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.groups.map((group) => (
          <div
            key={group.category}
            className="overflow-hidden rounded-md border border-border bg-card"
          >
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {labelOf(group.category)}
                </span>
                <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {group.creditors.length}
                </span>
              </div>
              <CompactMoney
                className="text-sm font-semibold"
                value={group.subtotal}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Creditor</TableHead>
                  <TableHead className="h-8 text-right text-xs">
                    Outstanding
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.creditors.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="py-1.5 text-sm">{c.name}</TableCell>
                    <TableCell className="py-1.5 text-right text-sm">
                      <CompactMoney value={c.outstandingBalance} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
      </div>
    </TooltipProvider>
  );
}
