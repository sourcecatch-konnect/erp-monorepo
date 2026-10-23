"use client";

import * as React from "react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Input } from "@skerp/ui/components/input";

import { useAuth } from "@/features/auth";
import DriverComboboxField from "@/components/lookups/DriverComboboxField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import {
  Field,
  formatDate,
  money,
  rupeesToPaise,
  today,
} from "@/features/vendor-payment/vendor-payment.ui";
import {
  driverFinanceApi,
  driverFinanceKeys,
  type DriverPayout,
  type PaymentMode,
} from "./driver-finance.service";
import {
  BranchSelect,
  FundingLedgerSelect,
  AvailableNote,
  PaymentModeSelect,
  describeDriverBalance,
  isShort,
  useFundingAccounts,
} from "./driver-finance.ui";

/**
 * MANUAL   — pick (or pass) a driver; the amount is capped at what his ledger
 *            says we owe him.
 * LOG_SLIP — driver fixed; capped at the log slip's unpaid payable. Used by
 *            the log slip's "Paid in cash" button.
 */
export type PayDriverTarget =
  | { kind: "MANUAL"; driverId?: string; driverName?: string }
  | {
      kind: "LOG_SLIP";
      logSlipId: string;
      logSlipNumber: string | null;
      driverId: string;
      driverName: string;
      remainingPaise: string;
    };

const paiseToRupeeInput = (paise: bigint) => (Number(paise) / 100).toFixed(2);

