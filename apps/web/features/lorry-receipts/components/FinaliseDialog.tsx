"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { finaliseLRSchema } from "@skerp/validators/lorry-receipt";
import type { FinaliseLRFormInput, FinaliseLRBody } from "@skerp/types";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lrNumber: string;
  isPending: boolean;
  onConfirm: (data: FinaliseLRBody) => void;
};

export default function FinaliseDialog({
  open, onOpenChange, lrNumber, isPending, onConfirm,
}: Props) {
  const form = useForm<FinaliseLRFormInput, unknown, FinaliseLRBody>({
    resolver: zodResolver(finaliseLRSchema),
    defaultValues: {
      sealNumber: "",
      invoiceNumber: "",
      invoiceAmount: "" as unknown as number,
      baseFreightAmount: "" as unknown as number,
      ewayBill: {
        ewayBillNo: "",
        generatedAt: "" as unknown as Date,
        expiresAt: "" as unknown as Date,
        generatedBy: "",
        documentUrl: "",
      },
    },
  });

  const onSubmit = (values: FinaliseLRBody) => onConfirm(values);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalise LR {lrNumber}</DialogTitle>
          <DialogDescription>
            Capture dispatch details — seal, consignor invoice, freight and e-way bill. This marks
            the LR as ready to dispatch.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Dispatch details */}
          <div className="grid grid-cols-2 gap-3">
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
              {form.formState.errors.baseFreightAmount?.message && (
                <p className="mt-1 text-xs text-red-600">
                  {String(form.formState.errors.baseFreightAmount.message)}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Consignor invoice no.
              </label>
              <Input
                {...form.register("invoiceNumber")}
                placeholder="e.g. INV-2024-001"
                className="h-9"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Invoice amount (₹)
              </label>
              <Input
                {...form.register("invoiceAmount")}
                type="number"
                min={0}
                placeholder="0"
                className="h-9"
              />
              {form.formState.errors.invoiceAmount?.message && (
                <p className="mt-1 text-xs text-red-600">
                  {String(form.formState.errors.invoiceAmount.message)}
                </p>
              )}
            </div>
          </div>

          {/* E-way bill */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">E-Way Bill</p>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                E-way bill number <span className="text-red-600">*</span>
              </label>
              <Input
                {...form.register("ewayBill.ewayBillNo")}
                placeholder="12-digit GST e-way bill no"
                className="h-9"
              />
              {form.formState.errors.ewayBill?.ewayBillNo?.message && (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.ewayBill.ewayBillNo.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Generated on <span className="text-red-600">*</span>
                </label>
                <Input
                  {...form.register("ewayBill.generatedAt")}
                  type="date"
                  className="h-9"
                />
                {form.formState.errors.ewayBill?.generatedAt?.message && (
                  <p className="mt-1 text-xs text-red-600">
                    {String(form.formState.errors.ewayBill.generatedAt.message)}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Expires on <span className="text-red-600">*</span>
                </label>
                <Input
                  {...form.register("ewayBill.expiresAt")}
                  type="date"
                  className="h-9"
                />
                {form.formState.errors.ewayBill?.expiresAt?.message && (
                  <p className="mt-1 text-xs text-red-600">
                    {String(form.formState.errors.ewayBill.expiresAt.message)}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Generated by (optional)
              </label>
              <Input
                {...form.register("ewayBill.generatedBy")}
                placeholder="Name or organisation"
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Finalising…" : "Finalise LR"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
