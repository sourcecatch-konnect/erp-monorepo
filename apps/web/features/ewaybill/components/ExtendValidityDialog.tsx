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
import { EXTEND_REASONS, type EwayBill, type ExtendBody } from "../types";

const schema = z.object({
  remainingDistanceKm: z.coerce.number().min(1).max(4000),
  extnRsnCode: z.enum(["1", "2", "3", "4", "5"]),
  extnRemarks: z.string().min(3, "Briefly describe the reason"),
  fromPlace: z.string().min(2, "Required"),
  additionalHours: z.coerce.number().int().min(1).max(96),
});

type FormVals = z.infer<typeof schema>;

export function ExtendValidityDialog({
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
      remainingDistanceKm: Math.max(50, Math.round(bill.transDistance / 3)),
      extnRsnCode: "1",
      extnRemarks: "",
      fromPlace: bill.fromPlace,
      additionalHours: 24,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        remainingDistanceKm: Math.max(50, Math.round(bill.transDistance / 3)),
        extnRsnCode: "1",
        extnRemarks: "",
        fromPlace: bill.fromPlace,
        additionalHours: 24,
      });
    }
  }, [open, bill, form]);

  const mutation = useMutation({
    mutationFn: (body: ExtendBody) => ewbApi.extend(bill.ewbNo, body),
    onSuccess: () => {
      toast.success("Validity extended", {
        description: `New deadline set for EWB ${bill.ewbNo}`,
      });
      qc.invalidateQueries({ queryKey: ewbKeys.all });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error("Extension failed", { description: err.message });
    },
  });

  const onSubmit = form.handleSubmit((vals) => mutation.mutate(vals));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extend Validity</DialogTitle>
          <DialogDescription>
            EWB <span className="font-mono">{bill.ewbNo}</span> · current expiry{" "}
            {new Date(bill.validUntil).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Remaining Distance (km)"
              error={form.formState.errors.remainingDistanceKm?.message}
            >
              <Input
                type="number"
                inputMode="numeric"
                {...form.register("remainingDistanceKm")}
              />
            </Field>
            <Field
              label="Extend by (hours)"
              error={form.formState.errors.additionalHours?.message}
            >
              <Input
                type="number"
                inputMode="numeric"
                {...form.register("additionalHours")}
              />
            </Field>
          </div>

          <Field
            label="Current Location"
            error={form.formState.errors.fromPlace?.message}
          >
            <Input
              placeholder="Where the consignment is right now"
              {...form.register("fromPlace")}
            />
          </Field>

          <Field
            label="Reason for Extension"
            error={form.formState.errors.extnRsnCode?.message}
          >
            <Controller
              control={form.control}
              name="extnRsnCode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTEND_REASONS.map((r) => (
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
            error={form.formState.errors.extnRemarks?.message}
          >
            <Input
              placeholder="Flooded highway near Pune, awaiting clearance"
              {...form.register("extnRemarks")}
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
              {mutation.isPending ? "Extending…" : "Extend Validity"}
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
