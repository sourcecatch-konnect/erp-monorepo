"use client";

import * as React from "react";
import { Controller, FormProvider, useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addClaimRecoverySchema } from "@skerp/validators/claims/claim";
import type { AddClaimRecoveryFormInput, ClaimDetail } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Combobox } from "@skerp/ui/components/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { DriverComboboxField } from "@/components/lookups";
import SelectField from "@/features/masters/_shared/fields/SelectField";
import TextAreaField from "@/features/masters/_shared/fields/TextAreaField";
import TextField from "@/features/masters/_shared/fields/TextField";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { labourApi } from "@/features/masters/labour/labour.service";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatPaise } from "@/lib/money";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import { RECOVERY_SOURCE_LABELS, optionsOf, rupeesInput } from "./claim.ui";

const FORM_ID = "add-recovery-form";

type PartyField = "transportId" | "labourId";

/** Server-searched master picker bound to one form field. */
function MasterSearchField({
  name,
  label,
  placeholder,
  search,
}: {
  name: PartyField;
  label: string;
  placeholder: string;
  search: (q: string) => Promise<{ id: string; name: string }[]>;
}) {
  const [text, setText] = React.useState("");
  const debounced = useDebouncedValue(text, 300);
  const [picked, setPicked] = React.useState<{ id: string; name: string } | null>(null);
  // An empty query returns the first 20 rows (crud.factory's /search applies
  // no filter when `q` is blank), so the list is populated the moment the
  // picker opens. Without that it looks broken: an empty box with no hint
  // that anything exists behind it. A single letter is left unsearched —
  // it matches almost everything and the result is noise.
  const term = debounced.trim();
  const results = useQuery({
    queryKey: ["claims", "party-search", name, term],
    queryFn: () => search(term),
    enabled: term.length === 0 || term.length >= 2,
  });
  const rows = [
    ...(picked ? [picked] : []),
    ...(results.data ?? []).filter((row) => row.id !== picked?.id),
  ];

  return (
    <Controller<AddClaimRecoveryFormInput, PartyField>
      name={name}
      render={({ field, fieldState }) => (
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {label} <span className="text-red-600">*</span>
          </label>
          <Combobox
            options={rows.map((row) => ({ value: row.id, label: row.name }))}
            value={field.value ?? ""}
            onChange={(id) => {
              setPicked(rows.find((row) => row.id === id) ?? null);
              field.onChange(id);
            }}
            placeholder={placeholder}
            searchPlaceholder="Type to narrow the list"
            emptyText={
              results.isFetching
                ? "Searching…"
                : term.length === 1
                  ? "Keep typing — one letter is too broad"
                  : "Nothing found"
            }
            searchValue={text}
            onSearchChange={setText}
            invalid={Boolean(fieldState.error)}
            className="min-h-10 rounded-lg"
          />
          {fieldState.error?.message ? (
            <p className="text-xs text-red-600">{fieldState.error.message}</p>
          ) : null}
        </div>
      )}
    />
  );
}

/** What's still left to recover: settled (or claimed) minus non-rejected recoveries. */
export const leftToRecoverPaise = (claim: ClaimDetail) => {
  const cap = claim.settledAmountPaise ?? claim.claimedAmountPaise;
  const committed = claim.recoveries
    .filter((recovery) => recovery.status !== "REJECTED")
    .reduce((sum, recovery) => sum + recovery.amountPaise, 0);
  return Math.max(cap - committed, 0);
};

const valuesOf = (claim: ClaimDetail): DefaultValues<AddClaimRecoveryFormInput> => ({
  version: claim.version,
  source: "INSURANCE",
  // Fixed, not chosen: only the broker that hauled the LR can be recovered
  // from, so it is seeded here and shown read-only on the form.
  transportId: claim.lr.marketTransport?.id ?? undefined,
  partyName: "",
  amount: rupeesInput(leftToRecoverPaise(claim) || null),
  referenceNo: "",
  remarks: "",
});

