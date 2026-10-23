"use client";

import type { AgeingBucketKey, AgeingReportView } from "@skerp/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { CompactMoney } from "./CompactMoney";

const BUCKETS: { key: AgeingBucketKey; label: string }[] = [
  { key: "notDue", label: "Not due" },
  { key: "d0_30", label: "0–30 days" },
  { key: "d31_60", label: "31–60" },
  { key: "d61_90", label: "61–90" },
  { key: "d90_plus", label: "90+" },
];

type Props = {
  data?: AgeingReportView;
  isLoading: boolean;
  /** Jump to a customer's statement (Debtor tab). */
  onSelectCustomer?: (customerId: string) => void;
};

/** ACCT-R5 — one row per customer, unpaid bills bucketed by days overdue. */
export function AgeingTable({ data, isLoading, onSelectCustomer }: Props) {
  const rows = data?.rows ?? [];

  return (
    <div className="overflow-auto rounded-md border border-border bg-card" style={{ maxHeight: 540 }}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_theme(colors.border)]">
          <TableRow>
            <TableHead className="text-xs">Customer</TableHead>
            {BUCKETS.map((b) => (
              <TableHead key={b.key} className="text-right text-xs">
                {b.label}
              </TableHead>
            ))}
            <TableHead className="text-right text-xs">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                No outstanding bills for this filter.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.customerId}
                onClick={onSelectCustomer ? () => onSelectCustomer(row.customerId) : undefined}
                className={onSelectCustomer ? "cursor-pointer hover:bg-muted/50" : undefined}
              >
                <TableCell className="text-sm font-medium">{row.customerName}</TableCell>
                {BUCKETS.map((b) => (
                  <TableCell key={b.key} className="text-right text-sm">
                    {row.buckets[b.key] > 0 ? (
                      <CompactMoney value={row.buckets[b.key]} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right text-sm font-semibold">
                  <CompactMoney value={row.totalPaise} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {!isLoading && data && rows.length > 0 ? (
          <tfoot className="sticky bottom-0 bg-card shadow-[0_-1px_0_0_theme(colors.border)]">
            <TableRow>
              <TableCell className="text-xs font-semibold uppercase text-muted-foreground">
                Grand total
              </TableCell>
              {BUCKETS.map((b) => (
                <TableCell key={b.key} className="text-right text-sm font-semibold">
                  <CompactMoney value={data.totals[b.key]} />
                </TableCell>
              ))}
              <TableCell className="text-right text-sm font-bold">
                <CompactMoney value={data.totals.totalPaise} />
              </TableCell>
            </TableRow>
          </tfoot>
        ) : null}
      </Table>
    </div>
  );
}