export function PayDriverDialog({
  open,
  onOpenChange,
  target,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: PayDriverTarget;
  onPaid?: (payout: DriverPayout) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const driverForm = useForm<{ driverId: string }>({
    defaultValues: { driverId: target.driverId ?? "" },
  });
  const driverId = driverForm.watch("driverId");

  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState<PaymentMode>("CASH");
  const [paidAt, setPaidAt] = React.useState(today());
  const [referenceNo, setReferenceNo] = React.useState("");
  const [fundingLedgerId, setFundingLedgerId] = React.useState("");
  const [branchId, setBranchId] = React.useState(user?.branchId ?? "");
  // One id per opening of the dialog — reused if the same attempt is retried.
  const clientRequestIdRef = React.useRef("");

  // Loaded for both kinds: MANUAL caps at it; LOG_SLIP warns when the ledger
  // says less is owed than this payment (it may already have been paid).
  const balance = useQuery({
    queryKey: driverFinanceKeys.balance(driverId),
    queryFn: () => driverFinanceApi.balance(driverId),
    enabled: open && Boolean(driverId),
  });
  const ledgerOwedPaise = balance.data
    ? describeDriverBalance(balance.data.balancePaise).owedPaise
    : null;

  // MANUAL: what we owe minus approved-but-unpaid salary (that is paid from
  // its salary run — paying it here would pay it twice).
  const salaryDuePaise = balance.data ? BigInt(balance.data.salaryDue.amountPaise) : 0n;
  const capPaise =
    target.kind === "LOG_SLIP"
      ? BigInt(target.remainingPaise)
      : balance.data
        ? (() => {
            const owed = describeDriverBalance(balance.data.balancePaise).owedPaise;
            return owed > salaryDuePaise ? owed - salaryDuePaise : 0n;
          })()
        : null;

  // A primitive key, so callers may pass a fresh `target` object every render
  // without resetting the form while it is open.
  const targetKey =
    target.kind === "LOG_SLIP"
      ? `slip:${target.logSlipId}:${target.remainingPaise}`
      : `manual:${target.driverId ?? ""}`;

  React.useEffect(() => {
    if (!open) return;
    clientRequestIdRef.current = crypto.randomUUID();
    driverForm.reset({ driverId: target.driverId ?? "" });
    setMode("CASH");
    setPaidAt(today());
    setReferenceNo("");
    setBranchId(user?.branchId ?? "");
    setAmount(target.kind === "LOG_SLIP" ? paiseToRupeeInput(BigInt(target.remainingPaise)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- targetKey stands in for target
  }, [open, targetKey, driverForm, user?.branchId]);

  // Pre-fill the amount with what we owe once the selected driver's balance loads.
  React.useEffect(() => {
    if (open && target.kind === "MANUAL" && capPaise !== null && capPaise > 0n) {
      setAmount(paiseToRupeeInput(capPaise));
    }
  }, [open, target.kind, capPaise]);

  const amountPaise = amount ? BigInt(rupeesToPaise(amount)) : 0n;
  const overCap = capPaise !== null && amountPaise > capPaise;
  const accounts = useFundingAccounts();
  const account = accounts.byId.get(fundingLedgerId);
  const notEnoughMoney = isShort(account, amountPaise);
  const canSubmit =
    Boolean(driverId) &&
    amountPaise > 0n &&
    !overCap &&
    !notEnoughMoney &&
    Boolean(fundingLedgerId) &&
    Boolean(paidAt) &&
    (target.kind === "LOG_SLIP" || Boolean(branchId));

  const pay = useMutation({
    mutationFn: () =>
      driverFinanceApi.createPayout({
        driverId,
        amountPaise: amountPaise.toString(),
        paidAt,
        mode,
        referenceNo: referenceNo.trim() || undefined,
        fundingLedgerId,
        clientRequestId: clientRequestIdRef.current,
        ...(target.kind === "LOG_SLIP"
          ? { source: "LOG_SLIP" as const, logSlipId: target.logSlipId }
          : { source: "MANUAL" as const, branchId }),
      }),
    onSuccess: (payout) => {
      toast.success(`${payout.payoutNumber}: ${money(payout.amountPaise)} paid to ${payout.driver.name}`);
      queryClient.invalidateQueries({ queryKey: driverFinanceKeys.all });
      onPaid?.(payout);
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const driverName =
    target.kind === "LOG_SLIP" ? target.driverName : (balance.data?.driver.name ?? target.driverName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {target.kind === "LOG_SLIP" ? "Log slip balance paid in cash" : "Pay driver"}
          </DialogTitle>
          <DialogDescription>
            {target.kind === "LOG_SLIP"
              ? `Records the cash handed to ${target.driverName} for log slip ${target.logSlipNumber ?? ""}, so the same amount is not paid again with his salary.`
              : "Records money paid to a driver: Dr driver, Cr the cash / bank account."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {target.kind === "MANUAL" && !target.driverId ? (
            <FormProvider {...driverForm}>
              <DriverComboboxField<{ driverId: string }> name="driverId" required showStatusBadge={false} />
            </FormProvider>
          ) : (
            <p className="text-sm">
              Driver: <span className="font-medium">{driverName ?? "—"}</span>
            </p>
          )}

          {capPaise !== null ? (
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {target.kind === "LOG_SLIP"
                ? `Unpaid on this log slip: ${money(capPaise)}`
                : balance.data
                  ? `${describeDriverBalance(balance.data.balancePaise).text} (since ${formatDate(balance.data.startDate)})`
                  : null}
            </p>
          ) : null}

          {target.kind === "MANUAL" && salaryDuePaise > 0n ? (
            <p className="rounded-md border border-sky-500/40 bg-sky-500/5 px-3 py-2 text-xs text-sky-800 dark:text-sky-300">
              {money(salaryDuePaise)} of this is <strong>approved salary</strong> (
              {balance.data?.salaryDue.runNumbers.join(", ")}). Pay it with{" "}
              <strong>Pay salaries</strong> on that run, not here. Payable here:{" "}
              {money(capPaise ?? 0n)}.
            </p>
          ) : null}

          {/* MANUAL: an unpaid log slip balance should be paid from its log slip,
              or the log slip keeps showing it as unpaid and it gets paid twice. */}
          {target.kind === "MANUAL" && balance.data?.unpaidLogSlips.count ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
              <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                <IconAlertTriangle size={14} /> Unpaid log slip balances
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pay these with <strong>Paid in cash</strong> on the log slip, so the log slip is marked
                paid. Paying them here leaves them showing as unpaid.
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {balance.data.unpaidLogSlips.items.map((slip) => (
                  <li key={slip.id} className="flex justify-between gap-3">
                    <Link
                      href={`/vehicle-journeys/${slip.journeyId}/log-slip`}
                      className="text-primary hover:underline"
                    >
                      {slip.logSlipNumber ?? "Log slip"} · {formatDate(slip.logSlipDate)}
                    </Link>
                    <span className="tabular-nums">{money(slip.remainingPaise)}</span>
                  </li>
                ))}
              </ul>
              {balance.data.unpaidLogSlips.count > balance.data.unpaidLogSlips.items.length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  and {balance.data.unpaidLogSlips.count - balance.data.unpaidLogSlips.items.length} more
                </p>
              ) : null}
            </div>
          ) : null}

          {/* LOG_SLIP: the ledger owes less than this payment — it may have been
              paid already, e.g. as a manual payment. */}
          {target.kind === "LOG_SLIP" && ledgerOwedPaise !== null && amountPaise > ledgerOwedPaise ? (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {target.driverName}&apos;s ledger shows{" "}
                {ledgerOwedPaise > 0n ? `only ${money(ledgerOwedPaise)} owed to him` : "nothing owed to him"}.
                This balance may already have been paid (for example as a manual payment) — check
                Driver Payments before paying. If he also owes a salary advance, paying is still
                correct; the salary run recovers the advance.
              </span>
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (₹)">
              <Input
                id="pay-driver-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                aria-invalid={overCap || undefined}
              />
              {overCap ? (
                <p className="text-xs text-destructive">More than the {money(capPaise!)} that is due</p>
              ) : null}
            </Field>
            <Field label="Date">
              <Input
                id="pay-driver-date"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </Field>
            <Field label="Mode">
              <PaymentModeSelect id="pay-driver-mode" value={mode} onChange={setMode} />
            </Field>
            <Field label="Reference no.">
              <Input
                id="pay-driver-ref"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="UTR / cheque no."
              />
            </Field>
            <Field label="Paid from">
              <FundingLedgerSelect
                id="pay-driver-funding"
                mode={mode}
                value={fundingLedgerId}
                onChange={setFundingLedgerId}
              />
              <AvailableNote account={account} amountPaise={amountPaise} />
            </Field>
            {target.kind === "MANUAL" ? (
              <Field label="Branch">
                <BranchSelect id="pay-driver-branch" value={branchId} onChange={setBranchId} />
              </Field>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pay.isPending}>
            Cancel
          </Button>
          <Button onClick={() => pay.mutate()} disabled={!canSubmit || pay.isPending}>
            {pay.isPending ? "Paying…" : amountPaise > 0n ? `Pay ${money(amountPaise)}` : "Pay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