export function AddRecoveryDialog({
  claim,
  open,
  onOpenChange,
}: {
  claim: ClaimDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<AddClaimRecoveryFormInput>({
    resolver: zodResolver(addClaimRecoverySchema, undefined, { raw: true }),
    defaultValues: valuesOf(claim),
  });

  React.useEffect(() => {
    if (open) form.reset(valuesOf(claim));
  }, [open, claim, form]);

  const source = form.watch("source");
  const leftPaise = leftToRecoverPaise(claim);

  // Accounts, 2026-11-07: an own-fleet consignment has no transporter to
  // recover from — the company carried it and bears the loss. Offering the
  // option anyway would only produce recoveries nobody can ever collect, so
  // it is dropped rather than shown and rejected on save.
  const canRecoverFromTransporter =
    claim.lr.isMarketVehicle && Boolean(claim.lr.marketTransport);
  const sourceOptions = optionsOf(RECOVERY_SOURCE_LABELS).filter(
    (option) => option.value !== "TRANSPORTER" || canRecoverFromTransporter,
  );

  const add = useMutation({
    mutationFn: (values: AddClaimRecoveryFormInput) => claimApi.addRecovery(claim.id, values),
    onSuccess: (updated) => {
      toast.success("Recovery recorded");
      queryClient.setQueryData(claimKeys.detail(claim.id), updated);
      queryClient.invalidateQueries({ queryKey: claimKeys.all });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add recovery</DialogTitle>
          <DialogDescription>
            Who pays part of this loss back. {formatPaise(leftPaise)} is left to recover on this
            claim; split it across several lines if more than one party pays.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit((values) => add.mutate(values))}
            className="grid gap-3 sm:grid-cols-2"
          >
            <SelectField<AddClaimRecoveryFormInput>
              name="source"
              label="Recover from"
              required
              options={sourceOptions}
            />
            {source === "TRANSPORTER" ? (
              // The broker is fixed: only the one that actually hauled the LR
              // can be recovered from, so this is shown, not chosen. The
              // server rejects any other transporter.
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Transporter / broker
                </label>
                <p className="flex min-h-10 items-center rounded-lg border bg-muted/30 px-3 text-sm">
                  {claim.lr.marketTransport?.name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  The broker that hauled {claim.lr.lrNumber}. Recovered by
                  deducting it from their next vendor payment slip.
                </p>
              </div>
            ) : source === "LABOUR" ? (
              <MasterSearchField
                key="labour"
                name="labourId"
                label="Labour gang"
                placeholder="Select a labour gang"
                search={labourApi.search}
              />
            ) : source === "DRIVER" ? (
              <DriverComboboxField<AddClaimRecoveryFormInput>
                name="driverId"
                label="Driver"
                required
              />
            ) : (
              <TextField<AddClaimRecoveryFormInput>
                name="partyName"
                label={source === "INSURANCE" ? "Insurance company" : source === "RAILWAY" ? "Railway office" : "Who pays"}
                required
              />
            )}
            <TextField<AddClaimRecoveryFormInput>
              name="amount"
              label="Amount (₹)"
              placeholder="0.00"
              required
            />
            <TextField<AddClaimRecoveryFormInput>
              name="referenceNo"
              label={source === "INSURANCE" ? "Insurance claim no." : "Reference / debit note no."}
            />
            <div className="sm:col-span-2">
              <TextAreaField<AddClaimRecoveryFormInput> name="remarks" label="Remarks" rows={2} maxLength={500} />
            </div>
            {source === "TRANSPORTER" || source === "DRIVER" ? (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {source === "TRANSPORTER"
                  ? "Deducted later from this transporter's vendor payment slip."
                  : "Deducted later from this driver's salary run."}
              </p>
            ) : null}
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={add.isPending}>
            {add.isPending ? "Saving…" : "Add recovery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
