"use client";

import * as React from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Combobox } from "@skerp/ui/components/combobox";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { lrLookups, lrLookupKeys } from "../lorry-receipt.service";
import { SuggestInput } from "@skerp/ui/components/suggest-input";
import { useUnitOfMeasureOptions } from "@/features/masters/unitOfMeasure/useUnitOfMeasureOptions";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

export type LinePayload = {
  loadingLocationId?: string;
  unloadingLocationId?: string;

  totalWeight?: number;
  totalWeightUnit?: string;

  goods: {
    name: string;
    description?: string;
    quantity: number;
  }[];

  invoiceNumber?: string;
  invoiceAmount?: number;
  invoiceRemark?: string;
};
type GoodsFormLine = {
  name: string;
  quantity: string;
};

type FormShape = {
  loadingLocationId?: string;
  unloadingLocationId?: string;

  totalWeight: string;
  totalWeightUnit: string;

  goods: GoodsFormLine[];

  invoiceNumber: string;
  invoiceAmount: string;
  invoiceRemark: string;
};
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  consignorId: string;
  consigneeId: string;
  initial?: Partial<FormShape>;
  isPending: boolean;
  onSubmit: (data: LinePayload) => void;
};

export default function LRLineDialog({
  open,
  onOpenChange,
  mode,
  consignorId,
  consigneeId,
  initial,
  isPending,
  onSubmit,
}: Props) {
  const loadings = useQuery({
    queryKey: lrLookupKeys.customerLocations(consignorId),
    queryFn: () => lrLookups.customerLocations(consignorId),
    enabled: open && Boolean(consignorId),
  });
  const unloadings = useQuery({
    queryKey: lrLookupKeys.customerLocations(consigneeId),
    queryFn: () => lrLookups.customerLocations(consigneeId),
    enabled: open && Boolean(consigneeId),
  });
  const units = useUnitOfMeasureOptions(open);
  const form = useForm<FormShape>({
    defaultValues: {
      loadingLocationId: undefined,
      unloadingLocationId: undefined,
      totalWeight: "",
      totalWeightUnit: "MT",
      goods: [],
      invoiceNumber: "",
      invoiceAmount: "",
      invoiceRemark: "",
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "goods",
  });
  const goodsMaster = useQuery({
    queryKey: lrLookupKeys.goods,
    queryFn: lrLookups.goods,
    enabled: open,
  });

  const goodsSuggestions = (goodsMaster.data ?? []).map((g) => ({
    value: g.name,
    hint: g.description ?? undefined,
  }));
  React.useEffect(() => {
    if (open) {
      form.reset({
        loadingLocationId: initial?.loadingLocationId,
        unloadingLocationId: initial?.unloadingLocationId,
        totalWeight: initial?.totalWeight ?? "",
        totalWeightUnit: initial?.totalWeightUnit ?? "MT",
        goods: initial?.goods?.length
          ? initial.goods.map((g) => ({
            name: g.name ?? "",
            quantity: g.quantity ?? "",
          }))
          : [],
        invoiceNumber: initial?.invoiceNumber ?? "",
        invoiceAmount: initial?.invoiceAmount ?? "",
        invoiceRemark: initial?.invoiceRemark ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (v: FormShape) => {
    const totalWeight =
      v.totalWeight === "" ? undefined : Number(v.totalWeight);

    if (totalWeight === undefined || !Number.isFinite(totalWeight) || totalWeight < 0) {
      form.setError("totalWeight", {
        message: "Total weight is required",
      });
      return;
    }

    if (!v.totalWeightUnit) {
      form.setError("totalWeightUnit", {
        message: "Unit is required",
      });
      return;
    }

    const goods = v.goods.map((g) => ({
      name: g.name.trim(),
      quantity: Number(g.quantity),
    }));

    const invalidIndex = goods.findIndex(
      (g) => !g.name || !Number.isInteger(g.quantity) || g.quantity <= 0,
    );

    if (invalidIndex >= 0) {
      form.setError(`goods.${invalidIndex}.name`, {
        message: "Goods name and qty are required",
      });
      return;
    }
    const invoiceNumber = v.invoiceNumber.trim();

    const invoiceAmount =
      v.invoiceAmount === "" ? undefined : Number(v.invoiceAmount);
    const invoiceRemark = v.invoiceRemark.trim() || undefined;
    if (mode === "edit" && !invoiceNumber) {
      form.setError("invoiceNumber", {
        type: "required",
        message: "Invoice number is required",
      });
      return;
    }

    // Invoice amount is optional; only reject a value that was entered but isn't
    // a positive number (blank / undefined is allowed).
    if (
      mode === "edit" &&
      invoiceAmount !== undefined &&
      (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0)
    ) {
      form.setError("invoiceAmount", {
        type: "validate",
        message: "Enter a valid amount greater than 0, or leave it blank",
      });
      return;
    }


    onSubmit({
      loadingLocationId: v.loadingLocationId || undefined,
      unloadingLocationId: v.unloadingLocationId || undefined,

      totalWeight,
      totalWeightUnit: v.totalWeightUnit,

      goods: goods.length ? goods : [],

      invoiceNumber: mode === "edit" ? invoiceNumber : undefined,
      invoiceAmount: mode === "edit" ? invoiceAmount : undefined,
      invoiceRemark: mode === "edit" ? invoiceRemark : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[100vh] w-[95vw] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add LR" : "Edit LR"}</DialogTitle>
          <DialogDescription>
            One LR is one consignment line: one loading point, one unloading
            point, and one or more goods rows for that same pair.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Loading point
              </label>
              <Controller
                control={form.control}
                name="loadingLocationId"
                render={({ field }) => (
                  <Combobox
                    options={(loadings.data ?? []).map((l) => ({ value: l.value, label: l.label }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Pickup location"
                  />
                )}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Unloading point
              </label>
              <Controller
                control={form.control}
                name="unloadingLocationId"
                render={({ field }) => (
                  <Combobox
                    options={(unloadings.data ?? []).map((l) => ({ value: l.value, label: l.label }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Drop location"
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Goods for this LR
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ name: "", quantity: "" })}
              >
                <IconPlus size={14} className="mr-1" /> Add goods row
              </Button>
            </div>
            {goodsMaster.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                Couldn&apos;t load the goods list ({getErrorMessage(
                  goodsMaster.error,
                )}
                ) — you can still type a goods name directly below, or ask
                your admin to check your Goods master permission.
              </p>
            ) : null}
            {fields.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                No goods added yet. This LR can stay draft, but the group cannot
                be finalised until every LR has goods.
              </div>
            ) : (
              <div className="max-h-[200px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="relative rounded-md border bg-muted/20 p-3 focus-within:z-50"
                  >
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Goods name
                        </label>
                        <Controller
                          control={form.control}
                          name={`goods.${index}.name`}
                          render={({ field }) => (
                            <SuggestInput
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              suggestions={goodsSuggestions}
                              placeholder={
                                goodsMaster.isLoading
                                  ? "Loading goods..."
                                  : goodsMaster.isError
                                    ? "Type goods name (list unavailable)"
                                    : "Select or type goods"
                              }
                              invalid={Boolean(
                                form.formState.errors.goods?.[index]?.name?.message,
                              )}
                              className="relative z-50 [&_input]:h-9"
                            />
                          )}
                        />
                      </div>

                      <div className="w-24 shrink-0">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Qty
                        </label>
                        <Input
                          {...form.register(`goods.${index}.quantity`)}
                          type="number"
                          min={1}
                          className="h-9"
                        />
                      </div>

                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Remove goods"
                        onClick={() => remove(index)}
                      >
                        <IconTrash size={15} />
                      </Button>
                    </div>

                    {form.formState.errors.goods?.[index]?.name?.message && (
                      <p className="mt-1 text-xs text-red-600">
                        {form.formState.errors.goods[index]?.name?.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex w-full items-start gap-3">
            <div className="w-48 shrink-0">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Total weight <span className="text-red-600">*</span>
              </label>

              <Input
                {...form.register("totalWeight")}
                type="number"
                min={0.01}
                step="0.01"
                placeholder="Weight"
                className="h-9 w-full"
                onKeyDown={(event) => {
                  if (event.key === "-" || event.key === "e") {
                    event.preventDefault();
                  }
                }}
              />
              {form.formState.errors.totalWeight?.message ? (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.totalWeight.message}
                </p>
              ) : null}
            </div>

            <div className="w-32 shrink-0">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Unit <span className="text-red-600">*</span>
              </label>

              <Controller
                control={form.control}
                name="totalWeightUnit"
                render={({ field }) => (
                  <Combobox
                    options={units.options}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={units.isLoading ? "Loading..." : "Unit"}
                    emptyText="No units found"
                  />
                )}
              />

              {form.formState.errors.totalWeightUnit?.message ? (
                <p className="mt-1 text-xs text-red-600">
                  {form.formState.errors.totalWeightUnit.message}
                </p>
              ) : null}
            </div>
          </div>
          {mode === "edit" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Invoice no. <span className="text-red-600">*</span>
                </label>

                <Input
                  {...form.register("invoiceNumber")}
                  className="h-9"
                  placeholder="Enter Invoice Number"
                />

                {form.formState.errors.invoiceNumber?.message ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.invoiceNumber.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Invoice amount (₹)
                </label>

                <Input
                  {...form.register("invoiceAmount")}
                  type="number"
                  step="0.01"
                  placeholder="Enter invoice amount (optional)"
                  className="h-9"
                  onKeyDown={(event) => {
                    if (event.key === "-" || event.key === "e") {
                      event.preventDefault();
                    }
                  }}
                />

                {form.formState.errors.invoiceAmount?.message ? (
                  <p className="mt-1 text-xs text-red-600">
                    {form.formState.errors.invoiceAmount.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Invoice remark
                </label>

                <Input
                  {...form.register("invoiceRemark")}
                  type="text"
                  placeholder="As per invoice"
                  className="h-9"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : mode === "add" ? "Add LR" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
