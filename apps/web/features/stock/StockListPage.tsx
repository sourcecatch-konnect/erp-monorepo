"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PERMS } from "@skerp/types";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { useCan } from "@/features/auth";
import { formatPaise } from "@/lib/money";
import { branchApi } from "@/features/masters/branch/branch.service";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { stockApi } from "./api/stock.service";

/** Current stock levels per spare part per branch — read-only, no create/edit.
 *  Elsewhere stock quantity only ever shows up embedded in a PO or Job Card
 *  line picker; this is the one place to just look at it. */
export function StockListPage() {
  const canView = useCan(PERMS.WORKSHOP.INWARD_VIEW);
  const [branchId, setBranchId] = React.useState("ALL");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const branches = useQuery({
    queryKey: ["stock", "branches"],
    queryFn: () => branchApi.list({ page: 0, size: 200 }),
  });

  const stock = useQuery({
    queryKey: ["stock", "list", branchId, debouncedSearch],
    queryFn: () =>
      stockApi.list({
        branchId: branchId === "ALL" ? undefined : branchId,
        search: debouncedSearch || undefined,
      }),
    enabled: canView,
  });

  const branchOptions = branches.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Current quantity on hand for every spare part, by branch — including anything below
          its minimum stock level.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <Input
            placeholder="Search part name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Branch</label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All branches</SelectItem>
              {branchOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Current Qty</TableHead>
              <TableHead className="text-right">Minimum Stock</TableHead>
              <TableHead className="text-right">Moving Avg Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!stock.isLoading && (stock.data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No stock rows found.
                </TableCell>
              </TableRow>
            )}
            {stock.data?.map((row) => {
              const belowMinimum = row.currentQty < row.sparePart.minimumStock;
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.sparePart.name}</TableCell>
                  <TableCell>{row.sparePart.unit}</TableCell>
                  <TableCell>{row.branch.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-2">
                      {row.currentQty}
                      {belowMinimum ? (
                        <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          Below min
                        </span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.sparePart.minimumStock}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(row.movingAvgCostPaise)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
