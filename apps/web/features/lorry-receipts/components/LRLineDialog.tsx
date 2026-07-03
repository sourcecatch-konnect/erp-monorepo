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

export type LinePayload = {
  loadingLocationId?: string;
  unloadingLocationId?: string;
  goods: { name: string; description?: string; quantity: number; unit: string; weight?: number }[];
  invoiceNumber?: string;
  invoiceAmount?: number;
};

type GoodsFormLine = {
  name: string;
  quantity: string;
  unit: string;
};

type FormShape = {
  loadingLocationId?: string;
  unloadingLocationId?: string;
  goods: GoodsFormLine[];
  invoiceNumber: string;
  invoiceAmount: string;
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

  const form = useForm<FormShape>({
    defaultValues: {
      loadingLocationId: undefined,
      unloadingLocationId: undefined,
      goods: [{ name: "", quantity: "", unit: "" }],
      invoiceNumber: "",
      invoiceAmount: "",
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "goods",
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        loadingLocationId: initial?.loadingLocationId,
        unloadingLocationId: initial?.unloadingLocationId,
        goods: initial?.goods?.length
          ? initial.goods.map((g) => ({
              name: g.name ?? "",
              quantity: g.quantity ?? "",
              unit: g.unit ?? "",
            }))
          : [{ name: "", quantity: "", unit: "" }],
        invoiceNumber: initial?.invoiceNumber ?? "",
        invoiceAmount: initial?.invoiceAmount ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (v: FormShape) => {
    const goods = v.goods.map((g) => ({
      name: g.name.trim(),
      quantity: Number(g.quantity),
      unit: g.unit.trim(),
    }));
    const invalidIndex = goods.findIndex(
      (g) => !g.name || !Number.isInteger(g.quantity) || g.quantity <= 0 || !g.unit,
    );

    if (invalidIndex >= 0) {
      form.setError(`goods.${invalidIndex}.name`, {
        message: "Goods name, qty and unit are required",
      });
      return;
    }

    onSubmit({
      loadingLocationId: v.loadingLocationId || undefined,
      unloadingLocationId: v.unloadingLocationId || undefined,
      goods,
      invoiceNumber: mode === "edit" ? v.invoiceNumber.trim() || undefined : undefined,
      invoiceAmount:
        mode === "edit" && v.invoiceAmount ? Number(v.invoiceAmount) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl">
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
                Goods for this LR <span className="text-red-600">*</span>
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ name: "", quantity: "", unit: "" })}
              >
                <IconPlus size={14} className="mr-1" /> Add goods row
              </Button>
            </div>

  {fields.map((field, index) => (
  <div key={field.id} className="rounded-md border bg-muted/20 p-3">
  <div className="flex items-end gap-3">
      <div className="col-span-6">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Goods name
        </label>
        <Input {...form.register(`goods.${index}.name`)} className="h-9" />
      </div>

      <div className="col-span-2">
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

      <div className="col-span-2">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Unit
        </label>
        <Input
          {...form.register(`goods.${index}.unit`)}
          placeholder="MT"
          className="h-9"
        />
      </div>

      <div className="col-span-2 flex justify-end">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Remove goods"
          disabled={fields.length <= 1}
          onClick={() => remove(index)}
        >
          <IconTrash size={15} />
        </Button>
      </div>
    </div>

    {form.formState.errors.goods?.[index]?.name?.message && (
      <p className="mt-1 text-xs text-red-600">
        {form.formState.errors.goods[index]?.name?.message}
      </p>
    )}
  </div>
))}
          </div>

          {mode === "edit" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Invoice no.
                </label>
                <Input {...form.register("invoiceNumber")} className="h-9" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Invoice amount (₹)
                </label>
                <Input {...form.register("invoiceAmount")} type="number" min={0} className="h-9" />
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
