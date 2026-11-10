"use client";

import * as React from "react";
import { Controller, FormProvider, useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { receiveClaimRecoverySchema } from "@skerp/validators/claims/claim";
import type { ClaimDetail, ReceiveClaimRecoveryFormInput } from "@skerp/types";
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

import SelectField from "@/features/masters/_shared/fields/SelectField";
import TextField from "@/features/masters/_shared/fields/TextField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { formatPaise } from "@/lib/money";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import { PAYMENT_MODE_LABELS, optionsOf, todayInput } from "./claim.ui";

const FORM_ID = "receive-recovery-form";

type Recovery = ClaimDetail["recoveries"][number];

/** Money from insurance, labour, railway or another party came in. Posts a receipt voucher. */
export function ReceiveRecoveryDialog({
  claim,
  recovery,
  onOpenChange,
}: {
  claim: ClaimDetail;
  recovery: Recovery | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const open = recovery !== null;
  const valuesOf = React.useCallback(
    (): DefaultValues<ReceiveClaimRecoveryFormInput> => ({
      version: claim.version,
      receivedAt: todayInput(),
      referenceNo: recovery?.referenceNo ?? "",
    }),
    [claim.version, recovery],
  );
  const form = useForm<ReceiveClaimRecoveryFormInput>({
    resolver: zodResolver(receiveClaimRecoverySchema, undefined, { raw: true }),
    defaultValues: valuesOf(),
  });

  React.useEffect(() => {
    if (open) form.reset(valuesOf());
  }, [open, valuesOf, form]);

  const accounts = useQuery({
    queryKey: claimKeys.fundingAccounts(claim.id),
    queryFn: () => claimApi.fundingAccounts(claim.id),
    enabled: open,
  });
  const paymentMode = form.watch("paymentMode");
  const group = paymentMode === "CASH" ? "CASH" : "BANK";

  const receive = useMutation({
    mutationFn: (values: ReceiveClaimRecoveryFormInput) =>
      claimApi.receiveRecovery(claim.id, recovery!.id, values),
    onSuccess: (updated) => {
      toast.success("Recovery received — receipt voucher posted");
      queryClient.setQueryData(claimKeys.detail(claim.id), updated);
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recovery received</DialogTitle>
          <DialogDescription>
            {recovery
              ? `${formatPaise(recovery.amountPaise)} from ${recovery.partyName ?? "—"}. Posts a receipt voucher: this account against Damage Recovery.`
              : null}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit((values) => receive.mutate(values))}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Received on <span className="text-red-600">*</span>
              </label>
              <Controller
                control={form.control}
                name="receivedAt"
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
            <SelectField<ReceiveClaimRecoveryFormInput>
              name="paymentMode"
              label="Received by"
              required
              options={optionsOf(PAYMENT_MODE_LABELS)}
            />
            <SelectField<ReceiveClaimRecoveryFormInput>
              name="fundingLedgerId"
              label={paymentMode === "CASH" ? "Into cash account" : "Into bank account"}
              required
              disabled={!paymentMode}
              placeholder={paymentMode ? "Pick the account" : "Pick how it came first"}
              options={(accounts.data ?? [])
                .filter((account) => account.group === group)
                .map((account) => ({ value: account.id, label: account.name }))}
            />
            <TextField<ReceiveClaimRecoveryFormInput>
              name="referenceNo"
              label="Reference no."
              placeholder="UTR / cheque no."
            />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={receive.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={receive.isPending}>
            {receive.isPending ? "Saving…" : "Mark received"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
