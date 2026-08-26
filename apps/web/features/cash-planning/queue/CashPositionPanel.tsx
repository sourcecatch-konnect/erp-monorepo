"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconBuildingBank,
  IconCash,
  IconDeviceFloppy,
  IconPlus,
} from "@tabler/icons-react";

import type { CashPlanDayView } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { formatPaise } from "@/lib/money";

import { cashPlanningApi } from "../api/cash-planning.service";
import { cashPlanningKeys } from "../api/cash-planning.keys";
import { CompactMoney } from "../components/CompactMoney";
import { AccountActivityPopover, type ActivityEntry } from "./AccountActivityPopover";

type Props = {
  day: CashPlanDayView;
  date: string;
  canEnter: boolean;
};

const toPaise = (rupees: string): number => Math.round(Number(rupees) * 100);
const toRupeeInput = (paise: number): string => (paise / 100).toFixed(2);

export default function CashPositionPanel({ day, date, canEnter }: Props) {
  const queryClient = useQueryClient();
  const editable = canEnter && day.status === "OPEN";

  // Drill-down entries for the Received column: every positive adjustment
  // today (receipt credits + manual "add funds"), grouped by account.
  const receivedByAccount = React.useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const a of day.adjustments) {
      if (a.amountPaise <= 0) continue;
      const list = map.get(a.accountId) ?? [];
      list.push({
        id: a.id,
        label: a.receiptId ? a.reason : "Manual add funds",
        detail: a.receiptId ? undefined : a.reason,
        amountPaise: a.amountPaise,
        at: a.createdAt,
        tag: a.receiptId ? "receipt" : "manual",
      });
      map.set(a.accountId, list);
    }
    for (const list of map.values()) {
      list.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
    }
    return map;
  }, [day.adjustments]);

  // Drill-down entries for the Payment column: approved payments from the
  // queue + negative/correction adjustments today, grouped by account.
  const paymentByAccount = React.useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const a of day.adjustments) {
      if (a.amountPaise >= 0) continue;
      const list = map.get(a.accountId) ?? [];
      list.push({
        id: a.id,
        label: "Correction",
        detail: a.reason,
        amountPaise: -a.amountPaise,
        at: a.createdAt,
        tag: "correction",
      });
      map.set(a.accountId, list);
    }
    for (const p of day.payments) {
      if (p.status !== "APPROVED" || !p.fromAccountId) continue;
      const list = map.get(p.fromAccountId) ?? [];
      list.push({
        id: p.id,
        label: p.payeeName,
        detail: p.creditor?.name,
        amountPaise: p.amount,
        at: p.approvedAt ?? p.createdAt,
        tag: "payment",
      });
      map.set(p.fromAccountId, list);
    }
    for (const list of map.values()) {
      list.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
    }
    return map;
  }, [day.adjustments, day.payments]);

  // Local draft of opening balances (rupee strings), keyed by accountId.
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const next: Record<string, string> = {};
    for (const b of day.balances) next[b.accountId] = toRupeeInput(b.openingBalance);
    setDraft(next);
  }, [day.balances]);

  const save = useMutation({
    mutationFn: () =>
      cashPlanningApi.upsertBalances(day.id, {
        balances: day.balances.map((b) => ({
          accountId: b.accountId,
          openingBalance: toPaise(draft[b.accountId] ?? "0"),
        })),
      }),
    onSuccess: (view) => {
      queryClient.setQueryData(cashPlanningKeys.day(date), view);
      toast.success("Opening balances saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  // "+ Add funds" dialog — logs a manual credit/correction against one
  // account, instead of hand-recomputing and overwriting the opening figure.
  const [adjustFor, setAdjustFor] = React.useState<{ id: string; name: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = React.useState("");
  const [adjustReason, setAdjustReason] = React.useState("");

  const closeAdjustDialog = () => {
    setAdjustFor(null);
    setAdjustAmount("");
    setAdjustReason("");
  };

  const addFunds = useMutation({
    mutationFn: () =>
      cashPlanningApi.addAdjustment(day.id, adjustFor!.id, {
        amountPaise: toPaise(adjustAmount),
        reason: adjustReason.trim(),
      }),
    onSuccess: (view) => {
      queryClient.setQueryData(cashPlanningKeys.day(date), view);
      toast.success("Cash position updated");
      closeAdjustDialog();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add funds"),
  });

  const adjustAmountValid = Number(adjustAmount) !== 0 && !Number.isNaN(Number(adjustAmount));
  const canSubmitAdjustment =
    adjustAmountValid && adjustReason.trim().length >= 3 && !addFunds.isPending;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">Cash Position</h2>
          <p className="text-xs text-muted-foreground">
            Closing = opening + received − payment. Click Received / Payment for details.
          </p>
        </div>
        {editable ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            <IconDeviceFloppy size={15} className="mr-1" />
            {save.isPending ? "Saving…" : "Save balances"}
          </Button>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Account</TableHead>
            <TableHead className="text-right text-xs">Opening</TableHead>
            <TableHead className="text-right text-xs">Received</TableHead>
            <TableHead className="text-right text-xs">Payment</TableHead>
            <TableHead className="text-right text-xs">Closing</TableHead>
            <TableHead className="text-right text-xs">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {day.balances.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                No cash accounts. Add accounts in the Cash Accounts master, then
                re-open the day.
              </TableCell>
            </TableRow>
          ) : (
            day.balances.map((b) => {
              const carriedMismatch =
                b.carriedOpening !== null &&
                b.carriedOpening !== undefined &&
                b.carriedOpening !== b.openingBalance;
              return (
                <TableRow key={b.accountId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {b.account.type === "BANK" ? (
                          <IconBuildingBank size={14} />
                        ) : (
                          <IconCash size={14} />
                        )}
                      </span>
                      <span className="text-sm font-medium">{b.account.name}</span>
                      {carriedMismatch ? (
                        <span
                          title={`Carried forward: ${formatPaise(b.carriedOpening ?? 0)}`}
                          className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700"
                        >
                          edited
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {editable ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9 w-32 text-right"
                        value={draft[b.accountId] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [b.accountId]: e.target.value }))
                        }
                      />
                    ) : (
                      <CompactMoney value={b.openingBalance} />
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-emerald-600">
                    <AccountActivityPopover
                      accountName={b.account.name}
                      columnLabel="Received today"
                      total={b.receivedTotal}
                      entries={receivedByAccount.get(b.accountId) ?? []}
                      emptyLabel="No receipts or funds added today"
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm text-red-600">
                    <AccountActivityPopover
                      accountName={b.account.name}
                      columnLabel="Payment today"
                      total={b.paymentTotal}
                      entries={paymentByAccount.get(b.accountId) ?? []}
                      emptyLabel="No payments made today"
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <CompactMoney value={b.closingBalance} />
                  </TableCell>
                  <TableCell className="text-right">
                    {editable ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Add funds / correction"
                        className="text-muted-foreground hover:bg-muted"
                        onClick={() =>
                          setAdjustFor({ id: b.accountId, name: b.account.name })
                        }
                      >
                        <IconPlus size={15} />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="grid grid-cols-5 gap-px border-t bg-border text-sm">
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total Opening</p>
          <CompactMoney className="text-base font-semibold" value={day.totalOpening} />
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Received</p>
          <CompactMoney
            className="text-base font-semibold text-emerald-600"
            value={day.totalReceived}
          />
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Payment</p>
          <CompactMoney
            className="text-base font-semibold text-red-600"
            value={day.totalPayment}
          />
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Approved</p>
          <CompactMoney
            className="text-base font-semibold text-destructive"
            value={day.approvedTotal}
          />
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Available Cash</p>
          <CompactMoney
            className={
              day.availableCash < 0
                ? "text-base font-semibold text-destructive"
                : "text-base font-semibold text-emerald-600"
            }
            value={day.availableCash}
          />
        </div>
      </div>

      <Dialog open={adjustFor !== null} onOpenChange={(open) => !open && closeAdjustDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add funds / correction — {adjustFor?.name}</DialogTitle>
            <DialogDescription>
              A positive amount shows up in the <strong>Received</strong> column
              (e.g. owner topped up cash). A negative amount shows up in the{" "}
              <strong>Payment</strong> column as a correction (e.g. cash
              shortage). Recorded with a reason for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Amount (₹) — use a minus sign for a correction
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 20000 or -500"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
              {adjustAmountValid ? (
                <p
                  className={`text-xs font-medium ${
                    Number(adjustAmount) > 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  Will be recorded as{" "}
                  {Number(adjustAmount) > 0 ? "Received" : "Payment (correction)"}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Reason
              </label>
              <Textarea
                value={adjustReason}
                maxLength={280}
                placeholder="e.g. Owner deposited extra cash"
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeAdjustDialog}
              disabled={addFunds.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => addFunds.mutate()}
              disabled={!canSubmitAdjustment}
            >
              {addFunds.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
