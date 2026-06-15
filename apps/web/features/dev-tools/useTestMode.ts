"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "skerp_test_mode";
const EVENT_KEY = "skerp:test-mode-change";

export function getTestMode(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === "true";
  return process.env.NEXT_PUBLIC_TEST_MODE === "true";
}

export function setTestMode(value: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(value));
  window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: value }));
}

export function useTestMode(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(getTestMode());
    const handler = (e: Event) => setActive((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENT_KEY, handler);
    return () => window.removeEventListener(EVENT_KEY, handler);
  }, []);

  return active;
}
