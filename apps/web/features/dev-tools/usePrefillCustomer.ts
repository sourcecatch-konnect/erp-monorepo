"use client";

import { prefillCustomer } from "@skerp/dev-tools/prefill/customer";
import type { CustomerPrefillOptions, CustomerFormPrefill } from "@skerp/dev-tools/prefill/customer";
import { useTestMode } from "./useTestMode";

export function usePrefillCustomer(opts: CustomerPrefillOptions): (() => CustomerFormPrefill) | null {
  const isTestMode = useTestMode();
  if (!isTestMode) return null;
  return () => prefillCustomer(opts);
}
