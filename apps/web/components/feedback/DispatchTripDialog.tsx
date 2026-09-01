"use client";

import * as React from "react";
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
  entity: "trip" | "leg";
  reference?: string;
  isPending?: boolean;
  onConfirm: (values: { startDateTime: Date }) => void | Promise<void>;
};

/** Shared dispatch form for trips shown in either the Trips or Journey screen. */
export default function DispatchTripDialog({
  open,
  onOpenChange,
  entity,
  reference,
  isPending,
  onConfirm,
}: Props) {
  const [startDateTime, setStartDateTime] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStartDateTime("");
      setTouched(false);
    }
  }, [open]);

  const invalid = !startDateTime;
  const label = entity === "leg" ? "leg" : "trip";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Dispatch {label} {reference ?? ""}
          </DialogTitle>
          <DialogDescription>
            Record when the vehicle actually left — this moves the {label} to
            In Transit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Start date-time <span className="text-red-600">*</span>
            </label>
            <DateTimePicker
              selected={toValidDate(startDateTime)}
              onSelect={(date) => {
                setStartDateTime(date ? toLocalDateTimeValue(date) : "");
                setTouched(true);
              }}
              placeholder="Select start date and time"
            />
            {touched && invalid ? (
              <p className="text-xs text-red-600">
                Select the date and time the {label} actually started.
              </p>
            ) : null}
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
              void onConfirm({ startDateTime: new Date(startDateTime) });
            }}
          >
            {isPending ? "Dispatching…" : `Dispatch ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
