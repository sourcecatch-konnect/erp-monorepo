"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
import { api } from "@/lib/api";
import type { ApiResponse, Vehicle } from "@skerp/types";
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripNumber?: string;
  isPending?: boolean;
  vehicleId?: string;
  onConfirm: (openingKm: number) => void | Promise<void>;
};

/** Captures the opening odometer reading when a Planned trip starts. */
export default function StartTripDialog({
  open,
  onOpenChange,
  tripNumber,
  isPending,
  vehicleId,
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

  const vehicleQuery = useQuery({
    queryKey: ["vehicle-current-km", vehicleId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Vehicle>>(`/vehicles/${vehicleId}`);
      return res.data.data;
    },
    enabled: open && Boolean(vehicleId),
    staleTime: 0,
    gcTime: 0,
  });
  console.log("vehicle data:", vehicleQuery.data, "currentKM:", vehicleQuery.data?.currentKM);
  const currentKm = vehicleQuery.data?.currentKM;

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
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Opening KM <span className="text-red-600">*</span>
            </label>
            {/* Current KM hint */}
            {vehicleQuery.isLoading ? (
              <span className="text-xs text-muted-foreground animate-pulse">
                Fetching current KM…
              </span>
            ) : currentKm != null ? (
              <span className="text-xs text-muted-foreground">
                Current KM —{" "}
                <span className="font-semibold text-foreground">
                  {Number(currentKm).toLocaleString("en-IN")} km
                </span>
              </span>
            ) : null}
          </div>

          <Input
            type="number"
            min={1}
            value={openingKm}
            onChange={(e) => setOpeningKm(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={
              currentKm != null
                ? `e.g. ${Number(currentKm).toLocaleString("en-IN")}`
                : "e.g. 145200"
            }
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
