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
import {
  ageBucketLabels,
  type AgeBucket,
} from "./api/service-bill-report.service";
import { useServiceBillOutstanding } from "./useServiceBillOutstanding";

export function ServiceBillOutstandingPage() {
  const {
    query,
    search,
    setSearch,
    bucket,
    setBucket,
    page,
    setPage,
    size,
    setSize,
  } = useServiceBillOutstanding();
  const summary = query.data?.summary;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Service Provider Outstanding</h1>
        <p className="text-sm text-muted-foreground">
          Current unpaid posted bills, aged from bill date in India time.
          Settled amounts include cash and TDS. Age shows days since billing;
          payment terms are not recorded.
        </p>
        {query.data && (
          <p className="text-xs text-muted-foreground">
            Report date: {query.data.reportDate}. Totals cover all matching
            bills.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          className="max-w-sm"
          aria-label="Search outstanding service bills"
          placeholder="Search provider, bill or invoice..."
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="space-y-1 text-sm">
          Bill age
          <select
            aria-label="Filter by bill age"
            className="block h-9 rounded-md border bg-background px-3"
            value={bucket}
            onChange={(event) =>
              setBucket(event.target.value as AgeBucket | "")
            }
          >
            <option value="">All ages</option>
            {Object.entries(ageBucketLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </div>
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          Could not load outstanding bills. Use Refresh to retry.
        </p>
      )}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Total outstanding", summary.outstandingPaise],
              ["Future dated", summary.futurePaise],
              ["0–30 days", summary.days0To30Paise],
              ["31–60 days", summary.days31To60Paise],
              ["61–90 days", summary.days61To90Paise],
              ["Over 90 days", summary.daysOver90Paise],
            ] as const
          ).map(([label, amount]) => (
            <div className="rounded-md border p-3" key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold tabular-nums">
                {formatPaise(amount)}
              </p>
            </div>
          ))}
        </div>
      )}
      <div
        className="overflow-x-auto rounded-md border"
        aria-busy={query.isFetching}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill / invoice</TableHead>
              <TableHead>Provider / branch</TableHead>
              <TableHead>Bill date</TableHead>
              <TableHead>Age</TableHead>
              <TableHead className="text-right">Net billed</TableHead>
              <TableHead className="text-right">Settled (cash + TDS)</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="p-6 text-center">
                  Loading outstanding bills...
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading &&
              !query.isError &&
              query.data?.rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="p-6 text-center text-muted-foreground"
                  >
                    No outstanding bills match these filters.
                  </TableCell>
                </TableRow>
              )}
            {query.data?.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    className="text-primary hover:underline"
                    href={`/workshop/service-bills/${row.id}`}
                  >
                    {row.serviceBillNumber ?? "Service bill"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {row.providerInvoiceNo}
                  </p>
                </TableCell>
                <TableCell>
                  {row.providerName}
                  {row.shopName && (
                    <p className="text-xs text-muted-foreground">
                      {row.shopName}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {row.branchName}
                  </p>
                </TableCell>
                <TableCell>
                  {new Date(row.billDate).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </TableCell>
                <TableCell>
                  {ageBucketLabels[row.bucket]}
                  <p className="text-xs text-muted-foreground">
                    {row.ageDays < 0
                      ? `In ${-row.ageDays} days`
                      : `${row.ageDays} days old`}
                  </p>
                </TableCell>
                {[
                  row.netAmountPaise,
                  row.settledPaise,
                  row.outstandingPaise,
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
      <p className="text-xs text-muted-foreground">
        Includes bills with posted payable journals. Fully settled and cancelled
        bills are excluded. Balances reflect current settlements; this report
        does not reconstruct past balances.
      </p>
    </div>
  );
}
