"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  RescheduleTripBody,
  RescheduleTripFormInput,
  Trip,
} from "@skerp/types";
import { rescheduleTripSchema } from "@skerp/validators";
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

import { toLocalDateTimeValue, toValidDate } from "@/lib/date";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  isPending?: boolean;
  onConfirm: (values: RescheduleTripBody) => void | Promise<void>;
};

export default function RescheduleTripDialog({
  open,
  onOpenChange,
  trip,
  isPending,
  onConfirm,
}: Props) {
  const form = useForm<RescheduleTripFormInput, unknown, RescheduleTripBody>({
    resolver: zodResolver(rescheduleTripSchema),
  });

  React.useEffect(() => {
    if (!open || !trip) return;
    form.reset({
      plannedStartDateTime: trip.plannedStartDateTime
        ? toLocalDateTimeValue(new Date(trip.plannedStartDateTime))
        : "",
      version: trip.version,
    });
  }, [form, open, trip]);

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Reschedule planned dispatch — {trip?.tripNumber ?? ""}
          </DialogTitle>
          <DialogDescription>
            Sets the expected dispatch time. The trip stays Planned until it is
            dispatched. Leave empty to clear the schedule.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(onConfirm)}>
          <Controller
            control={form.control}
            name="plannedStartDateTime"
            render={({ field }) => (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Planned dispatch date/time{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <DateTimePicker
                  selected={toValidDate(field.value)}
                  onSelect={(date) =>
                    field.onChange(date ? toLocalDateTimeValue(date) : "")
                  }
                  placeholder="Select the scheduled dispatch time"
                />
                {errors.plannedStartDateTime?.message ? (
                  <p className="text-xs text-red-600">
                    {String(errors.plannedStartDateTime.message)}
                  </p>
                ) : null}
              </div>
            )}
          />

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
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
