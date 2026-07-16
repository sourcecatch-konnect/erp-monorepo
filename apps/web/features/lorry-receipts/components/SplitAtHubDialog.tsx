"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@skerp/ui/components/button";
import { Combobox } from "@skerp/ui/components/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { lrLookups, lrLookupKeys } from "../lorry-receipt.service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lrNumber: string;
  /** The leg-1 trip id, excluded from the leg-2 options. */
  primaryTripId?: string | null;
  /** The LR's consignor — leg-2 trip must carry the same client. */
  consignorId: string;
  isPending: boolean;
  onConfirm: (secondaryTripId: string) => void;
};

/**
 * HO action on a held-at-hub group: attach the leg-2 trip (hub → destination).
 * Second half of the decomposed hub split — the hold-at-hub action must have
 * run first. The hub itself is always the head office — never picked here.
 */
export default function SplitAtHubDialog({
  open,
  onOpenChange,
  lrNumber,
  primaryTripId,
  consignorId,
  isPending,
  onConfirm,
}: Props) {
  const [secondaryTripId, setSecondaryTripId] = React.useState("");

  const trips = useQuery({
    queryKey: lrLookupKeys.attachableTrips(consignorId),
    queryFn: () => lrLookups.attachableTrips(consignorId),
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) setSecondaryTripId("");
  }, [open]);

  const options = (trips.data ?? []).filter((t) => t.id !== primaryTripId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dispatch {lrNumber} from hub</DialogTitle>
          <DialogDescription>
            Attach the leg-2 trip (hub → destination). Once attached, that trip
            cannot close until every LR on it is delivered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Leg 2 trip <span className="text-red-600">*</span>
          </label>
          <Combobox
            options={options.map((t) => ({
              value: t.id,
              label: t.label,
              hint: t.hint,
              badge: t.badge,
            }))}
            value={secondaryTripId}
            onChange={setSecondaryTripId}
            placeholder="Select the hub → destination trip…"
            emptyText={
              trips.isLoading ? "Loading trips…" : "No unattached trips found"
            }
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !secondaryTripId}
            onClick={() => onConfirm(secondaryTripId)}
          >
            {isPending ? "Dispatching…" : "Dispatch from hub"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
