"use client";

import { FEEDBACK_CATEGORY_LABELS } from "@skerp/validators";
import type {
  FeedbackCategory,
  FeedbackStatus,
  FeedbackSummary,
} from "@skerp/types";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { CATEGORY_META, CATEGORY_ORDER } from "../categories";

type StatusFilter = FeedbackStatus | "OPEN" | undefined;

const ROW_BUTTON =
  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted";

export function FeedbackSummaryCards({
  summary,
  status,
  category,
  pageTitle,
  onStatus,
  onCategory,
  onPage,
}: {
  summary: FeedbackSummary | undefined;
  status: StatusFilter;
  category: FeedbackCategory | undefined;
  pageTitle: string | undefined;
  onStatus: (status: StatusFilter) => void;
  onCategory: (category: FeedbackCategory | undefined) => void;
  onPage: (page: { module: string; pageTitle: string }) => void;
}) {
  const s = summary?.byStatus;
  const tiles: {
    key: string;
    label: string;
    caption: string;
    value: number | undefined;
    filter: StatusFilter;
  }[] = [
    {
      key: "open",
      label: "Open",
      caption: "Not finished yet",
      value: s ? s.NEW + s.TRIAGED + s.IN_PROGRESS : undefined,
      filter: "OPEN",
    },
    {
      key: "new",
      label: "New",
      caption: "Nobody has looked at it yet",
      value: s?.NEW,
      filter: "NEW",
    },
    {
      key: "fixed",
      label: "Fixed",
      caption: "Ready for testers to check",
      value: s?.FIXED,
      filter: "FIXED",
    },
    {
      key: "all",
      label: "All feedback",
      caption: "Everything reported so far",
      value: summary?.total,
      filter: undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => {
          const active = status === tile.filter;
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={active}
              onClick={() => onStatus(tile.filter)}
              className={cn(
                "rounded-md border bg-card p-4 text-left transition-colors duration-150 hover:bg-muted",
                active ? "border-primary" : "border-border",
              )}
            >
              <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
              {tile.value === undefined ? (
                <Skeleton className="my-1 h-6 w-12" />
              ) : (
                <p className="text-xl font-semibold tabular-nums text-foreground">
                  {tile.value}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{tile.caption}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-3">
          <p className="px-3 pb-2 pt-1 text-sm font-semibold text-foreground">
            Pages with the most open feedback
          </p>
          {!summary ? (
            <div className="space-y-2 px-3 pb-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-5 w-full" />
              ))}
            </div>
          ) : summary.topPages.length === 0 ? (
            <p className="px-3 pb-2 text-sm text-muted-foreground">
              No open feedback right now.
            </p>
          ) : (
            summary.topPages.map((page) => (
              <button
                key={`${page.moduleLabel}-${page.pageTitle}`}
                type="button"
                onClick={() => onPage({ module: page.moduleLabel, pageTitle: page.pageTitle })}
                className={cn(ROW_BUTTON, pageTitle === page.pageTitle && "bg-muted")}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {page.pageTitle}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {page.moduleLabel}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {page.open} open
                </span>
              </button>
            ))
          )}
        </div>

        <div className="rounded-md border border-border bg-card p-3">
          <p className="px-3 pb-2 pt-1 text-sm font-semibold text-foreground">
            By type
          </p>
          {CATEGORY_ORDER.map((value) => {
            const TypeIcon = CATEGORY_META[value].icon;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onCategory(category === value ? undefined : value)}
                aria-pressed={category === value}
                className={cn(ROW_BUTTON, category === value && "bg-muted")}
              >
                <span className="flex items-center gap-2 text-foreground">
                  <TypeIcon className="size-4 text-muted-foreground" aria-hidden />
                  {FEEDBACK_CATEGORY_LABELS[value]}
                </span>
                {summary ? (
                  <span className="tabular-nums text-foreground">
                    {summary.byCategory[value]}
                  </span>
                ) : (
                  <Skeleton className="h-4 w-6" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
