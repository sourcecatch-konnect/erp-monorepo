"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { VehicleJourney, JourneyLeg } from "@skerp/types";
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
import { DateTimePicker } from "@skerp/ui/components/datetimepicker";
import { Textarea } from "@skerp/ui/components/textarea";

import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import { toLocalDateTimeValue, toValidDate } from "@/lib/date";
import { journeyApi } from "./journey.service";
import { journeyKeys } from "./journey.keys";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journey: VehicleJourney;
  leg: JourneyLeg | null;
};

/**
 * Closes an in-transit journey leg: closing KM + times. If the leg's
 * destination is the journey's return city, closing it returns the whole
 * journey (vehicle & driver released, settlement review begins).
 */
export default function CloseLegDialog({
  open,
  onOpenChange,
  journey,
  leg,
}: Props) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);

  const [closingKm, setClosingKm] = React.useState("");
  const [endDateTime, setEndDateTime] = React.useState("");
  const [unloadingAt, setUnloadingAt] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setClosingKm("");
      setEndDateTime("");
      setUnloadingAt("");
      setRemarks("");
      setTouched(false);
    }
  }, [open]);

  if (!leg) return null;

  const isReturnToBase = leg.toCityId === journey.returnCityId;
  const value = Number(closingKm);
  const belowOpening = value < leg.openingKm;
  const invalid = !Number.isInteger(value) || value <= 0 || belowOpening;

  const onConfirm = async () => {
    setTouched(true);
    if (invalid) return;
    setSubmitting(true);
    try {
      await journeyApi.closeLeg(journey.id, leg.id, {
        closingKm: value,
        endDateTime: endDateTime ? new Date(endDateTime) : undefined,
        unloadingCompletedAt: unloadingAt ? new Date(unloadingAt) : undefined,
        closeReason: remarks || undefined,
      });
      toast.success(
        isReturnToBase ? "Leg closed — journey returned to base" : "Leg closed",
      );
      queryClient.invalidateQueries({ queryKey: journeyKeys.all });
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Close leg {leg.sequenceNo ?? ""} — {leg.fromCity?.name} →{" "}
            {leg.toCity?.name}
          </DialogTitle>
          <DialogDescription>
            Record arrival and the closing odometer reading.
          </DialogDescription>
        </DialogHeader>

        {isReturnToBase ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
            This leg returns the vehicle to base ({journey.returnCity?.name}).
            Closing it marks the journey <strong>Returned</strong> and starts
            log slip review. The vehicle and driver become available.
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Closing KM <span className="text-red-600">*</span>
            </label>
            <Input
              type="number"
              min={leg.openingKm}
              value={closingKm}
              onChange={(e) => setClosingKm(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={`≥ ${leg.openingKm}`}
              aria-invalid={touched && invalid}
            />
            {touched && invalid ? (
              <p className="text-xs text-red-600">
                {belowOpening
                  ? `Closing KM can't be less than opening KM (${leg.openingKm}).`
                  : "Enter a positive closing KM reading."}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Arrival / end date-time
            </label>
            <DateTimePicker
              selected={toValidDate(endDateTime)}
              onSelect={(date) =>
                setEndDateTime(date ? toLocalDateTimeValue(date) : "")
              }
              placeholder="Select arrival date and time"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Unloading completed at
            </label>
            <DateTimePicker
              selected={toValidDate(unloadingAt)}
              onSelect={(date) =>
                setUnloadingAt(date ? toLocalDateTimeValue(date) : "")
              }
              placeholder="Select unloading completion date and time"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Remarks
            </label>
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes (damage, detention, exceptions…)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={submitting || (touched && invalid)}
            onClick={onConfirm}
          >
            {submitting
              ? "Closing…"
              : isReturnToBase
                ? "Close leg & return journey"
                : "Close leg"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
