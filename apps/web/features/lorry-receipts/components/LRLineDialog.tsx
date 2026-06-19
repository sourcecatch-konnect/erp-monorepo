"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Combobox } from "@skerp/ui/components/combobox";
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

type FormShape = {
  loadingLocationId?: string;
  unloadingLocationId?: string;
  goodsName: string;
  quantity: string;
  unit: string;
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
      goodsName: "",
      quantity: "",
      unit: "",
      invoiceNumber: "",
      invoiceAmount: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        loadingLocationId: initial?.loadingLocationId,
        unloadingLocationId: initial?.unloadingLocationId,
        goodsName: initial?.goodsName ?? "",
        quantity: initial?.quantity ?? "",
        unit: initial?.unit ?? "",
        invoiceNumber: initial?.invoiceNumber ?? "",
        invoiceAmount: initial?.invoiceAmount ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (v: FormShape) => {
    if (!v.goodsName.trim() || !v.quantity || !v.unit.trim()) {
      form.setError("goodsName", { message: "Goods name, qty and unit are required" });
      return;
    }
    onSubmit({
      loadingLocationId: v.loadingLocationId || undefined,
      unloadingLocationId: v.unloadingLocationId || undefined,
      goods: [{ name: v.goodsName.trim(), quantity: Number(v.quantity), unit: v.unit.trim() }],
      invoiceNumber: mode === "edit" ? v.invoiceNumber.trim() || undefined : undefined,
      invoiceAmount:
        mode === "edit" && v.invoiceAmount ? Number(v.invoiceAmount) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add LR" : "Edit LR"}</DialogTitle>
          <DialogDescription>
            One LR = one consignment (loading point, unloading point, goods).
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

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Goods name <span className="text-red-600">*</span>
              </label>
              <Input {...form.register("goodsName")} className="h-9" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Qty <span className="text-red-600">*</span>
              </label>
              <Input {...form.register("quantity")} type="number" min={1} className="h-9" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Unit <span className="text-red-600">*</span>
              </label>
              <Input {...form.register("unit")} placeholder="MT" className="h-9" />
            </div>
          </div>
          {form.formState.errors.goodsName?.message && (
            <p className="text-xs text-red-600">{form.formState.errors.goodsName.message}</p>
          )}

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
