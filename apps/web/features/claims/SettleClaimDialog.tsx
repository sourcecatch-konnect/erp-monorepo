"use client";

import * as React from "react";
import { Controller, FormProvider, useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { settleClaimSchema } from "@skerp/validators/claims/claim";
import type { ClaimDetail, SettleClaimFormInput } from "@skerp/types";
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
import { Skeleton } from "@skerp/ui/components/skeleton";

import SelectField from "@/features/masters/_shared/fields/SelectField";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import TextField from "@/features/masters/_shared/fields/TextField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import {
  PAYMENT_MODE_LABELS,
  SETTLEMENT_MODE_LABELS,
  optionsOf,
  rupeesInput,
  todayInput,
} from "./claim.ui";

const FORM_ID = "settle-claim-form";

const valuesOf = (claim: ClaimDetail): DefaultValues<SettleClaimFormInput> => ({
  version: claim.version,
  settledAmount: rupeesInput(claim.claimedAmountPaise),
  settledAt: todayInput(),
  mode: "RECEIPT_DEDUCTION",
  referenceNo: "",
  note: "",
});

/** Only the fields of the chosen settlement method go to the server. */
const forMode = (values: SettleClaimFormInput): SettleClaimFormInput => ({
  version: values.version,
  settledAmount: values.settledAmount,
  settledAt: values.settledAt,
  mode: values.mode,
  note: values.note,
  referenceNo: values.referenceNo,
  ...(values.mode === "RECEIPT_DEDUCTION" ? { receiptAllocationId: values.receiptAllocationId } : {}),
  ...(values.mode === "CREDIT_NOTE" ? { creditNoteId: values.creditNoteId } : {}),
  ...(values.mode === "PAID_SEPARATELY"
    ? { paymentMode: values.paymentMode, fundingLedgerId: values.fundingLedgerId }
    : {}),
});

/**
 * Settle with the customer: the amount (≤ claimed), the date, and how they
 * were compensated. Above the approval limit it waits for a second user.
 */
