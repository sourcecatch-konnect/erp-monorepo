"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus, IconTrash, IconCheck } from "@tabler/icons-react";

import type { CashPlanDayView, CreateCashReceivableBody } from "@skerp/types";
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
import { formatPaise } from "@/lib/money";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";

type Props = {
  day: CashPlanDayView;
  date: string;
  canEnter: boolean;
};

export default function ReceivablesPanel({ day, date, canEnter }: Props) {
  const queryClient = useQueryClient();
  const editable = canEnter && day.status === "OPEN";
  const setDay = (view: CashPlanDayView) =>
    queryClient.setQueryData(cashPlanningKeys.day(date), view);

  const [party, setParty] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [expected, setExpected] = React.useState("");

  const add = useMutation({
    mutationFn: () => {
      const body: CreateCashReceivableBody = {
        partyName: party.trim(),
        amount: Math.round(Number(amount) * 100),
        expectedDate: expected || undefined,
        note: undefined,
      };
      return cashPlanningApi.addReceivable(day.id, body);
    },
    onSuccess: (view) => {
      setDay(view);
      setParty("");
      setAmount("");
      setExpected("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  const received = useMutation({
    mutationFn: ({ id, amt }: { id: string; amt: number }) =>
      cashPlanningApi.markReceived(id, amt),
    onSuccess: (view) => setDay(view),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cashPlanningApi.deleteReceivable(id),
    onSuccess: (view) => setDay(view),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const canSubmit = party.trim().length > 0 && Number(amount) > 0 && !add.isPending;

  return (
    <div className="space-y-4">
      {/* forecast summary */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border text-sm">
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Available Cash</p>
          <p className="font-semibold">{formatPaise(day.availableCash)}</p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Expected Receivables</p>
          <p className="font-semibold text-sky-600">
            +{formatPaise(day.expectedReceivables)}
          </p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Projected Cash</p>
          <p className="font-semibold text-emerald-600">
            {formatPaise(day.projectedCash)}
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        {editable ? (
          <div className="flex flex-wrap items-end gap-2 border-b bg-muted/30 px-4 py-3">
            <div className="grid gap-1">
              <label className="text-[11px] text-muted-foreground">Party</label>
              <Input
                className="h-8 w-48"
                placeholder="Payer name…"
                value={party}
                onChange={(e) => setParty(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-[11px] text-muted-foreground">Amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                className="h-8 w-28 text-right"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-[11px] text-muted-foreground">Expected on</label>
              <Input
                type="date"
                className="h-8"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => add.mutate()} disabled={!canSubmit}>
              <IconPlus size={15} className="mr-1" />
              Add
            </Button>
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {day.receivables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No receivables recorded.
                </TableCell>
              </TableRow>
            ) : (
              day.receivables.map((r) => (
                <TableRow key={r.id} className={r.ackReceived ? "opacity-60" : ""}>
                  <TableCell className="text-sm font-medium">{r.partyName}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatPaise(r.amount)}
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
                        {formatPaise(r.receivedAmount ?? r.amount)}
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
                          onClick={() => received.mutate({ id: r.id, amt: r.amount })}
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
      </div>
    </div>
  );
}
