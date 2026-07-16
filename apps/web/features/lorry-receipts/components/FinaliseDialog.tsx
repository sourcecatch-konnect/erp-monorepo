"use client";

import * as React from "react";
import {  useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { finaliseGroupSchema } from "@skerp/validators/lr-group";
import type { EwayBill,  FinaliseGroupFormInput, FinaliseGroupBody} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";

function getMissingLrFields(lr?: LrRow) {
  if (!lr) return ["lr"];

  const missing = new Set(lr.missingFields ?? []);

  if (!lr.invoiceNumber?.trim()) {
    missing.add("invoiceNumber");
  }

  if (lr.invoiceAmount == null) {
    missing.add("invoiceAmount");
  }

  if (!lr.ewayBill) {
    missing.add("ewayBill");
  }

  return Array.from(missing);
}
function getMissingMessage(missingFields: string[]) {
  const labels: Record<string, string> = {
    invoiceNumber: "Invoice required",
    invoiceAmount: "Invoice amount required",
    ewayBill: "E-way bill required",
  };

  if (missingFields.length === 0) {
    return "Ready to finalise";
  }

  if (missingFields.length === 1) {
    return labels[missingFields[0]!] ?? "Details required";
  }

  return `${missingFields.length} details required`;
}
type LrRow = {
  id: string;
  lrNumber: string;
  loadingLocation?: { name: string } | null;
  unloadingLocation?: { name: string } | null;
  invoiceNumber?: string | null;
  invoiceAmount?: number | null;
  ewayBill?: EwayBill | null;
  missingFields: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupNumber: string;
  lrs: LrRow[];
  /** Pre-fill freight from the order's booking freight in rupees. */
  defaultFreight?: number | null;
  isPending: boolean;
  onConfirm: (data: FinaliseGroupFormInput) => void;
};


function buildRows(lrs: LrRow[]) {
  return lrs.map((lr) => ({
    lrId: lr.id,
  }));
}
export default function FinaliseDialog({
  open,
  onOpenChange,
  groupNumber,
  lrs,
  defaultFreight,
  isPending,
  onConfirm,
}: Props) {


  const form = useForm<FinaliseGroupFormInput, unknown, FinaliseGroupBody>({
  resolver: zodResolver(finaliseGroupSchema, undefined, { raw: true }),
  mode: "onChange",
  reValidateMode: "onChange",
  defaultValues: {
    baseFreightAmount: (defaultFreight ?? "") as unknown as number,
    sealNumber: "",
    lrs: buildRows(lrs),
  },
});
  React.useEffect(() => {
    if (!open) return;
    form.reset({
      baseFreightAmount: (defaultFreight ?? "") as unknown as number,
      sealNumber: "",
      lrs: buildRows(lrs),
    });
  }, [defaultFreight, form, lrs, open]);

  const { fields } = useFieldArray({ control: form.control, name: "lrs" });
  const errors = form.formState.errors;
const incompleteLrs = lrs.filter(
  (lr) => getMissingLrFields(lr).length > 0,
);

const hasIncompleteLr = incompleteLrs.length > 0;
 const onSubmit = (values: FinaliseGroupFormInput) => {
  console.log("Valid finalise values:", values);
  onConfirm(values);
};

const onInvalid = (formErrors: typeof form.formState.errors) => {
  console.error("Finalise validation errors:", formErrors);
};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-screen w-full overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-4xl"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>
            {lrs.length === 1
              ? `Finalise LR ${lrs[0]!.lrNumber}`
              : `Finalise group ${groupNumber} — ${lrs.length} LRs`}
          </SheetTitle>
          <SheetDescription>
            {lrs.length === 1
              ? "Confirm the truck-level freight and paperwork for this LR."
              : "Enter truck-level freight once, then complete invoice and e-way bill details for each LR."}
          </SheetDescription>
        </SheetHeader>

       <form
  id="finalise-group-form"
  onSubmit={form.handleSubmit(onSubmit, onInvalid)}
  className="min-h-0 flex-1 overflow-y-auto p-4"
>
          <div className="space-y-4">
            <section className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Base freight (Rs.) <span className="text-red-600">*</span>
                </label>
                <Input
                  {...form.register("baseFreightAmount")}
                  type="number"
                  min={0}
                  placeholder="0"
                  className="h-9"
                />
                {errors.baseFreightAmount?.message ? (
                  <p className="mt-1 text-xs text-red-600">
                    {String(errors.baseFreightAmount.message)}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Seal number
                </label>
                <Input
                  {...form.register("sealNumber")}
                  placeholder="e.g. SEAL-0098"
                  className="h-9"
                />
              </div>
            </section>

            <div className="space-y-3">
              {fields.map((field, idx) => {
  const lr = lrs[idx];
  const base = `lrs.${idx}` as const;

  const missingFields = getMissingLrFields(lr);
  const isReadyToFinalise = missingFields.length === 0;

  return (
    <section
      key={field.id}
      className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
    >
      <input
        type="hidden"
        {...form.register(`${base}.lrId`)}
      />

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {lr?.lrNumber}
        </p>

        <p className="truncate text-xs text-muted-foreground">
          {lr?.loadingLocation?.name ?? "-"} →{" "}
          {lr?.unloadingLocation?.name ?? "-"}
        </p>
      </div>

      <span
        title={
          isReadyToFinalise
            ? undefined
            : `Missing: ${missingFields.join(", ")}`
        }
        className={
          isReadyToFinalise
            ? "shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
            : "shrink-0 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
        }
      >
        {getMissingMessage(missingFields)}
      </span>
    </section>
  );
})}
            </div>
          </div>
        </form>

   <SheetFooter className="shrink-0 border-t bg-background sm:flex-row sm:justify-end">
  <Button
    type="button"
    variant="outline"
    onClick={() => onOpenChange(false)}
  >
    Cancel
  </Button>

  <Button
    type="submit"
    form="finalise-group-form"
    disabled={isPending || hasIncompleteLr}
  >
    {isPending
      ? "Finalising..."
      : hasIncompleteLr
        ? "LR details required"
        : lrs.length === 1
          ? "Finalise LR"
          : `Finalise ${lrs.length} LRs`}
  </Button>
</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
