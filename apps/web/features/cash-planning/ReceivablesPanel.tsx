"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconReceipt,
  IconPencil,
  IconCoins,
  IconTrendingUp,
  IconWallet,
  IconChartBar,
  IconCalendarEvent,
} from "@tabler/icons-react";

import type {
  CashPlanDayView,
  CashReceivable,
  ReceivablesView,
  CreateCashReceivableBody,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { TooltipProvider } from "@skerp/ui/components/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { formatPaiseCompact } from "@/lib/money";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";
import { CompactMoney } from "./CompactMoney";
import { StatCard } from "./StatCard";
import { EditReceivableDialog } from "./EditReceivableDialog";

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

const fieldLabel = "text-xs font-medium text-muted-foreground";

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
  const [editing, setEditing] = React.useState<CashReceivable | null>(null);

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
    onMutate: ({ id, amt }) => {
      const prev = queryClient.getQueryData<ReceivablesView>(
        cashPlanningKeys.receivables(),
      );
      if (prev) setView(applyReceiptOptimistic(prev, id, amt));
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) setView(ctx.prev);
      toast.error(e instanceof Error ? e.message : "Failed");
    },
    onSuccess: (next) => setView(next),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cashPlanningApi.deleteReceivable(id),
    onSuccess: (next) => setView(next),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  /** Is this dated, unreceived slice due on or before the selected day? */
  const isDueByDay = React.useCallback(
    (r: CashReceivable) =>
      !r.ackReceived &&
      r.expectedDate != null &&
      toIsoDate(new Date(r.expectedDate)) <= date,
    [date],
  );

  // Expected to land by the selected planning day (dated, unreceived slices).
  const expectedByDay = React.useMemo(() => {
    if (!view) return 0;
    return view.receivables
      .filter(isDueByDay)
      .reduce((s, r) => s + r.expectedAmount, 0);
  }, [view, isDueByDay]);

  const projectedCash = day.availableCash + expectedByDay;
  const openCount = view
    ? view.receivables.filter((r) => !r.ackReceived).length
    : 0;

  const totalValid = Number(total) > 0;
  const expectedValid =
    !expectedAmt || Number(expectedAmt) <= Number(total || "0");
  const canSubmit =
    party.trim().length > 0 && totalValid && expectedValid && !add.isPending;

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* overview stat cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<IconCoins size={15} />}
            label="Total Receivables"
            value={view?.totalPending ?? 0}
            sub={view ? `${openCount} open` : undefined}
          />
          <StatCard
            icon={<IconTrendingUp size={15} />}
            label="Total Expected"
            value={view?.totalExpected ?? 0}
            tone="sky"
          />
          <StatCard
            icon={<IconWallet size={15} />}
            label="Available Cash"
            value={day.availableCash}
            tone={day.availableCash < 0 ? "destructive" : undefined}
          />
          <StatCard
            icon={<IconChartBar size={15} />}
            label="Projected Cash"
            value={projectedCash}
            tone="emerald"
            sub={
              expectedByDay > 0
                ? `incl. +${formatPaiseCompact(expectedByDay)} due by ${date}`
                : `by ${date}`
            }
          />
        </div>

        {/* receivables list */}
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold">Receivables</h2>
              <p className="text-xs text-muted-foreground">
                Money owed to you — slices due by {date} are highlighted
              </p>
            </div>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {openCount} open
            </span>
          </div>

          {/* quick add */}
          {editable ? (
            <div className="flex flex-wrap items-end gap-3 border-b bg-muted/30 px-4 py-3">
              <div className="grid gap-1.5">
                <label className={fieldLabel}>Party</label>
                <Input
                  className="h-9 w-52"
                  placeholder="Payer name…"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <label className={fieldLabel}>Total amount (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-9 w-32 text-right"
                  placeholder="0.00"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <label className={fieldLabel}>Expected amount (₹)</label>
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
              <div className="grid gap-1.5">
                <label className={fieldLabel}>Expected date</label>
                <div className="w-44">
                  <DatePicker
                    selected={expectedDate}
                    onSelect={setExpectedDate}
                    placeholder="Pick a date"
                  />
                </div>
              </div>
              <Button onClick={() => add.mutate()} disabled={!canSubmit}>
                <IconPlus size={15} className="mr-1" />
                Add receivable
              </Button>
            </div>
          ) : null}

          {receivablesQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Party</TableHead>
                  <TableHead className="text-right text-xs">
                    Total Pending
                  </TableHead>
                  <TableHead className="text-right text-xs">Expected</TableHead>
                  <TableHead className="text-xs">Expected Date</TableHead>
                  <TableHead className="text-right text-xs">Received</TableHead>
                  <TableHead className="text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!view || view.receivables.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      <IconReceipt
                        size={26}
                        className="mx-auto mb-2 text-muted-foreground/70"
                      />
                      No receivables yet.
                      {editable ? " Add one above to start tracking." : ""}
                    </TableCell>
                  </TableRow>
                ) : (
                  view.receivables.map((r) => {
                    const due = isDueByDay(r);
                    return (
                      <TableRow
                        key={r.id}
                        className={r.ackReceived ? "opacity-55" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {r.partyName.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-sm font-medium">
                              {r.partyName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <CompactMoney value={r.totalAmount} />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {r.expectedAmount > 0 ? (
                            <CompactMoney
                              className="text-sky-600"
                              value={r.expectedAmount}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.expectedDate ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                                due
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <IconCalendarEvent size={12} />
                              {new Date(r.expectedDate).toLocaleDateString(
                                "en-IN",
                                { day: "2-digit", month: "short" },
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.ackReceived ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <IconCheck size={12} />
                              <CompactMoney
                                value={r.receivedAmount ?? r.totalAmount}
                              />
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              pending
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            {editable && !r.ackReceived ? (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title="Edit"
                                className="text-muted-foreground hover:bg-muted"
                                onClick={() => setEditing(r)}
                              >
                                <IconPencil size={15} />
                              </Button>
                            ) : null}
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <EditReceivableDialog
        receivable={editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      />
    </TooltipProvider>
  );
}
