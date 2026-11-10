"use client";

import * as React from "react";
import { FormProvider, useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { claimAssessmentSchema } from "@skerp/validators/claims/claim";
import type { ClaimAssessmentFormInput, ClaimDetail } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import SelectField from "@/features/masters/_shared/fields/SelectField";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import TextField from "@/features/masters/_shared/fields/TextField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import { CLAIM_CAUSE_LABELS, CLAIM_TYPE_LABELS, optionsOf, rupeesInput } from "./claim.ui";

const FORM_ID = "assess-claim-form";

const valuesOf = (claim: ClaimDetail): DefaultValues<ClaimAssessmentFormInput> => ({
  version: claim.version,
  customerId: claim.customer.id,
  claimType: claim.claimType,
  // An unassessed claim may not know its cause yet.
  causedBy: claim.causedBy ?? undefined,
  goodsValue: rupeesInput(claim.goodsValuePaise),
  claimedAmount: rupeesInput(claim.claimedAmountPaise || null),
  basisDescription: claim.basisDescription ?? "",
});

/**
 * Assess a pending claim (it becomes ACTIVE) or edit an active claim's
 * assessment. Everything settlement needs is required here.
 */
export function AssessClaimDialog({
  claim,
  open,
  onOpenChange,
}: {
  claim: ClaimDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const assessing = claim.status === "PENDING";

  const form = useForm<ClaimAssessmentFormInput>({
    resolver: zodResolver(claimAssessmentSchema, undefined, { raw: true }),
    defaultValues: valuesOf(claim),
  });

  React.useEffect(() => {
    if (open) form.reset(valuesOf(claim));
  }, [open, claim, form]);

  const save = useMutation({
    mutationFn: (values: ClaimAssessmentFormInput) =>
      assessing ? claimApi.assess(claim.id, values) : claimApi.updateAssessment(claim.id, values),
    onSuccess: (updated) => {
      toast.success(assessing ? "Claim assessed — it can be settled now" : "Assessment saved");
      queryClient.setQueryData(claimKeys.detail(claim.id), updated);
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const customers = [
    { value: claim.lr.consignor.id, label: `${claim.lr.consignor.name} (consignor)` },
    ...(claim.lr.consignee.id !== claim.lr.consignor.id
      ? [{ value: claim.lr.consignee.id, label: `${claim.lr.consignee.name} (consignee)` }]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{assessing ? "Assess claim" : "Edit assessment"}</DialogTitle>
          <DialogDescription>
            {assessing
              ? "Confirm who is claiming, what the goods were worth and who caused the damage. The claim then becomes active and can be settled."
              : "Correct the assessment of this active claim."}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit((values) => save.mutate(values))}
            className="grid gap-3 sm:grid-cols-2"
          >
            <SelectField<ClaimAssessmentFormInput>
              name="customerId"
              label="Claimed by"
              required
              options={customers}
            />
            <SelectField<ClaimAssessmentFormInput>
              name="claimType"
              label="Type"
              required
              options={optionsOf(CLAIM_TYPE_LABELS)}
            />
            <SelectField<ClaimAssessmentFormInput>
              name="causedBy"
              label="Caused by"
              required
              placeholder="Who caused it?"
              options={optionsOf(CLAIM_CAUSE_LABELS)}
            />
            <div className="hidden sm:block" />
            <TextField<ClaimAssessmentFormInput>
              name="goodsValue"
              label="Goods value (₹)"
              placeholder="0.00"
              required
            />
            <TextField<ClaimAssessmentFormInput>
              name="claimedAmount"
              label="Claimed amount (₹)"
              placeholder="0.00"
              required
            />
            <div className="sm:col-span-2">
              <TextAreaField<ClaimAssessmentFormInput>
                name="basisDescription"
                label="Basis of claim"
                rows={3}
                maxLength={1000}
              />
            </div>
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? "Saving…" : assessing ? "Mark assessed" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
