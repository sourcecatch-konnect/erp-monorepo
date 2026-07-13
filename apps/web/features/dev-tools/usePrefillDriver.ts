"use client";

import { prefillDriver } from "@skerp/dev-tools/prefill/driver";
import type {
  DriverPrefillOptions,
  DriverFormPrefill,
} from "@skerp/dev-tools/prefill/driver";
import { useTestMode } from "./useTestMode";

export function usePrefillDriver(
  opts: DriverPrefillOptions
): (() => DriverFormPrefill) | null {
  const isTestMode = useTestMode();
  if (!isTestMode) return null;
  return () => prefillDriver(opts);
}
