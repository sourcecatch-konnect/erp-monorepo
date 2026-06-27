"use client";

import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

/**
 * Block-level loading previews for the Cash Planning Queue tab. Each block owns
 * a skeleton that mirrors the real component's shape so the layout doesn't shift
 * when data lands. Position + queue come from the same `getDay` payload, so they
 * resolve together — these just keep the preview faithful per block.
 */

/** Mirrors {@link CashPositionPanel}: header, account table, totals footer. */
export function CashPositionSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Account</TableHead>
            <TableHead className="text-right text-xs">Opening</TableHead>
            <TableHead className="text-right text-xs">Closing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-20" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="grid grid-cols-3 gap-px border-t bg-border text-sm">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5 bg-card px-4 py-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mirrors {@link PaymentQueue}: header, fast-entry strip, queued payment rows. */
export function PaymentQueueSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-60" />
        </div>
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>

      {/* fast-entry strip */}
      <div className="flex flex-wrap items-end gap-3 border-b bg-muted/30 px-4 py-3">
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      <div className="divide-y divide-border/60">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
