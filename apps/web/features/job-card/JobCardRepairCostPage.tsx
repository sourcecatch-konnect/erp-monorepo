"use client";

import Link from "next/link";
import { Input } from "@skerp/ui/components/input";
import { Button } from "@skerp/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import { formatPaise } from "@/lib/money";
import { useJobCardRepairCosts } from "./useJobCardRepairCosts";

export function JobCardRepairCostPage() {
  const {
    query,
    search,
    setSearch,
    from,
    setFrom,
    to,
    setTo,
    page,
    setPage,
    size,
    setSize,
    invalidDates,
  } = useJobCardRepairCosts();
  const summary = query.data?.summary;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Repair Cost Report</h1>
        <p className="text-sm text-muted-foreground">
          Current posted costs by completed job card, including later service
          bills. Completion dates use India time. This is not a posting-period
          ledger report.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          className="max-w-sm"
          aria-label="Search repair costs"
          placeholder="Search job card or vehicle..."
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="space-y-1 text-sm">
          Completed from
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Completed to
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      {invalidDates && (
        <p role="alert" className="text-sm text-destructive">
          To date cannot be before from date.
        </p>
      )}
      {query.isError && (
        <div role="alert" className="text-sm text-destructive">
          Could not load repair costs.{" "}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Net posted cost", summary.netCostPaise],
              ["Unbilled services", summary.unbilledServicesPaise],
              ["Awaiting cost posting", summary.unpostedCostPaise],
            ] as const
          ).map(([label, value]) => (
            <div className="rounded-md border p-3" key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold tabular-nums">{formatPaise(value)}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Totals cover all matching cards. Net cost = posted parts + service bills
        after discount − reusable return credits. Payments do not add another
        repair expense.
      </p>
      <div className="rounded-md border" aria-busy={query.isFetching}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job card / completed</TableHead>
              <TableHead>Vehicle / branch</TableHead>
              <TableHead className="text-right">Parts</TableHead>
              <TableHead className="text-right">Services (net)</TableHead>
              <TableHead className="text-right">Return credits</TableHead>
              <TableHead className="text-right">Net cost</TableHead>
              <TableHead className="text-right">Unbilled services</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="p-6 text-center">
                  Loading repair costs...
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading &&
              !query.isError &&
              !invalidDates &&
              query.data?.rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="p-6 text-center text-muted-foreground"
                  >
                    No completed job cards match these filters.
                  </TableCell>
                </TableRow>
              )}
            {query.data?.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    className="text-primary hover:underline"
                    href={`/workshop/job-cards/${row.id}`}
                  >
                    {row.jobCardNumber ?? "Job card"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {row.outDateTime
                      ? new Date(row.outDateTime).toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })
                      : "Completion date missing"}
                  </p>
                  {BigInt(row.unpostedCostPaise) > 0n && (
                    <p className="text-xs text-amber-700">
                      Awaiting posting: {formatPaise(row.unpostedCostPaise)}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {row.vehicleNumber}
                  <p className="text-xs text-muted-foreground">
                    {row.branchName}
                  </p>
                </TableCell>
                {[
                  row.partsPaise,
                  row.servicesPaise,
                  row.returnsPaise,
                  row.netCostPaise,
                  row.unbilledServicesPaise,
                ].map((amount, index) => (
                  <TableCell key={index} className="text-right tabular-nums">
                    {formatPaise(amount)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {query.data && (
          <TablePaginationFooter
            total={query.data.total}
            page={page}
            size={size}
            onPageChange={setPage}
            onSizeChange={setSize}
          />
        )}
      </div>
    </div>
  );
}
