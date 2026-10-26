"use client";

import * as React from "react";

type SubmitState = { submitCount: number; isSubmitSuccessful: boolean };

/**
 * After a submit attempt fails validation, scrolls the first invalid field
 * inside `containerRef` into view and focuses it.
 *
 * Fields are found by `aria-invalid="true"` in DOM order, so this also reaches
 * Controller/setValue-driven fields (Combobox, Select, SuggestInput) that
 * react-hook-form's own `shouldFocusError` can't focus. Pair it with
 * `useForm({ shouldFocusError: false })` so the two don't fight over scroll.
 *
 * Runs as an effect keyed on `submitCount` — RHF publishes the errors and the
 * new count in the same update, so the error markers are in the DOM by then.
 */
export function useScrollToFirstError(
  containerRef: React.RefObject<HTMLElement | null>,
  { submitCount, isSubmitSuccessful }: SubmitState,
) {
  React.useEffect(() => {
    if (submitCount === 0 || isSubmitSuccessful) return;

    const field = containerRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    if (!field) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    field.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
    field.focus({ preventScroll: true });
  }, [containerRef, submitCount, isSubmitSuccessful]);
}
