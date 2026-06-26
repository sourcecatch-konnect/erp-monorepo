"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus, IconTrash, IconCheck, IconReceipt } from "@tabler/icons-react";

import type {
  CashPlanDayView,
  ReceivablesView,
  CreateCashReceivableBody,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { DatePicker } from "@skerp/ui/components/datepicker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { formatPaise } from "@/lib/money";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";

type Props = {
  day: CashPlanDayView;
  date: string;
  canEnter: boolean;
};

const toPaise = (rupees: string): number => Math.round(Number(rupees) * 100);

/** Local-date YYYY-MM-DD (avoids the UTC shift from toISOString). */
const toIsoDate = (d: Date): string => {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export default function ReceivablesPanel({ day, date, canEnter }: Props) {
  const queryClient = useQueryClient();
  const editable = canEnter;
  const setView = (view: ReceivablesView) =>
    queryClient.setQueryData(cashPlanningKeys.receivables(), view);

  const receivablesQuery = useQuery({
    queryKey: cashPlanningKeys.receivables(),
    queryFn: () => cashPlanningApi.listReceivables(),
  });
  const view = receivablesQuery.data;

  const [party, setParty] = React.useState("");
  const [total, setTotal] = React.useState("");
  const [expectedAmt, setExpectedAmt] = React.useState("");
  const [expectedDate, setExpectedDate] = React.useState<Date | undefined>();

  const resetForm = () => {
    setParty("");
    setTotal("");
    setExpectedAmt("");
    setExpectedDate(undefined);
  };

  const add = useMutation({
    mutationFn: () => {
      const body: CreateCashReceivableBody = {
        partyName: party.trim(),
        totalAmount: toPaise(total),
        expectedAmount: expectedAmt ? toPaise(expectedAmt) : 0,
        expectedDate: expectedDate ? toIsoDate(expectedDate) : undefined,
        note: undefined,
      };
      return cashPlanningApi.addReceivable(body);
    },
    onSuccess: (next) => {
      setView(next);
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  const received = useMutation({
    mutationFn: ({ id, amt }: { id: string; amt: number }) =>
      cashPlanningApi.markReceived(id, amt),
    onSuccess: (next) => setView(next),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cashPlanningApi.deleteReceivable(id),
    onSuccess: (next) => setView(next),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  // Expected to land by the selected planning day (dated, unreceived slices).
  const expectedByDay = React.useMemo(() => {
    if (!view) return 0;
    return view.receivables
      .filter(
        (r) =>
          !r.ackReceived &&
          r.expectedDate != null &&
          toIsoDate(new Date(r.expectedDate)) <= date,
      )
      .reduce((s, r) => s + r.expectedAmount, 0);
  }, [view, date]);

  const projectedCash = day.availableCash + expectedByDay;

  const totalValid = Number(total) > 0;
  const expectedValid =
    !expectedAmt || Number(expectedAmt) <= Number(total || "0");
  const canSubmit =
    party.trim().length > 0 && totalValid && expectedValid && !add.isPending;

  return (
    <div className="space-y-4">
      {/* forecast summary */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border text-sm">
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Available Cash</p>
          <p className="font-semibold">{formatPaise(day.availableCash)}</p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Expected by {date}
          </p>
          <p className="font-semibold text-sky-600">
            +{formatPaise(expectedByDay)}
          </p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Projected Cash</p>
          <p className="font-semibold text-emerald-600">
            {formatPaise(projectedCash)}
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        {editable ? (
          <div className="flex flex-wrap items-end gap-2 border-b bg-muted/30 px-4 py-3">
            <div className="grid gap-1">
              <label className="text-[11px] text-muted-foreground">Party</label>
              <Input
                className="h-9 w-48"
                placeholder="Payer name…"
                value={party}
                onChange={(e) => setParty(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-[11px] text-muted-foreground">
                Total amount (₹)
              </label>
              <Input
                type="number"
                step="0.01"
                className="h-9 w-32 text-right"
                placeholder="0.00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-[11px] text-muted-foreground">
                Expected amount (₹)
              </label>
              <Input
                type="number"
                step="0.01"
                className="h-9 w-32 text-right"
                placeholder="0.00"
                value={expectedAmt}
                onChange={(e) => setExpectedAmt(e.target.value)}
                aria-invalid={!expectedValid || undefined}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-[11px] text-muted-foreground">
                Expected date
              </label>
              <div className="w-44">
                <DatePicker
                  selected={expectedDate}
                  onSelect={setExpectedDate}
                  placeholder="Pick a date"
                />
              </div>
            </div>
            <Button size="sm" onClick={() => add.mutate()} disabled={!canSubmit}>
              <IconPlus size={15} className="mr-1" />
              Add
            </Button>
          </div>
        ) : null}

        {receivablesQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Total Pending</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!view || view.receivables.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    <IconReceipt
                      size={24}
                      className="mx-auto mb-2 text-muted-foreground"
                    />
                    No receivables recorded.
                  </TableCell>
                </TableRow>
              ) : (
                view.receivables.map((r) => (
                  <TableRow
                    key={r.id}
                    className={r.ackReceived ? "opacity-60" : ""}
                  >
                    <TableCell className="text-sm font-medium">
                      {r.partyName}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatPaise(r.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-sky-600">
                      {r.expectedAmount > 0
                        ? formatPaise(r.expectedAmount)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.expectedDate
                        ? new Date(r.expectedDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.ackReceived ? (
                        <span className="text-emerald-600">
                          {formatPaise(r.receivedAmount ?? r.totalAmount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">pending</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {editable && !r.ackReceived ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Mark received (full)"
                            className="text-emerald-600 hover:bg-emerald-50"
                            disabled={received.isPending}
                            onClick={() =>
                              received.mutate({ id: r.id, amt: r.totalAmount })
                            }
                          >
                            <IconCheck size={15} />
                          </Button>
                        ) : null}
                        {editable ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Delete"
                            className="text-muted-foreground hover:bg-muted"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(r.id)}
                          >
                            <IconTrash size={15} />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
