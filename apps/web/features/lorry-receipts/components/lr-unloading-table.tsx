import Link from "next/link";
import {
  IconArrowRight,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconMapPin,
} from "@tabler/icons-react";

import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { formatDate, formatDateTime } from "@/lib/format";
import type { LRUnloadingReportRow } from "./lr-unloading-report.util";

type Props = {
  rows: LRUnloadingReportRow[];
  isLoading: boolean;
  onClearFilters: () => void;
};

function PodStatus({ status }: { status: LRUnloadingReportRow["status"] }) {
  const acknowledged = status === "ACKNOWLEDGED";
  const Icon = acknowledged ? IconCheck : IconClock;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        acknowledged
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
      }`}
    >
      <Icon size={13} />
      {acknowledged ? "Acknowledged" : "Pending POD"}
    </span>
  );
}

export function UnloadingReportTable({
  rows,
  isLoading,
  onClearFilters,
}: Props) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Unloading records</h2>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? "Loading records…"
              : `${rows.length} record${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Open a record for challans, POD and detention details
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[780px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[220px]">LR & route</TableHead>
              <TableHead>Parties</TableHead>
              <TableHead className="w-[210px]">Unloading</TableHead>
              <TableHead className="w-[190px]">POD status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-12 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center">
                  <p className="font-medium">No unloading records found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try changing or clearing the current filters.
                  </p>
                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-primary hover:underline"
                    onClick={onClearFilters}
                  >
                    Clear filters
                  </button>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const detailHref = `/lorry-receipts/unloading-report/${row.id}`;
                return (
                  <TableRow key={row.id} className="group hover:bg-muted/30">
                    <TableCell>
                      <Link
                        href={detailHref}
                        className="font-semibold text-primary hover:underline"
                      >
                        {row.lrNumber}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(row.lrDate)}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <IconMapPin size={12} />
                        <span className="truncate">
                          {row.originBranchName ?? "—"}
                        </span>
                        <IconArrowRight size={12} className="shrink-0" />
                        <span className="truncate">
                          {row.destinationBranchName ?? "—"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <p className="font-medium">{row.consignorName ?? "—"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        To: {row.consigneeName ?? "—"}
                      </p>
                    </TableCell>

                    <TableCell>
                      <p className="text-sm font-medium">
                        {formatDateTime(row.unloadingAt ?? row.deliveredAt)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Receiver: {row.receiverName ?? "Not recorded"}
                      </p>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <PodStatus status={row.status} />
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {row.podReceivedAt
                              ? formatDateTime(row.podReceivedAt)
                              : "Awaiting returned document"}
                          </p>
                        </div>
                        <Link
                          href={detailHref}
                          aria-label={`View unloading details for ${row.lrNumber}`}
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        >
                          <IconChevronRight size={18} />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
