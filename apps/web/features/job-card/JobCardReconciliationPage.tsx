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
import type { ReconciliationKind } from "./api/job-card-report.service";
import { useJobCardReconciliation } from "./useJobCardReconciliation";

const kindLabels: Record<ReconciliationKind, string> = {
  PARTS: "Parts issue",
  SERVICES: "Service bill",
  RETURN: "Reusable return",
};
const issueLabels: Record<string, string> = {
  MATCHED: "Matched",
  MISSING_JOURNAL: "Missing voucher",
  WRONG_BRANCH: "Wrong voucher branch",
  WRONG_SOURCE: "Wrong voucher source",
  NOT_POSTED: "Voucher not posted",
  UNBALANCED: "Unbalanced voucher",
  AMOUNT_MISMATCH: "Amount mismatch",
  SOURCE_VALUE_MISSING: "Return cost missing",
};

export function JobCardReconciliationPage() {
  const {
    query,
    search,
    setSearch,
    kind,
    setKind,
    view,
    setView,
    size,
    setSize,
    page,
    setPage,
  } = useJobCardReconciliation();
  const summary = query.data?.summary;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Repair Expense Reconciliation</h1>
        <p className="text-sm text-muted-foreground">
          Compare current parts issues, posted service bills and reusable
          returns with their linked repair-expense vouchers.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          className="max-w-sm"
          aria-label="Search repair reconciliation"
          placeholder="Search document, source ID or branch..."
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="space-y-1 text-sm">
          Source
          <select
            className="block h-9 rounded-md border bg-background px-3"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as ReconciliationKind | "")
            }
          >
            <option value="">All sources</option>
            {Object.entries(kindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Show
          <select
            className="block h-9 rounded-md border bg-background px-3"
            value={view}
            onChange={(event) =>
              setView(event.target.value as "ISSUES" | "ALL")
            }
          >
            <option value="ISSUES">Issues only</option>
            <option value="ALL">All records</option>
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
          Could not load reconciliation. Use Refresh to retry.
        </p>
      )}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Issues", summary.issues],
            ["Expected expense", formatPaise(summary.expectedPaise)],
            ["Recorded expense", formatPaise(summary.recordedPaise)],
            [
              "Absolute differences",
              formatPaise(summary.absoluteDifferencePaise),
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Totals cover the selected view and filters. Return credits are negative.
        Absolute differences prevent opposite mismatches from cancelling out.
      </p>
      <div
        className="overflow-x-auto rounded-md border"
        aria-busy={query.isFetching}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source / branch</TableHead>
              <TableHead>Voucher / Tally</TableHead>
              <TableHead>Check</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Recorded</TableHead>
              <TableHead className="text-right">Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="p-6 text-center">
                  Loading reconciliation...
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
                    No records match this view.
                  </TableCell>
                </TableRow>
              )}
            {query.data?.rows.map((row) => (
              <TableRow key={`${row.kind}:${row.id}`}>
                <TableCell>
                  <Link
                    className="text-primary hover:underline"
                    href={
                      row.kind === "SERVICES"
                        ? `/workshop/service-bills/${row.parentId}`
                        : `/workshop/job-cards/${row.parentId}`
                    }
                  >
                    {row.documentNumber ?? "Source document"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {kindLabels[row.kind]} · {row.branchName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.sourceDate
                      ? new Date(row.sourceDate).toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })
                      : "Date missing"}
                  </p>
                  {row.kind === "RETURN" && (
                    <p className="text-xs text-muted-foreground">
                      Return: {row.id}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {row.voucherNumber ?? "No accessible voucher"}
                  <p className="text-xs text-muted-foreground">
                    {row.tallySyncStatus?.replaceAll("_", " ") ?? "—"}
                  </p>
                </TableCell>
                <TableCell
                  className={row.issue === "MATCHED" ? "" : "text-destructive"}
                >
                  {issueLabels[row.issue] ?? row.issue}
                </TableCell>
                {[
                  row.expectedPaise,
                  row.recordedPaise,
                  row.differencePaise,
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
        Checks current source-linked vouchers only. Historical reversals, orphan
        journals, stock balances and settlement reconciliation require separate
        review. Tally status is shown for follow-up.
      </p>
    </div>
  );
}
