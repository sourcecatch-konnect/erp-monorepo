"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";

import { ewbApi } from "../ewaybill.service";
import { ewbKeys } from "../ewaybill.keys";
import {
  VEHICLE_UPDATE_REASONS,
  type EwayBill,
  type UpdateVehicleBody,
} from "../types";

const schema = z.object({
  vehicleNo: z
    .string()
    .min(7, "Vehicle number is too short")
    .regex(/^[A-Z0-9 -]+$/, "Use uppercase letters and numbers only"),
  transDocNo: z.string().max(40).optional().or(z.literal("")),
  transDocDate: z.string().optional().or(z.literal("")),
  fromPlace: z.string().min(2, "Required"),
  fromState: z.coerce.number().int().min(1).max(99),
  reasonCode: z.enum(["1", "2", "3", "4"]),
  reasonRem: z.string().min(3, "Briefly describe the reason"),
  transMode: z.enum(["ROAD", "RAIL", "AIR", "SHIP"]),
});

type FormVals = z.infer<typeof schema>;

export function UpdateVehicleDialog({
  bill,
  open,
  onOpenChange,
}: {
  bill: EwayBill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleNo: "",
      transDocNo: bill.transDocNo ?? "",
      transDocDate: bill.transDocDate?.slice(0, 10) ?? "",
      fromPlace: bill.fromPlace,
      fromState: bill.fromStateCode,
      reasonCode: "1",
      reasonRem: "",
      transMode: bill.transMode,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        vehicleNo: "",
        transDocNo: bill.transDocNo ?? "",
        transDocDate: bill.transDocDate?.slice(0, 10) ?? "",
        fromPlace: bill.fromPlace,
        fromState: bill.fromStateCode,
        reasonCode: "1",
        reasonRem: "",
        transMode: bill.transMode,
      });
    }
  }, [open, bill, form]);

  const mutation = useMutation({
    mutationFn: (body: UpdateVehicleBody) =>
      ewbApi.updateVehicle(bill.ewbNo, body),
    onSuccess: () => {
      toast.success("Vehicle updated", {
        description: `Part-B updated for EWB ${bill.ewbNo}`,
      });
      qc.invalidateQueries({ queryKey: ewbKeys.all });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error("Update failed", { description: err.message });
    },
  });

  const onSubmit = form.handleSubmit((vals) => {
    mutation.mutate({
      vehicleNo: vals.vehicleNo.toUpperCase(),
      transDocNo: vals.transDocNo || undefined,
      transDocDate: vals.transDocDate || undefined,
      fromPlace: vals.fromPlace,
      fromState: vals.fromState,
      reasonCode: vals.reasonCode,
      reasonRem: vals.reasonRem,
      transMode: vals.transMode,
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Vehicle (Part-B)</DialogTitle>
          <DialogDescription>
            EWB <span className="font-mono">{bill.ewbNo}</span> · current
            vehicle{" "}
            <span className="font-mono">
              {bill.vehicleNo || "— not assigned —"}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-3">
          <Field
            label="New Vehicle Number"
            error={form.formState.errors.vehicleNo?.message}
          >
            <Input
              autoFocus
              placeholder="e.g. MH04 KL 7821"
              className="uppercase"
              {...form.register("vehicleNo")}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Trans Doc No."
              error={form.formState.errors.transDocNo?.message}
            >
              <Input
                placeholder="LR/2026/0000"
                {...form.register("transDocNo")}
              />
            </Field>
            <Field
              label="Trans Doc Date"
              error={form.formState.errors.transDocDate?.message}
            >
              <Input type="date" {...form.register("transDocDate")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="From Place"
              error={form.formState.errors.fromPlace?.message}
            >
              <Input {...form.register("fromPlace")} />
            </Field>
            <Field
              label="Mode"
              error={form.formState.errors.transMode?.message}
            >
              <Controller
                control={form.control}
                name="transMode"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROAD">Road</SelectItem>
                      <SelectItem value="RAIL">Rail</SelectItem>
                      <SelectItem value="AIR">Air</SelectItem>
                      <SelectItem value="SHIP">Ship</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field
            label="Reason"
            error={form.formState.errors.reasonCode?.message}
          >
            <Controller
              control={form.control}
              name="reasonCode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_UPDATE_REASONS.map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="Remarks"
            error={form.formState.errors.reasonRem?.message}
          >
            <Input
              placeholder="Tire burst on highway, switched to backup truck"
              {...form.register("reasonRem")}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating…" : "Update Part-B"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
