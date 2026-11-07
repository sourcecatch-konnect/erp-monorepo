"use client";

import { useQuery } from "@tanstack/react-query";
import { IconAlertTriangle, IconClockHour4 } from "@tabler/icons-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { detentionSlabApi } from "@/features/masters/detention-slab/detention-slab.service";
import { detentionQuoteKeys } from "@/features/masters/detention-slab/detention-slab.keys";

import { formatDate, money } from "./vendor-payment.ui";

type Props = {
  /** The challan to explain; `null` closes the dialog. */
  challanId: string | null;
  challanNumber: string;
  onOpenChange: (open: boolean) => void;
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

/**
 * Why a challan's detention is what it is.
 *
 * The figure on the browse row is one number with a lot behind it — which
 * dates were used, how many days that came to, which slab won, and how the
 * bands stacked. Without this an operator facing a broker's query has to open
 * each LR and count dates by hand.
 *
 * Read-only: the quote endpoint writes nothing, so opening this cannot change
 * what will be paid.
 */
export function DetentionBreakdownDialog({
  challanId,
  challanNumber,
  onOpenChange,
}: Props) {
  const quote = useQuery({
    queryKey: detentionQuoteKeys.byChallan(challanId ?? ""),
    queryFn: () => detentionSlabApi.quote(challanId!),
    enabled: Boolean(challanId),
  });

  const data = quote.data;
  const window = data?.window;

  return (
    <Dialog open={Boolean(challanId)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconClockHour4 size={18} />
            </span>
            <DialogTitle>Detention working — {challanNumber}</DialogTitle>
          </div>
          <DialogDescription>
            How this challan&apos;s detention was calculated. Nothing here is
            saved until a slip is created.
          </DialogDescription>
        </DialogHeader>

        {quote.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : quote.isError || !data || !window ? (
          <p className="text-sm text-muted-foreground">
            Could not load the detention working for this challan.
          </p>
        ) : (
          <div className="space-y-4">
            <section className="rounded-md border border-border p-3">
              <Row
                label="LRs on this challan"
                value={
                  data.lrNumbers.length > 0 ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {data.lrNumbers.map((lrNumber) => (
                        <span
                          key={lrNumber}
                          className="rounded-md border border-border px-1.5 py-0.5 text-xs font-normal text-muted-foreground"
                        >
                          {lrNumber}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label="Final reporting date"
                value={formatDate(window.finalReportingAt)}
              />
              <Row
                label="Final unloading date"
                value={formatDate(window.finalUnloadingAt)}
              />
              <Row
                label="Days held (both ends counted)"
                value={window.detentionDays ?? "—"}
              />
              <Row
                label="Free days"
                value={
                  data.charge.freeUnits > 0 ? `− ${data.charge.freeUnits}` : "—"
                }
              />
              <Row label="Chargeable" value={data.charge.chargeableUnits} />
            </section>

            <section>
              <p className="mb-1.5 text-xs text-muted-foreground">
                Slab:{" "}
                <span className="font-medium text-foreground">
                  {data.slab?.name ?? "none matched"}
                </span>
                {data.broker ? ` · ${data.broker.name}` : null}
              </p>
              {data.charge.lines.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Band</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.charge.lines.map((line) => (
                      <TableRow key={line.label}>
                        <TableCell>{line.label}</TableCell>
                        <TableCell className="text-right">
                          {line.units}
                        </TableCell>
                        <TableCell className="text-right">
                          {money(line.ratePaise)}
                        </TableCell>
                        <TableCell className="text-right">
                          {money(line.amountPaise)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="font-medium">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {money(data.charge.amountPaise)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing chargeable on this challan.
                </p>
              )}
            </section>

            {data.alternatives.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Other slabs that also matched:{" "}
                {data.alternatives.map((slab) => slab.name).join(", ")}
              </p>
            ) : null}

            {data.warnings.map((warning) => (
              <p
                key={warning}
                className="flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400"
              >
                <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                {warning}
              </p>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
