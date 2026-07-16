"use client";

import { prefillVehicle } from "@skerp/dev-tools/prefill/vehicle";
import type {
  VehiclePrefillOptions,
  VehicleFormPrefill,
} from "@skerp/dev-tools/prefill/vehicle";
import { useTestMode } from "./useTestMode";

export function usePrefillVehicle(
  opts: VehiclePrefillOptions
): (() => VehicleFormPrefill) | null {
  const isTestMode = useTestMode();
  if (!isTestMode) return null;
  return () => prefillVehicle(opts);
}
