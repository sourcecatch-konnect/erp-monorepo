"use client";

import * as React from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { finaliseGroupSchema } from "@skerp/validators/lr-group";
import type { EwayBill,  FinaliseGroupFormInput } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { DatePicker } from "@skerp/ui/components/datepicker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@skerp/ui/components/sheet";

import { formatDate } from "@/lib/format";

type LrRow = {
  id: string;
  lrNumber: string;
  loadingLocation?: { name: string } | null;
  unloadingLocation?: { name: string } | null;
  invoiceNumber?: string | null;
  invoiceAmount?: number | null;
  ewayBill?: EwayBill | null;
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

const emptyDate = "" as unknown as Date;

const blankEwayBill = () => ({
  ewayBillNo: "",
  generatedAt: emptyDate,
  expiresAt: emptyDate,
  generatedBy: "",
  documentUrl: "",
});

const toDate = (value: unknown) => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const toRupeesInput = (paise?: number | null) =>
  paise != null ? (paise / 100).toString() : "";

function buildRows(lrs: LrRow[]) {
  return lrs.map((lr) => ({
    lrId: lr.id,
    invoiceNumber: lr.invoiceNumber ?? "",
    invoiceAmount: toRupeesInput(lr.invoiceAmount) as unknown as number,
    ...(lr.ewayBill
      ? { existingEwayBillId: lr.ewayBill.id }
      : { ewayBill: blankEwayBill() }),
  }));
}

/**
 * Group finalise: one sheet finalises every LR in the group at once. The shared
 * freight/seal live at truck level; invoice and e-way bill are captured per LR.
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
  const form = useForm<FinaliseGroupFormInput>({
    resolver: zodResolver(finaliseGroupSchema),
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

  const onSubmit = (values: FinaliseGroupFormInput) => onConfirm(values);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-screen w-full overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-4xl"
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>Finalise group {groupNumber}</SheetTitle>
          <SheetDescription>
            Enter truck-level freight once, then complete invoice and e-way bill
            details for each LR.
          </SheetDescription>
        </SheetHeader>

        <form
          id="finalise-group-form"
          onSubmit={form.handleSubmit(onSubmit)}
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
                const lrErr = errors.lrs?.[idx];
                const existingEwayBill = lr?.ewayBill ?? null;

                return (
                  <section key={field.id} className="rounded-lg border bg-background p-3">
                    <input type="hidden" {...form.register(`${base}.lrId`)} />
                    {existingEwayBill ? (
                      <input
                        type="hidden"
                        {...form.register(`${base}.existingEwayBillId`)}
                      />
                    ) : null}

                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">{lr?.lrNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {lr?.loadingLocation?.name ?? "-"} -&gt;{" "}
                          {lr?.unloadingLocation?.name ?? "-"}
                        </p>
                      </div>
                      {existingEwayBill ? (
                        <span className="w-fit rounded-sm bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          E-way bill added
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Invoice no.
                        </label>
                        <Input {...form.register(`${base}.invoiceNumber`)} className="h-9" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Invoice amount (Rs.)
                        </label>
                        <Input
                          {...form.register(`${base}.invoiceAmount`)}
                          type="number"
                          min={0}
                          className="h-9"
                        />
                      </div>
                    </div>

                    {existingEwayBill ? (
                      <div className="mt-3 grid gap-3 rounded-md border bg-muted/20 p-3 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            E-way bill no.
                          </p>
                          <p className="font-medium">{existingEwayBill.ewayBillNo}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Generated
                          </p>
                          <p>{formatDate(existingEwayBill.generatedAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            Expires
                          </p>
                          <p>{formatDate(existingEwayBill.expiresAt)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-3 lg:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            E-way bill no. <span className="text-red-600">*</span>
                          </label>
                          <Input
                            {...form.register(`${base}.ewayBill.ewayBillNo`)}
                            className="h-9"
                          />
                          {lrErr?.ewayBill?.ewayBillNo?.message ? (
                            <p className="mt-1 text-xs text-red-600">
                              {lrErr.ewayBill.ewayBillNo.message}
                            </p>
                          ) : null}
                        </div>
                        <Controller
                          control={form.control}
                          name={`${base}.ewayBill.generatedAt`}
                          render={({ field }) => (
                            <div>
                              <DatePicker
                                label="Generated"
                                selected={toDate(field.value)}
                                onSelect={field.onChange}
                                clearable={false}
                              />
                              {lrErr?.ewayBill?.generatedAt?.message ? (
                                <p className="mt-1 text-xs text-red-600">
                                  {String(lrErr.ewayBill.generatedAt.message)}
                                </p>
                              ) : null}
                            </div>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name={`${base}.ewayBill.expiresAt`}
                          render={({ field }) => (
                            <div>
                              <DatePicker
                                label="Expires"
                                selected={toDate(field.value)}
                                onSelect={field.onChange}
                                clearable={false}
                              />
                              {lrErr?.ewayBill?.expiresAt?.message ? (
                                <p className="mt-1 text-xs text-red-600">
                                  {String(lrErr.ewayBill.expiresAt.message)}
                                </p>
                              ) : null}
                            </div>
                          )}
                        />
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Generated by
                          </label>
                          <Input
                            {...form.register(`${base}.ewayBill.generatedBy`)}
                            className="h-9"
                          />
                        </div>
                      </div>
                    )}

                    {lrErr?.ewayBill?.message ? (
                      <p className="mt-2 text-xs text-red-600">
                        {String(lrErr.ewayBill.message)}
                      </p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </div>
        </form>

        <SheetFooter className="shrink-0 border-t bg-background shadow-sm sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="finalise-group-form" disabled={isPending}>
            {isPending ? "Finalising..." : "Finalise group"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
