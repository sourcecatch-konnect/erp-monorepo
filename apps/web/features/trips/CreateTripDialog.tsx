"use client";

import type { Trip } from "@skerp/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import TripForm from "./TripForm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (trip: Trip) => void;
  /** Prefills the client field — e.g. the consignor of the LR this trip is for. */
  defaultConsignorId?: string;
};

/** Lets a caller (e.g. Instant LR) create a trip without leaving its own form. */
export default function CreateTripDialog({
  open,
  onOpenChange,
  onCreated,
  defaultConsignorId,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] !max-w-[1100px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Trip</DialogTitle>
          <DialogDescription>
            Save a trip here and it will be selected automatically once
            created.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TripForm
            mode="create"
            embedded
            defaultConsignorId={defaultConsignorId}
            onCreated={(trip) => {
              onOpenChange(false);
              onCreated(trip);
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
