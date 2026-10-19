"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import type { MyWorkQueue, MyWorkScope } from "@skerp/types";
import { formatPaiseCompact } from "@/lib/money";
import { myWorkApi } from "../my-work.service";
import { myWorkKeys } from "../my-work.keys";
import { MyWorkRowItem } from "./MyWorkRowItem";

type Props = {
  queue: MyWorkQueue;
  /** active = real work; stale = old clutter to clean up. */
  scope: MyWorkScope;
};

export function MyWorkQueueCard({ queue, scope }: Props) {
  const isStale = scope === "stale";
  const [expanded, setExpanded] = React.useState(false);

  // Active cards start from the rows the overview already carries; they only
  // go to the server once "Show more" is pressed. Stale cards always load.
  const more = useInfiniteQuery({
    queryKey: myWorkKeys.rows(queue.key, scope),
    queryFn: ({ pageParam }) => myWorkApi.rows(queue.key, scope, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) =>
      last.remaining > 0
        ? all.reduce((n, page) => n + page.rows.length, 0)
        : undefined,
    enabled: isStale || expanded,
  });

  const loadedRows = more.data?.pages.flatMap((p) => p.rows);
  const rows = isStale || expanded ? loadedRows : queue.rows;
  const total = isStale ? queue.stale : queue.waiting;
  const remaining = Math.max(0, total - (rows?.length ?? 0));
  const loadingFirst = (isStale || expanded) && more.isPending;

  const onShowMore = () => {
    if (!isStale && !expanded) setExpanded(true);
    else void more.fetchNextPage();
  };

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            {queue.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isStale
              ? `Older than ${queue.staleAfterDays} days. Probably clutter. Finish it or close it.`
              : queue.reason}
          </p>
        </div>
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span>{" "}
          {isStale ? "stale" : "waiting"}
          {!isStale && queue.late > 0 && (
            <>
              {" · "}
              <span className="font-medium text-destructive">
                {queue.late} late
              </span>
            </>
          )}
          {!isStale && queue.amountPaise !== null && (
            <>
              {" · "}
              <span className="font-medium text-foreground">
                {formatPaiseCompact(Number(queue.amountPaise))}
              </span>
            </>
          )}
        </p>
      </header>

      {loadingFirst ? (
        <div className="space-y-3 px-4 py-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <ul className="divide-y">
          {(rows ?? []).map((row) => (
            <MyWorkRowItem
              key={row.id}
              row={row}
              actionLabel={queue.actionLabel}
              lateAfterDays={queue.lateAfterDays}
            />
          ))}
        </ul>
      )}

      <footer className="flex items-center justify-between gap-3 border-t px-4 py-2">
        {remaining > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowMore}
            disabled={more.isFetchingNextPage || (expanded && more.isPending)}
          >
            Show {remaining} more
          </Button>
        ) : (
          <span />
        )}
        <Button asChild variant="link" size="sm">
          <Link href={queue.listHref}>Open full list</Link>
        </Button>
      </footer>
    </section>
  );
}
