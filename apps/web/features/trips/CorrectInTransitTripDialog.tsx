"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CorrectInTransitTripBody,
  CorrectInTransitTripFormInput,
  Trip,
} from "@skerp/types";
import { correctInTransitTripSchema } from "@skerp/validators";
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
import { Textarea } from "@skerp/ui/components/textarea";

import { toLocalDateTimeValue, toValidDate } from "@/lib/date";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  isPending?: boolean;
  onConfirm: (values: CorrectInTransitTripBody) => void | Promise<void>;
};

function dateInput(value: string | null | undefined): string {
  const date = toValidDate(value);
  return date ? toLocalDateTimeValue(date) : "";
}

export default function CorrectInTransitTripDialog({
  open,
  onOpenChange,
  trip,
  isPending,
  onConfirm,
}: Props) {
  const form = useForm<
    CorrectInTransitTripFormInput,
    unknown,
    CorrectInTransitTripBody
  >({
    resolver: zodResolver(correctInTransitTripSchema),
    mode: "onChange",
  });

  React.useEffect(() => {
    if (!open || !trip) return;
    form.reset({
      startDateTime: dateInput(trip.startDateTime),
      correctionReason: "",
      version: trip.version,
    });
  }, [form, open, trip]);

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Correct start time — {trip?.tripNumber ?? ""}
          </DialogTitle>
          <DialogDescription>
            The reason and changed value are recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(onConfirm)}>
          <Controller
            control={form.control}
            name="startDateTime"
            render={({ field }) => (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Start date/time <span className="text-red-600">*</span>
                </label>
                <DateTimePicker
                  selected={toValidDate(field.value)}
                  onSelect={(date) =>
                    field.onChange(date ? toLocalDateTimeValue(date) : "")
                  }
                  placeholder="Select start date and time"
                />
                {errors.startDateTime?.message ? (
                  <p className="text-xs text-red-600">
                    {String(errors.startDateTime.message)}
                  </p>
                ) : null}
              </div>
            )}
          />

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Correction reason <span className="text-red-600">*</span>
            </label>
            <Textarea
              rows={3}
              placeholder="Explain why the start time is being corrected"
              aria-invalid={Boolean(errors.correctionReason)}
              {...form.register("correctionReason")}
            />
            {errors.correctionReason?.message ? (
              <p className="text-xs text-red-600">
                {String(errors.correctionReason.message)}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t pt-4">
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
