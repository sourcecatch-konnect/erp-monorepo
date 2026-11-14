"use client";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
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
import type { AuditParams } from "./api/job-card-report.service";
import { useJobCardAudit } from "./useJobCardAudit";

export function JobCardAuditPage() {
  const {
    query,
    mode,
    setMode,
    view,
    setView,
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
    isPeriod,
    invalidDates,
  } = useJobCardAudit();
  const summary = query.data?.summary;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Job Card Finance Audit</h1>
        <p className="text-sm text-muted-foreground">
          Review stock movement/batch balances, source quantities and values,
          bill/slip settlement counters, payment vouchers, posting history and
          Tally follow-up.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          View
          <select
            className="block h-9 rounded-md border bg-background px-3"
            value={mode}
            onChange={(event) => {
              const next = event.target.value as AuditParams["mode"];
              setMode(next);
              setView(next === "POSTINGS" ? "ALL" : "ISSUES");
            }}
          >
            <option value="SETTLEMENTS">Settlement reconciliation</option>
            <option value="STOCK">Stock reconciliation</option>
            <option value="POSTINGS">Posting-period audit</option>
            <option value="TALLY">Tally follow-up</option>
          </select>
        </label>
        <Input
          className="max-w-sm"
          aria-label="Search finance audit"
          placeholder="Search document, ID, part or branch..."
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="text-sm">
          Records
          <select
            className="block h-9 rounded-md border bg-background px-3"
            value={view}
            onChange={(event) =>
              setView(event.target.value as AuditParams["view"])
            }
          >
            <option value="ISSUES">Issues only</option>
            <option value="ALL">All records</option>
          </select>
        </label>
        {isPeriod && (
          <>
            <label className="text-sm">
              Posted from
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="text-sm">
              Posted through
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        )}
        <Button
          variant="outline"
          disabled={invalidDates || query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </div>
      {invalidDates && (
        <p role="alert" className="text-destructive">
          End date must follow start date.
        </p>
      )}
      {query.isError && (
        <p role="alert" className="text-destructive">
          Could not load audit. Use Refresh to retry.
        </p>
      )}
      {isPeriod ? (
        <p className="text-xs text-muted-foreground">
          India posting dates include the full end day. Active expense totals
          exclude reversed originals and reversal vouchers under the existing
          ledger convention. Both remain visible in audit history; this does not
          reconstruct a past balance as it stood then.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Current balances across all matching records. Stock opening balances
          without movement evidence are flagged for reconciliation. Quantity
          differences across checks can describe the same underlying imbalance.
        </p>
      )}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Issues", summary.issues],
            [
              "Absolute money differences",
              formatPaise(summary.moneyDifferencePaise),
            ],
            ["Absolute quantity differences", summary.quantityDifference],
            ["Active repair expense", formatPaise(summary.activeExpensePaise)],
          ].map(([label, value]) => (
            <div className="rounded-md border p-3" key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold tabular-nums">{value}</p>
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
              <TableHead>Document / check</TableHead>
              <TableHead>State / voucher</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={6}>Loading audit...</TableCell>
              </TableRow>
            )}
            {!query.isLoading &&
              !query.isError &&
              !invalidDates &&
              query.data?.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    No records match these filters.
                  </TableCell>
                </TableRow>
              )}
            {query.data?.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.documentNumber}
                  <p className="text-xs text-muted-foreground">
                    {row.branchName}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.id}</p>
                </TableCell>
                <TableCell>
                  {row.state.replaceAll("_", " ")}
                  <p className="text-xs text-muted-foreground">
                    {row.voucherNumber}{" "}
                    {row.tallySyncStatus?.replaceAll("_", " ")}
                  </p>
                  {row.date && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(row.date).toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>
                  )}
                </TableCell>
                <TableCell
                  className={row.issue === "MATCHED" ? "" : "text-destructive"}
                >
                  {row.issue.replaceAll("_", " ")}
                </TableCell>
                {[row.expected, row.actual, row.difference].map(
                  (value, index) => (
                    <TableCell className="text-right tabular-nums" key={index}>
                      {row.unit === "PAISE"
                        ? formatPaise(value)
                        : `${value} units`}
                    </TableCell>
                  ),
                )}
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
        Read-only checks never repair balances or send data to Tally. Tally
        follow-up shows stored sync status; verify exports against Tally during
        Finance review. Totals follow the selected filters.
      </p>
    </div>
  );
}
