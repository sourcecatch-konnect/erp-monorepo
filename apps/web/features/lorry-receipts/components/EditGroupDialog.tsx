"use client";

import * as React from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { updateLRGroupSchema } from "@skerp/validators/lr-group";
import type { UpdateLRGroupBody, LRGroup } from "@skerp/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";

import ComboboxField from "@/features/masters/_shared/fields/ComboboxField";
import { lrLookups, lrLookupKeys } from "../lorry-receipt.service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: LRGroup;
  isPending: boolean;
  onConfirm: (data: UpdateLRGroupBody) => void;
};

const TRANSPORT = [
  { value: "Road", label: "Road" },
  { value: "RoadAndRail", label: "Road & Rail" },
] as const;

const PRIORITY = [
  { value: "Normal", label: "Normal" },
  { value: "Express", label: "Express" },
  { value: "Critical", label: "Critical" },
] as const;

export default function EditGroupDialog({ open, onOpenChange, group, isPending, onConfirm }: Props) {
  const customers = useQuery({ queryKey: lrLookupKeys.customers, queryFn: lrLookups.customers, enabled: open });
  const railheads = useQuery({
    queryKey: lrLookupKeys.railheadBranches,
    queryFn: lrLookups.railheadBranches,
    enabled: open,
  });
  const trips = useQuery({
    queryKey: lrLookupKeys.attachableTrips(group.consignorId),
    queryFn: () => lrLookups.attachableTrips(group.consignorId),
    enabled: open,
  });

  const form = useForm<UpdateLRGroupBody>({
    resolver: zodResolver(updateLRGroupSchema, undefined, { raw: true }),
    defaultValues: {
      consigneeId: group.consigneeId,
      transportType: group.transportType,
      railheadBranchId: group.railheadBranchId ?? undefined,
      priority: group.priority,
      isMarketVehicle: group.isMarketVehicle,
      primaryTripId: group.primaryTripId ?? undefined,
      marketVehicleNumber: group.marketVehicleNumber ?? undefined,
      marketDriverName: group.marketDriverName ?? undefined,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        consigneeId: group.consigneeId,
        transportType: group.transportType,
        railheadBranchId: group.railheadBranchId ?? undefined,
        priority: group.priority,
        isMarketVehicle: group.isMarketVehicle,
        primaryTripId: group.primaryTripId ?? undefined,
        marketVehicleNumber: group.marketVehicleNumber ?? undefined,
        marketDriverName: group.marketDriverName ?? undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isMarket = form.watch("isMarketVehicle");
  const transport = form.watch("transportType");

  const customerOptions = customers.data ?? [];
  const tripOptions = (trips.data ?? []).map((t) => ({
    value: t.id,
    label: t.label,
    hint: t.hint,
    badge: t.badge,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {group.lorryReceipts?.length === 1
              ? `Edit LR ${group.lorryReceipts[0]!.lrNumber}`
              : `Edit group ${group.groupNumber}`}
          </DialogTitle>
          <DialogDescription>
            Change the truck-level details. Add or remove LRs from the detail page.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onConfirm)} className="space-y-4">
            <ComboboxField name="consigneeId" label="Consignee" options={customerOptions} />

            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="transportType"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Transport
                    </label>
                    <Select value={field.value ?? "Road"} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSPORT.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <Controller
                name="priority"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Priority
                    </label>
                    <Select value={field.value ?? "Normal"} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </div>

            {transport === "RoadAndRail" && (
              <ComboboxField
                name="railheadBranchId"
                label="Railhead branch"
                options={(railheads.data ?? []).map((b) => ({ value: b.value, label: b.label }))}
                emptyText="No railhead branches found"
              />
            )}

            <Controller
              name="isMarketVehicle"
              control={form.control}
              render={({ field }) => (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Transport by
                  </label>
                  <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                    {[
                      { value: false, label: "Own Vehicle" },
                      { value: true, label: "Market Vehicle" },
                    ].map((o) => (
                      <button
                        key={String(o.value)}
                        type="button"
                        onClick={() => field.onChange(o.value)}
                        className={`rounded-[5px] px-3 py-1 text-xs font-medium transition-colors ${
                          field.value === o.value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            />

            {!isMarket ? (
              <ComboboxField
                name="primaryTripId"
                label="Trip"
                options={tripOptions}
                emptyText="No trips available"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Vehicle number
                  </label>
                  <Input {...form.register("marketVehicleNumber")} className="h-9" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Driver
                  </label>
                  <Input {...form.register("marketDriverName")} className="h-9" />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