export function SettleClaimDialog({
  claim,
  open,
  onOpenChange,
}: {
  claim: ClaimDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<SettleClaimFormInput>({
    resolver: zodResolver(settleClaimSchema, undefined, { raw: true }),
    defaultValues: valuesOf(claim),
  });

  React.useEffect(() => {
    if (open) form.reset(valuesOf(claim));
  }, [open, claim, form]);

  const options = useQuery({
    queryKey: claimKeys.settlementOptions(claim.id),
    queryFn: () => claimApi.settlementOptions(claim.id),
    enabled: open,
  });

  const mode = form.watch("mode");
  const paymentMode = form.watch("paymentMode");
  const typedAmount = Number(String(form.watch("settledAmount") ?? "").replace(/,/g, ""));
  const limitPaise = options.data?.approvalLimitPaise;
  const needsApproval =
    limitPaise !== undefined && Number.isFinite(typedAmount) && typedAmount * 100 > limitPaise;

  const accountGroup = paymentMode === "CASH" ? "CASH" : "BANK";
  const accounts = (options.data?.fundingAccounts ?? []).filter(
    (account) => !paymentMode || account.group === accountGroup,
  );

  const settle = useMutation({
    mutationFn: (values: SettleClaimFormInput) => claimApi.settle(claim.id, forMode(values)),
    onSuccess: (updated) => {
      toast.success(
        updated.status === "SETTLED"
          ? "Claim settled"
          : "Settlement sent for approval — another user with approval rights must approve it",
      );
      queryClient.setQueryData(claimKeys.detail(claim.id), updated);
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const thisLr = (onThisLr: boolean) => (onThisLr ? " · this LR" : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Settle claim {claim.claimNumber}</DialogTitle>
          <DialogDescription>
            {formatPaise(claim.claimedAmountPaise)} claimed by {claim.customer.name}. Record what
            was agreed and how they were compensated.
          </DialogDescription>
        </DialogHeader>

        {options.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <FormProvider {...form}>
            <form
              id={FORM_ID}
              onSubmit={form.handleSubmit((values) => settle.mutate(values))}
              className="grid gap-3 sm:grid-cols-2"
            >
              <TextField<SettleClaimFormInput>
                name="settledAmount"
                label="Settled amount (₹)"
                placeholder="0.00"
                required
              />
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Settlement date <span className="text-red-600">*</span>
                </label>
                <Controller
                  control={form.control}
                  name="settledAt"
                  render={({ field }) => (
                    <Input
                      type="date"
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={field.onChange}
                      max={todayInput()}
                    />
                  )}
                />
              </div>
              <div className="sm:col-span-2">
                <SelectField<SettleClaimFormInput>
                  name="mode"
                  label="How was the customer compensated?"
                  required
                  options={optionsOf(SETTLEMENT_MODE_LABELS)}
                />
              </div>

              {mode === "RECEIPT_DEDUCTION" && (
                <div className="space-y-1 sm:col-span-2">
                  <SelectField<SettleClaimFormInput>
                    name="receiptAllocationId"
                    label="Receipt with the damage deduction"
                    required
                    placeholder={
                      options.data?.receiptAllocations.length
                        ? "Pick the receipt"
                        : "No receipt to link"
                    }
                    options={(options.data?.receiptAllocations ?? []).map((row) => ({
                      value: row.id,
                      label: `${row.receiptNumber ?? "Receipt"} · bill ${row.billNumber ?? "—"} · ${formatPaise(row.damageAmountPaise)} deducted · ${formatDate(row.receivedAt)}${thisLr(row.onThisLr)}`,
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Posted receipts of {claim.customer.name} with a damage deduction no other claim
                    uses. No new voucher — the receipt already booked it.
                  </p>
                </div>
              )}

              {mode === "CREDIT_NOTE" && (
                <div className="space-y-1 sm:col-span-2">
                  <SelectField<SettleClaimFormInput>
                    name="creditNoteId"
                    label="Credit note"
                    required
                    placeholder={
                      options.data?.creditNotes.length ? "Pick the credit note" : "No credit note to link"
                    }
                    options={(options.data?.creditNotes ?? []).map((row) => ({
                      value: row.id,
                      label: `${row.noteNumber} · bill ${row.billNumber ?? "—"} · ${formatPaise(row.amountPaise)}${thisLr(row.onThisLr)}`,
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Credit notes for {claim.customer.name} not linked to another claim. Raise the
                    credit note on the bill first. No new voucher.
                  </p>
                </div>
              )}

              {mode === "PAID_SEPARATELY" && (
                <>
                  <SelectField<SettleClaimFormInput>
                    name="paymentMode"
                    label="Paid by"
                    required
                    options={optionsOf(PAYMENT_MODE_LABELS)}
                  />
                  <SelectField<SettleClaimFormInput>
                    name="fundingLedgerId"
                    label={paymentMode === "CASH" ? "Cash account" : "Bank account"}
                    required
                    placeholder={paymentMode ? "Pick the account" : "Pick how it was paid first"}
                    disabled={!paymentMode}
                    options={accounts.map((account) => ({
                      value: account.id,
                      label: `${account.name} · ${formatPaise(account.balancePaise)} available`,
                    }))}
                  />
                  <TextField<SettleClaimFormInput>
                    name="referenceNo"
                    label="Reference no."
                    placeholder="UTR / cheque no."
                  />
                  <p className="self-end text-xs text-muted-foreground">
                    Posts a payment voucher: damage expense against this account.
                  </p>
                </>
              )}

              <div className="sm:col-span-2">
                <TextAreaField<SettleClaimFormInput> name="note" label="Note" rows={2} maxLength={500} />
              </div>

              {needsApproval && limitPaise !== undefined ? (
                <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm sm:col-span-2">
                  Above {formatPaise(limitPaise)}: another user with approval rights must approve it
                  before the claim is settled.
                </p>
              ) : null}
            </form>
          </FormProvider>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={settle.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={options.isLoading || settle.isPending}>
            {settle.isPending ? "Saving…" : needsApproval ? "Send for approval" : "Settle claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
