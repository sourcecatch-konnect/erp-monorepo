"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CorrectClosedTripBody,
  CorrectClosedTripFormInput,
  Trip,
} from "@skerp/types";
import { correctClosedTripSchema } from "@skerp/validators";
import { Button } from "@skerp/ui/components/button";
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";

import { toLocalDateTimeValue, toValidDate } from "@/lib/date";
import { paiseToRupees } from "@/lib/money";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  isPending?: boolean;
  onConfirm: (values: CorrectClosedTripBody) => void | Promise<void>;
};

function dateInput(value: string | null | undefined): string {
  const date = toValidDate(value);
  return date ? toLocalDateTimeValue(date) : "";
}

export default function CorrectClosedTripDialog({
  open,
  onOpenChange,
  trip,
  isPending,
  onConfirm,
}: Props) {
  const form = useForm<
    CorrectClosedTripFormInput,
    unknown,
    CorrectClosedTripBody
  >({
    resolver: zodResolver(correctClosedTripSchema),
    mode: "onChange",
  });

  React.useEffect(() => {
    if (!open || !trip) return;
    form.reset({
      onwardFreight: paiseToRupees(Number(trip.onwardFreight)),
      closingKm: trip.closingKm ?? trip.openingKm,
      endDateTime: dateInput(trip.endDateTime),
      arrivalDateTime: dateInput(trip.arrivalDateTime),
      unloadingCompletedAt: dateInput(trip.unloadingCompletedAt),
      closeReason: trip.closeReason ?? "",
      correctionReason: "",
      version: trip.version,
    });
  }, [form, open, trip]);

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Correct trip {trip?.tripNumber ?? ""}</DialogTitle>
          <DialogDescription>
            Freight and closure details can be corrected. The reason and all
            changed values are recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={form.handleSubmit(onConfirm)}
        >
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Onward freight (₹) <span className="text-red-600">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              aria-invalid={Boolean(errors.onwardFreight)}
              {...form.register("onwardFreight")}
            />
            {errors.onwardFreight?.message ? (
              <p className="text-xs text-red-600">
                {String(errors.onwardFreight.message)}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Closing KM <span className="text-red-600">*</span>
            </label>
            <Input
              type="number"
              min={trip?.openingKm ?? 1}
              aria-invalid={Boolean(errors.closingKm)}
              {...form.register("closingKm")}
            />
            {errors.closingKm?.message ? (
              <p className="text-xs text-red-600">
                {String(errors.closingKm.message)}
              </p>
            ) : null}
          </div>

          <Controller
            control={form.control}
            name="endDateTime"
            render={({ field }) => (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Trip closing date/time <span className="text-red-600">*</span>
                </label>
                <DateTimePicker
                  selected={toValidDate(field.value)}
                  onSelect={(date) =>
                    field.onChange(date ? toLocalDateTimeValue(date) : "")
                  }
                  placeholder="Select closing date and time"
                />
                {errors.endDateTime?.message ? (
                  <p className="text-xs text-red-600">
                    {String(errors.endDateTime.message)}
                  </p>
                ) : null}
              </div>
            )}
          />

          <Controller
            control={form.control}
            name="arrivalDateTime"
            render={({ field }) => (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Arrival date/time
                </label>
                <DateTimePicker
                  selected={toValidDate(field.value)}
                  onSelect={(date) =>
                    field.onChange(date ? toLocalDateTimeValue(date) : "")
                  }
                  placeholder="Select arrival date and time"
                />
              </div>
            )}
          />

          <Controller
            control={form.control}
            name="unloadingCompletedAt"
            render={({ field }) => (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Unloading completion time
                </label>
                <DateTimePicker
                  selected={toValidDate(field.value)}
                  onSelect={(date) =>
                    field.onChange(date ? toLocalDateTimeValue(date) : "")
                  }
                  placeholder="Select unloading completion time"
                />
              </div>
            )}
          />

          <div className="col-span-full grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Closing reason / operational remarks
            </label>
            <Textarea rows={2} {...form.register("closeReason")} />
          </div>

          <div className="col-span-full grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Correction reason <span className="text-red-600">*</span>
            </label>
            <Textarea
              rows={3}
              placeholder="Explain why these closed-trip details are being corrected"
              aria-invalid={Boolean(errors.correctionReason)}
              {...form.register("correctionReason")}
            />
            {errors.correctionReason?.message ? (
              <p className="text-xs text-red-600">
                {String(errors.correctionReason.message)}
              </p>
            ) : null}
          </div>

          <DialogFooter className="col-span-full border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving correction…" : "Save correction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
