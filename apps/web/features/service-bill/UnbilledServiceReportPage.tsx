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
import { useUnbilledServiceReport } from "./useUnbilledServiceReport";

export function UnbilledServiceReportPage() {
  const {
    query,
    search,
    setSearch,
    completedTo,
    setCompletedTo,
    size,
    setSize,
    page,
    setPage,
  } = useUnbilledServiceReport();
  const summary = query.data?.summary;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Unbilled Services</h1>
        <p className="text-sm text-muted-foreground">
          Completed services awaiting provider billing across all accessible
          branches. Amounts are operational estimates before bill discounts.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          className="max-w-sm"
          aria-label="Search unbilled services"
          placeholder="Search provider, card, vehicle or part..."
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="space-y-1 text-sm">
          Completed through
          <Input
            type="date"
            value={completedTo}
            onChange={(event) => setCompletedTo(event.target.value)}
          />
        </label>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Completion cutoff includes the full India calendar day. Results show
        services still unbilled now, including services released by cancelled
        bills.
      </p>
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          Could not load unbilled services. Use Refresh to retry.
        </p>
      )}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Unbilled estimate", formatPaise(summary.amountPaise)],
            ["Job cards", summary.jobCards],
            ["Providers", summary.providers],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Totals cover all matching services.
      </p>
      <div
        className="overflow-x-auto rounded-md border"
        aria-busy={query.isFetching}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job card / vehicle</TableHead>
              <TableHead>Provider / branch</TableHead>
              <TableHead>Service / part</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Estimate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="p-6 text-center">
                  Loading unbilled services...
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading &&
              !query.isError &&
              query.data?.rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="p-6 text-center text-muted-foreground"
                  >
                    No unbilled services match these filters.
                  </TableCell>
                </TableRow>
              )}
            {query.data?.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    className="text-primary hover:underline"
                    href={`/workshop/job-cards/${row.jobCardId}`}
                  >
                    {row.jobCardNumber ?? "Job card"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {row.vehicleNumber}
                  </p>
                </TableCell>
                <TableCell>
                  {row.providerName}
                  <p className="text-xs text-muted-foreground">
                    {row.branchName}
                  </p>
                </TableCell>
                <TableCell>
                  {row.sparePartName}
                  {row.description && (
                    <p className="text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {row.completedAt
                    ? new Date(row.completedAt).toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })
                    : "Date missing"}
                </TableCell>
                <TableCell className="text-right">{row.qty}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(row.amountPaise)}
                </TableCell>
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
