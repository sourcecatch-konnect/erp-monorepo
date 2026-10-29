"use client";

import { useCallback, useSyncExternalStore } from "react";
import { HI, HI_LIST } from "./dictionary.hi";

export type TrainingLanguage = "en" | "hi";

export const TRAINING_LANGUAGES: {
  key: TrainingLanguage;
  label: string;
  /** The language's own name, which is what a reader looks for. */
  native: string;
}[] = [
  { key: "en", label: "English", native: "English" },
  { key: "hi", label: "Hindi", native: "हिंदी" },
];

const STORAGE_KEY = "skerp.training.language";

/*
 * A module-level store rather than a React context, so no provider has to be
 * threaded through the dashboard layout: the training screens are separate
 * routes and only they read this.
 *
 * Kept in localStorage, which is per-device. Storing it per user needs a
 * column on the user (the existing user-pref module is table layouts only,
 * keyed by tableKey), so that is a follow-up rather than part of this step.
 */
let current: TrainingLanguage = "en";
let loaded = false;
const listeners = new Set<() => void>();

const read = (): TrainingLanguage => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "hi" ? "hi" : "en";
  } catch {
    // Private windows and blocked site data both throw here.
    return "en";
  }
};

const subscribe = (listener: () => void) => {
  if (!loaded) {
    loaded = true;
    current = read();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): TrainingLanguage => {
  if (!loaded) {
    loaded = true;
    current = read();
  }
  return current;
};

/** The server render has no localStorage, so it always renders English. */
const getServerSnapshot = (): TrainingLanguage => "en";

export const setTrainingLanguage = (next: TrainingLanguage) => {
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not being able to remember the choice is not a reason to refuse it.
  }
  for (const listener of listeners) listener();
};

export const useTrainingLanguage = (): TrainingLanguage =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export type Translate = {
  lang: TrainingLanguage;
  /**
   * One string. `english` is the text already in the content files and is
   * always the fallback, so a missing translation shows English rather than a
   * blank or a key name.
   */
  t: (id: string, english: string) => string;
  /** The same, for text that may be absent in the content itself. */
  tMaybe: (id: string, english: string | undefined) => string | undefined;
  /**
   * A whole list. Lists are positional, so a translation is used only when it
   * has exactly as many entries as the English — otherwise the English list is
   * returned whole, and a reader never sees a half-translated sequence.
   */
  tList: <T extends readonly string[]>(
    id: string,
    english: T,
  ) => readonly string[];
};

/**
 * The training screens' translator.
 *
 *   const { t } = useTranslate();
 *   <p>{t(`stage.${key}.explain`, content.explain)}</p>
 */
export function useTranslate(): Translate {
  const lang = useTrainingLanguage();

  const t = useCallback(
    (id: string, english: string) =>
      lang === "en" ? english : (HI[id] ?? english),
    [lang],
  );

  const tMaybe = useCallback(
    (id: string, english: string | undefined) =>
      lang === "en"
        ? english
        : english === undefined
          ? undefined
          : (HI[id] ?? english),
    [lang],
  );

  const tList = useCallback(
    <T extends readonly string[]>(
      id: string,
      english: T,
    ): readonly string[] => {
      if (lang === "en") return english;
      const translated = HI_LIST[id];
      return translated && translated.length === english.length
        ? translated
        : english;
    },
    [lang],
  );

  return { lang, t, tMaybe, tList };
}
