"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Input } from "@skerp/ui/components/input";

import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { cn } from "@/lib/utils";
import { Field, money, rupeesToPaise, today } from "@/features/vendor-payment/vendor-payment.ui";
import {
  driverFinanceApi,
  driverFinanceKeys,
  type DriverSalaryRun,
  type PaymentMode,
} from "./driver-finance.service";
import {
  AvailableNote,
  FundingLedgerSelect,
  PaymentModeSelect,
  isShort,
  useFundingAccounts,
} from "./driver-finance.ui";

/** What is still due to each driver from this run (net pay − paid so far). */
export const outstandingOf = (line: DriverSalaryRun["salaries"][number]) => {
  const left = BigInt(line.netPaise) - BigInt(line.paidPaise);
  return left > 0n ? left : 0n;
};

/** One account the salaries are paid from, with the amount taken from it. */
type SourceRow = { key: number; mode: PaymentMode; fundingLedgerId: string; amount: string };

const paiseToInput = (paise: bigint) => (Number(paise) / 100).toFixed(2);
const amountOf = (row: SourceRow) => (row.amount.trim() ? BigInt(rupeesToPaise(row.amount)) : 0n);

export function PaySalaryRunDialog({
  open,
  onOpenChange,
  run,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: DriverSalaryRun;
}) {
  const queryClient = useQueryClient();
  const accounts = useFundingAccounts();
  const due = React.useMemo(
    () => run.salaries.filter((line) => outstandingOf(line) > 0n),
    [run.salaries],
  );

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [paidAt, setPaidAt] = React.useState(today());
  const [referenceNo, setReferenceNo] = React.useState("");
  const [sources, setSources] = React.useState<SourceRow[]>([]);
  const nextKey = React.useRef(1);
  const clientRequestIdRef = React.useRef("");

  const totalPaise = due
    .filter((line) => selected.has(line.driverId))
    .reduce((sum, line) => sum + outstandingOf(line), 0n);

  React.useEffect(() => {
    if (!open) return;
    clientRequestIdRef.current = crypto.randomUUID();
    setSelected(new Set(due.map((line) => line.driverId)));
    setPaidAt(today());
    setReferenceNo("");
    setSources([{ key: nextKey.current++, mode: "BANK", fundingLedgerId: "", amount: "" }]);
  }, [open, due]);

  // With a single account, its amount simply follows the total.
  React.useEffect(() => {
    setSources((rows) =>
      rows.length === 1 ? [{ ...rows[0]!, amount: paiseToInput(totalPaise) }] : rows,
    );
  }, [totalPaise]);

  const sourcesPaise = sources.reduce((sum, row) => sum + amountOf(row), 0n);
  const difference = totalPaise - sourcesPaise;
  const shortRows = sources.filter((row) => isShort(accounts.byId.get(row.fundingLedgerId), amountOf(row)));

  const updateRow = (key: number, patch: Partial<SourceRow>) =>
    setSources((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  // A new account takes whatever is still missing.
  const addRow = () =>
    setSources((rows) => [
      ...rows,
      {
        key: nextKey.current++,
        mode: "CASH",
        fundingLedgerId: "",
        amount: difference > 0n ? paiseToInput(difference) : "",
      },
    ]);

  const toggle = (driverId: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(driverId);
      else next.delete(driverId);
      return next;
    });

  const canPay =
    selected.size > 0 &&
    Boolean(paidAt) &&
    totalPaise > 0n &&
    difference === 0n &&
    shortRows.length === 0 &&
    sources.every((row) => row.fundingLedgerId && amountOf(row) > 0n);

  const pay = useMutation({
    mutationFn: () =>
      driverFinanceApi.paySalaryRun(run.id, {
        driverIds: [...selected],
        paidAt,
        referenceNo: referenceNo.trim() || undefined,
        sources: sources.map((row) => ({
          fundingLedgerId: row.fundingLedgerId,
          mode: row.mode,
          amountPaise: amountOf(row).toString(),
        })),
        clientRequestId: clientRequestIdRef.current,
      }),
    onSuccess: (updated) => {
      toast.success(
        updated.status === "PAID"
          ? `${updated.runNumber}: all salaries paid`
          : `${updated.runNumber}: ${money(totalPaise)} paid`,
      );
      queryClient.invalidateQueries({ queryKey: driverFinanceKeys.all });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const allChecked = due.length > 0 && due.every((line) => selected.has(line.driverId));
  const usedIds = sources.map((row) => row.fundingLedgerId).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pay salaries — {run.monthLabel}</DialogTitle>
          <DialogDescription>
            Tick the drivers, then choose the account(s) to pay from. One account short? Add another —
            the accounts are used in order, so a driver can be paid from two.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-52 overflow-y-auto rounded-md border">
          <label className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-semibold">
            <Checkbox
              id="pay-run-all"
              checked={allChecked}
              onCheckedChange={(checked) =>
                setSelected(checked ? new Set(due.map((l) => l.driverId)) : new Set())
              }
            />
            All drivers ({due.length})
          </label>
          {due.map((line) => (
            <label
              key={line.driverId}
              className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"
            >
              <span className="flex items-center gap-3">
                <Checkbox
                  id={`pay-run-${line.driverId}`}
                  checked={selected.has(line.driverId)}
                  onCheckedChange={(checked) => toggle(line.driverId, Boolean(checked))}
                />
                {line.driver.name}
              </span>
              <span className="tabular-nums">{money(outstandingOf(line))}</span>
            </label>
          ))}
          {!due.length ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing is due.</p>
          ) : null}
        </div>

        {/* Accounts to pay from */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Pay from</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addRow}
              disabled={sources.length >= 10}
            >
              <IconPlus size={14} className="mr-1" /> Add account
            </Button>
          </div>
          {sources.map((row, index) => {
            const account = accounts.byId.get(row.fundingLedgerId);
            return (
              <div key={row.key} className="rounded-md border p-3">
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr_9rem_auto] sm:items-start">
                  <PaymentModeSelect
                    id={`pay-run-mode-${row.key}`}
                    value={row.mode}
                    onChange={(mode) => updateRow(row.key, { mode })}
                  />
                  <FundingLedgerSelect
                    id={`pay-run-funding-${row.key}`}
                    mode={row.mode}
                    value={row.fundingLedgerId}
                    onChange={(fundingLedgerId) => updateRow(row.key, { fundingLedgerId })}
                    exclude={usedIds}
                  />
                  <Input
                    aria-label={`Amount from account ${index + 1}`}
                    inputMode="decimal"
                    className="text-right"
                    value={row.amount}
                    disabled={sources.length === 1}
                    onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                  />
                  {sources.length > 1 ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove this account"
                      onClick={() => setSources((rows) => rows.filter((r) => r.key !== row.key))}
                    >
                      <IconTrash size={15} />
                    </Button>
                  ) : null}
                </div>
                <div className="mt-1">
                  <AvailableNote account={account} amountPaise={amountOf(row)} />
                </div>
              </div>
            );
          })}
          <p
            className={cn(
              "text-right text-sm tabular-nums",
              difference !== 0n ? "text-destructive" : "text-muted-foreground",
            )}
          >
            To pay {money(totalPaise)} · From accounts {money(sourcesPaise)}
            {difference > 0n ? ` · ${money(difference)} still to cover` : ""}
            {difference < 0n ? ` · ${money(-difference)} too much` : ""}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date">
            <Input
              id="pay-run-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </Field>
          <Field label="Reference no.">
            <Input
              id="pay-run-ref"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Batch / UTR no."
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pay.isPending}>
            Cancel
          </Button>
          <Button onClick={() => pay.mutate()} disabled={!canPay || pay.isPending}>
            {pay.isPending
              ? "Paying…"
              : `Pay ${selected.size} driver${selected.size === 1 ? "" : "s"} · ${money(totalPaise)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
