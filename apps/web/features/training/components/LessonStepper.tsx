"use client";

import { IconCheck } from "@tabler/icons-react";
import { cn } from "@skerp/ui/lib/util";

export type LessonStepperItem = {
  key: string;
  title: string;
  done: boolean;
};

/**
 * The numbered steps of a track across the top of a lesson: done, the one
 * you are on, and the ones still ahead, joined by a line that fills in.
 * A bar alone says "43%"; this says "you are on step 3 of 7".
 *
 * Numbers only — the lesson list beside it carries the titles, and printing
 * them in both places reads as the same list twice.
 */
export function LessonStepper({
  items,
  currentIndex,
  onPick,
}: {
  items: LessonStepperItem[];
  currentIndex: number;
  onPick: (index: number) => void;
}) {
  return (
    <ol
      aria-label="Lessons in this training"
      className="flex items-center gap-1 overflow-x-auto border-b border-border px-5 py-3"
    >
      {items.map((item, index) => {
        const current = index === currentIndex;
        const passed = item.done || current;
        return (
          <li key={item.key} className="flex flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => onPick(index)}
              title={item.title}
              aria-label={`Lesson ${index + 1}: ${item.title}${item.done ? " (done)" : ""}`}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-150",
                item.done
                  ? "border-success bg-success text-success-foreground"
                  : current
                    ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {item.done ? (
                <IconCheck className="size-3.5" aria-hidden />
              ) : (
                index + 1
              )}
            </button>
            {index < items.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "h-0.5 min-w-3 flex-1",
                  passed ? "bg-success" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
