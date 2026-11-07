"use client";

import { cn } from "@/lib/utils";
import {
  TRAINING_LANGUAGES,
  setTrainingLanguage,
  useTrainingLanguage,
} from "./index";

/**
 * English / हिंदी.
 *
 * Each language is named in its own script, which is what a reader scans for.
 * Untranslated text stays English, so switching never leaves a blank on
 * screen.
 *
 * Its own component because it is needed on screens that have no training
 * nav — a lesson, most of all, which is the screen somebody reads for twenty
 * minutes and the one where the choice of language matters most.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const lang = useTrainingLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      {TRAINING_LANGUAGES.map((item) => {
        const on = item.key === lang;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => setTrainingLanguage(item.key)}
            className={cn(
              "border-s px-2.5 py-1 text-xs font-medium transition-colors duration-150 first:border-s-0",
              on
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.native}
          </button>
        );
      })}
    </div>
  );
}
