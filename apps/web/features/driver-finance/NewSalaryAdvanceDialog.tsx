"use client";

import * as React from "react";
import { FormProvider, useForm } from "react-hook-form";
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
import { Textarea } from "@skerp/ui/components/textarea";

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
 * Money given to a driver against his salary — not a trip advance, so it is
 * never on a log slip. Posts immediately: Dr driver, Cr cash / bank. The
 * salary run deducts it automatically because it reads the driver's balance.
 */
export function NewSalaryAdvanceDialog({
  open,
  onOpenChange,
  driverId: presetDriverId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects the driver (e.g. from the driver's statement). */
  driverId?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const driverForm = useForm<{ driverId: string }>({ defaultValues: { driverId: "" } });
  const driverId = driverForm.watch("driverId");

  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState<PaymentMode>("CASH");
  const [paidAt, setPaidAt] = React.useState(today());
  const [referenceNo, setReferenceNo] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [fundingLedgerId, setFundingLedgerId] = React.useState("");
  const [branchId, setBranchId] = React.useState(user?.branchId ?? "");
  const clientRequestIdRef = React.useRef("");

  React.useEffect(() => {
    if (!open) return;
    clientRequestIdRef.current = crypto.randomUUID();
    driverForm.reset({ driverId: presetDriverId ?? "" });
    setAmount("");
    setMode("CASH");
    setPaidAt(today());
    setReferenceNo("");
    setReason("");
    setBranchId(user?.branchId ?? "");
  }, [open, presetDriverId, driverForm, user?.branchId]);

  const balance = useQuery({
    queryKey: [...driverFinanceKeys.balance(driverId), "lite"],
    queryFn: () => driverFinanceApi.balance(driverId, true),
    enabled: open && Boolean(driverId),
  });

  const amountPaise = amount ? BigInt(rupeesToPaise(amount)) : 0n;
  const accounts = useFundingAccounts();
  const account = accounts.byId.get(fundingLedgerId);
  const canSubmit =
    Boolean(driverId) &&
    amountPaise > 0n &&
    Boolean(fundingLedgerId) &&
    !isShort(account, amountPaise) &&
    Boolean(branchId) &&
    Boolean(paidAt);

  const create = useMutation({
    mutationFn: () =>
      driverFinanceApi.createSalaryAdvance({
        driverId,
        branchId,
        amountPaise: amountPaise.toString(),
        paidAt,
        mode,
        referenceNo: referenceNo.trim() || undefined,
        reason: reason.trim() || undefined,
        fundingLedgerId,
        clientRequestId: clientRequestIdRef.current,
      }),
    onSuccess: (advance) => {
      toast.success(`${advance.advanceNumber}: ${money(advance.amountPaise)} advance to ${advance.driver.name}`);
      queryClient.invalidateQueries({ queryKey: driverFinanceKeys.all });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New salary advance</DialogTitle>
          <DialogDescription>
            Money given against salary. It is deducted automatically in the driver&apos;s next salary run.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormProvider {...driverForm}>
            <DriverComboboxField<{ driverId: string }> name="driverId" required showStatusBadge={false} />
          </FormProvider>
          {balance.data ? (
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              Current balance: {describeDriverBalance(balance.data.balancePaise).text} (since{" "}
              {formatDate(balance.data.startDate)})
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (₹)">
              <Input
                id="salary-advance-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Date">
              <Input
                id="salary-advance-date"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </Field>
            <Field label="Mode">
              <PaymentModeSelect id="salary-advance-mode" value={mode} onChange={setMode} />
            </Field>
            <Field label="Reference no.">
              <Input
                id="salary-advance-ref"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="UTR / cheque no."
              />
            </Field>
            <Field label="Paid from">
              <FundingLedgerSelect
                id="salary-advance-funding"
                mode={mode}
                value={fundingLedgerId}
                onChange={setFundingLedgerId}
              />
              <AvailableNote account={account} amountPaise={amountPaise} />
            </Field>
            <Field label="Branch">
              <BranchSelect id="salary-advance-branch" value={branchId} onChange={setBranchId} />
            </Field>
          </div>
          <Field label="Reason (optional)">
            <Textarea
              id="salary-advance-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="resize-none"
              placeholder="e.g. family function, medical"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Saving…" : "Give advance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
