"use client";

import { IconCheck, IconCircleDashed, type Icon } from "@tabler/icons-react";
import { cn } from "@skerp/ui/lib/util";
import { ProgressBar } from "./ProgressBar";

export type LessonListItem = {
  key: string;
  title: string;
  /** Lane heading this lesson sits under. */
  group: string;
  icon: Icon;
  done: boolean;
  skipped: boolean;
};

/**
 * The lesson list beside a lesson: grouped by the lane the work belongs to,
 * each row with its own icon and a tick once it is done. Seven flat rows read
 * as a wall; three small groups read as the business flow.
 */
export function LessonList({
  items,
  currentIndex,
  finished,
  total,
  percent,
  onPick,
}: {
  items: LessonListItem[];
  currentIndex: number;
  finished: number;
  total: number;
  percent: number;
  onPick: (index: number) => void;
}) {
  const groups: {
    group: string;
    rows: { item: LessonListItem; index: number }[];
  }[] = [];
  items.forEach((item, index) => {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) last.rows.push({ item, index });
    else groups.push({ group: item.group, rows: [{ item, index }] });
  });

  return (
    <nav
      aria-label="Lessons"
      className="border-b border-border bg-background md:border-b-0 md:border-r"
    >
      <div className="space-y-2 border-b border-border px-4 py-3.5">
        <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          Your progress
        </p>
        <ProgressBar percent={percent} label="Training progress" />
        <p className="text-xs text-muted-foreground">
          {finished} of {total} lessons done
        </p>
      </div>

      <div className="pb-2 pt-1">
        {groups.map(({ group, rows }) => (
          <div key={group}>
            {groups.length > 1 ? (
              <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
                {group}
              </p>
            ) : null}
            <ul className="px-2">
              {rows.map(({ item, index }) => {
                const current = index === currentIndex;
                const RowIcon: Icon = item.icon;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onPick(index)}
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150",
                        current
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                          item.done
                            ? "border-success bg-success text-success-foreground"
                            : current
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        {item.done ? (
                          <IconCheck className="size-2.5" aria-hidden />
                        ) : item.skipped ? (
                          <IconCircleDashed className="size-3" aria-hidden />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <RowIcon
                        className={cn(
                          "size-4 shrink-0",
                          current ? "text-primary" : "opacity-75",
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-sm leading-snug",
                          current ? "font-semibold" : undefined,
                        )}
                      >
                        {item.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
