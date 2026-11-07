"use client";

import { useSyncExternalStore } from "react";

/**
 * How the reader wants to be read to: whether at all, and how fast.
 *
 * Read-aloud is opt-outable on purpose. A voice that cannot be switched off
 * is the fastest way to make people avoid the training screens altogether, so
 * `enabled: false` removes every play button from the page rather than just
 * silencing it — a button that does nothing is worse than no button.
 *
 * Deliberately a module store in localStorage, matching its sibling
 * `../i18n`: the training screens are their own routes, so neither needs a
 * provider threaded through the dashboard layout, and both are per-device
 * reading preferences rather than account state. When the user-pref module
 * grows beyond table layouts, these two move together.
 */

export type VoicePrefs = {
  enabled: boolean;
  /** Playback rate. Shown as Slow / Normal / Fast, never as a number. */
  rate: number;
};

/** The three speeds offered, slowest first. */
export const VOICE_RATES: { rate: number; label: string }[] = [
  { rate: 0.8, label: "Slow" },
  { rate: 1, label: "Normal" },
  { rate: 1.25, label: "Fast" },
];

const DEFAULT: VoicePrefs = { enabled: true, rate: 1 };
const STORAGE_KEY = "skerp.training.voice";

let current: VoicePrefs = DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

const read = (): VoicePrefs => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT;
    const { enabled, rate } = parsed as Partial<VoicePrefs>;
    return {
      enabled: typeof enabled === "boolean" ? enabled : DEFAULT.enabled,
      // Anything not on the offered list is ignored, so a hand-edited or
      // stale value cannot leave someone stuck at an unusable speed.
      rate: VOICE_RATES.some((r) => r.rate === rate) ? rate! : DEFAULT.rate,
    };
  } catch {
    // Private windows, blocked site data and malformed JSON all land here.
    return DEFAULT;
  }
};

const load = () => {
  if (loaded) return;
  loaded = true;
  current = read();
};

const subscribe = (listener: () => void) => {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): VoicePrefs => {
  load();
  return current;
};

/** The server render has no localStorage, so it renders the defaults. */
const getServerSnapshot = (): VoicePrefs => DEFAULT;

const write = (next: VoicePrefs) => {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not being able to remember the choice is no reason to refuse it.
  }
  for (const listener of listeners) listener();
};

export const setVoiceEnabled = (enabled: boolean) => {
  load();
  if (current.enabled === enabled) return;
  write({ ...current, enabled });
};

export const setVoiceRate = (rate: number) => {
  load();
  if (current.rate === rate) return;
  write({ ...current, rate });
};

/** Current rate without subscribing — for event handlers. */
export const voiceRate = (): number => {
  load();
  return current.rate;
};

export const useVoicePrefs = (): VoicePrefs =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
