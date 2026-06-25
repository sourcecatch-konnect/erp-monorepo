"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { IconReceipt } from "@tabler/icons-react";

import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { formatPaise } from "@/lib/money";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";

const labelOf = (v: string) =>
  v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function CreditorLedgerView() {
  const ledger = useQuery({
    queryKey: cashPlanningKeys.ledger(),
    queryFn: () => cashPlanningApi.ledger(),
  });

  if (ledger.isLoading) {
    return <Skeleton className="h-80 w-full rounded-md" />;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="text-lg font-semibold">{formatPaise(data.grandTotal)}</p>
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
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
              <span className="text-sm font-semibold">
                {labelOf(group.category)}
              </span>
              <span className="text-sm font-semibold">
                {formatPaise(group.subtotal)}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8">Creditor</TableHead>
                  <TableHead className="h-8 text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.creditors.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="py-1.5 text-sm">{c.name}</TableCell>
                    <TableCell className="py-1.5 text-right text-sm">
                      {formatPaise(c.outstandingBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}
