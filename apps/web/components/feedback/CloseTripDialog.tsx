"use client";

import * as React from "react";
import type { CloseTripBody } from "@skerp/types";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: "trip" | "leg";
  reference?: string;
  openingKm?: number;
  isReturnToBase?: boolean;
  returnCityName?: string;
  isPending?: boolean;
  onConfirm: (values: CloseTripBody) => void | Promise<void>;
};

/** Shared close form for trips shown in either the Trips or Journey screen. */
export default function CloseTripDialog({
  open,
  onOpenChange,
  entity,
  reference,
  openingKm,
  isReturnToBase,
  returnCityName,
  isPending,
  onConfirm,
}: Props) {
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

  const value = Number(closingKm);
  const belowOpening = openingKm !== undefined && value < openingKm;
  const invalid = !Number.isInteger(value) || value <= 0 || belowOpening;
  const label = entity === "leg" ? "leg" : "trip";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Close {label} {reference ?? ""}
          </DialogTitle>
          <DialogDescription>
            Record arrival details and the vehicle&apos;s closing odometer
            reading.
          </DialogDescription>
        </DialogHeader>

        {isReturnToBase ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
            This {label} returns the vehicle to base
            {returnCityName ? ` (${returnCityName})` : ""}. Closing it marks the
            journey <strong>Returned</strong> and starts log slip review. The
            vehicle and driver become available.
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Closing KM <span className="text-red-600">*</span>
            </label>
            <Input
              type="number"
              min={openingKm ?? 1}
              value={closingKm}
              onChange={(event) => setClosingKm(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={openingKm ? `≥ ${openingKm}` : "e.g. 145800"}
              aria-invalid={touched && invalid}
            />
            {touched && invalid ? (
              <p className="text-xs text-red-600">
                {belowOpening
                  ? `Closing KM can't be less than opening KM (${openingKm}).`
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
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Optional notes (damage, detention, exceptions…)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={isPending || invalid}
            onClick={() => {
              setTouched(true);
              if (invalid) return;
              void onConfirm({
                closingKm: value,
                endDateTime: endDateTime ? new Date(endDateTime) : undefined,
                unloadingCompletedAt: unloadingAt
                  ? new Date(unloadingAt)
                  : undefined,
                closeReason: remarks || undefined,
              });
            }}
          >
            {isPending
              ? "Closing…"
              : entity === "leg" && isReturnToBase
                ? "Close leg & return journey"
                : `Close ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
