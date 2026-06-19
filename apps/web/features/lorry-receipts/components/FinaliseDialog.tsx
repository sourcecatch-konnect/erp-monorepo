"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { finaliseGroupSchema } from "@skerp/validators/lr-group";
import type { FinaliseGroupFormInput, FinaliseGroupBody } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

type LrRow = {
  id: string;
  lrNumber: string;
  loadingLocation?: { name: string } | null;
  unloadingLocation?: { name: string } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupNumber: string;
  lrs: LrRow[];
  /** Pre-fill freight from the order's booking freight (paise). */
  defaultFreight?: number | null;
  isPending: boolean;
  onConfirm: (data: FinaliseGroupBody) => void;
};

/**
 * Group finalise: one dialog finalises every LR in the group at once. The two
 * shared fields (base freight + seal) are entered once for the whole truck;
 * invoice + e-way bill are captured per LR.
 */
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
    resolver: zodResolver(finaliseGroupSchema),
    defaultValues: {
      baseFreightAmount: (defaultFreight ?? "") as unknown as number,
      sealNumber: "",
      lrs: lrs.map((lr) => ({
        lrId: lr.id,
        invoiceNumber: "",
        invoiceAmount: "" as unknown as number,
        ewayBill: {
          ewayBillNo: "",
          generatedAt: "" as unknown as Date,
          expiresAt: "" as unknown as Date,
          generatedBy: "",
          documentUrl: "",
        },
      })),
    },
  });

  // Re-seed rows when the group's LRs change between opens.
  React.useEffect(() => {
    if (open) {
      form.reset({
        baseFreightAmount: (defaultFreight ?? "") as unknown as number,
        sealNumber: "",
        lrs: lrs.map((lr) => ({
          lrId: lr.id,
          invoiceNumber: "",
          invoiceAmount: "" as unknown as number,
          ewayBill: {
            ewayBillNo: "",
            generatedAt: "" as unknown as Date,
            expiresAt: "" as unknown as Date,
            generatedBy: "",
            documentUrl: "",
          },
        })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { fields } = useFieldArray({ control: form.control, name: "lrs" });
  const errors = form.formState.errors;

  const onSubmit = (values: FinaliseGroupBody) => onConfirm(values);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalise group {groupNumber}</DialogTitle>
          <DialogDescription>
            One freight and one seal for the whole truck; each LR gets its own invoice
            and e-way bill. All {fields.length} LR{fields.length === 1 ? "" : "s"} are
            finalised together.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Shared truck-level fields */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Base freight (₹) <span className="text-red-600">*</span>
              </label>
              <Input
                {...form.register("baseFreightAmount")}
                type="number"
                min={0}
                placeholder="0"
                className="h-9"
              />
              {errors.baseFreightAmount?.message && (
                <p className="mt-1 text-xs text-red-600">
                  {String(errors.baseFreightAmount.message)}
                </p>
              )}
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
          </div>

          {/* Per-LR invoice + e-way */}
          <div className="space-y-3">
            {fields.map((field, idx) => {
              const lr = lrs[idx];
              const base = `lrs.${idx}` as const;
              const lrErr = errors.lrs?.[idx];
              return (
                <div key={field.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{lr?.lrNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {lr?.loadingLocation?.name ?? "—"} → {lr?.unloadingLocation?.name ?? "—"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Invoice no.
                      </label>
                      <Input {...form.register(`${base}.invoiceNumber`)} className="h-9" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Invoice amount (₹)
                      </label>
                      <Input
                        {...form.register(`${base}.invoiceAmount`)}
                        type="number"
                        min={0}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        E-way bill no. <span className="text-red-600">*</span>
                      </label>
                      <Input {...form.register(`${base}.ewayBill.ewayBillNo`)} className="h-9" />
                      {lrErr?.ewayBill?.ewayBillNo?.message && (
                        <p className="mt-1 text-xs text-red-600">
                          {lrErr.ewayBill.ewayBillNo.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Generated <span className="text-red-600">*</span>
                      </label>
                      <Input
                        {...form.register(`${base}.ewayBill.generatedAt`)}
                        type="date"
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Expires <span className="text-red-600">*</span>
                      </label>
                      <Input
                        {...form.register(`${base}.ewayBill.expiresAt`)}
                        type="date"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Finalising…" : "Finalise group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
