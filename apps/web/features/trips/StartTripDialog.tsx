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
  isPending?: boolean;
  onConfirm: (openingKm: number) => void | Promise<void>;
};

/** Captures the opening odometer reading when a Planned trip starts. */
export default function StartTripDialog({
  open,
  onOpenChange,
  tripNumber,
  isPending,
  onConfirm,
}: Props) {
  const [openingKm, setOpeningKm] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setOpeningKm("");
      setTouched(false);
    }
  }, [open]);

  const value = Number(openingKm);
  const invalid = !Number.isInteger(value) || value <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start trip {tripNumber ?? ""}</DialogTitle>
          <DialogDescription>
            Record the vehicle&apos;s opening KM. The trip moves to In Transit and
            the vehicle is marked On Trip.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Opening KM <span className="text-red-600">*</span>
          </label>
          <Input
            type="number"
            min={1}
            value={openingKm}
            onChange={(e) => setOpeningKm(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. 145200"
            aria-invalid={touched && invalid}
          />
          {touched && invalid ? (
            <p className="text-xs text-red-600">
              Enter a positive opening KM reading.
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
            {isPending ? "Starting…" : "Start trip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
