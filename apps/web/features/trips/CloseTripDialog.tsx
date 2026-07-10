"use client";

import * as React from "react";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripNumber?: string;
  openingKm?: number;
  /** Closing the return leg brings the whole journey back to base. */
  isReturnLeg?: boolean;
  isPending?: boolean;
  onConfirm: (closingKm: number) => void | Promise<void>;
};

/** Captures the closing odometer reading when an InTransit trip is closed. */
export default function CloseTripDialog({
  open,
  onOpenChange,
  tripNumber,
  openingKm,
  isReturnLeg,
  isPending,
  onConfirm,
}: Props) {
  const [closingKm, setClosingKm] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setClosingKm("");
      setTouched(false);
    }
  }, [open]);

  const value = Number(closingKm);
  const belowOpening = openingKm !== undefined && value < openingKm;
  const invalid = !Number.isInteger(value) || value <= 0 || belowOpening;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close trip {tripNumber ?? ""}</DialogTitle>
          <DialogDescription>
            {isReturnLeg
              ? "This is the return leg — closing it returns the journey to base, releases the vehicle and driver, and moves the journey to settlement review."
              : "Record the vehicle's closing KM. The trip moves to Closed."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Closing KM <span className="text-red-600">*</span>
          </label>
          <Input
            type="number"
            min={openingKm ?? 1}
            value={closingKm}
            onChange={(e) => setClosingKm(e.target.value)}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={isPending || invalid}
            onClick={() => {
              setTouched(true);
              if (!invalid) void onConfirm(value);
            }}
          >
            {isPending ? "Closing…" : "Close trip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
