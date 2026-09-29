"use client";

import * as React from "react";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { TableCell, TableRow } from "@skerp/ui/components/table";

/**
 * Footer for a list loaded in chunks via `useInfiniteQuery` rather than
 * `TablePaginationFooter`'s Prev/Next paging. Pass `total` when the server
 * reports one; a list that only knows whether another chunk exists (no count
 * query) omits it.
 */
export function LoadMoreFooter({
  shown,
  total,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  shown: number;
  total?: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        {total !== undefined
          ? `Showing ${shown} of ${total}`
          : hasNextPage
            ? `${shown} loaded so far`
            : `${shown} in total`}
      </p>
      {hasNextPage ? (
        <Button variant="outline" onClick={onLoadMore} disabled={isFetchingNextPage}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}

/** Placeholder rows shown while the next chunk of a list is being fetched. */
export function SkeletonTableRows({
  columns,
  rows = 3,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={`skeleton-${row}`}>
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column}>
              <Skeleton className="h-4 w-full max-w-28" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
