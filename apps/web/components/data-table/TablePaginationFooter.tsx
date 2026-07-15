"use client";

import * as React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@skerp/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

type Props = {
  total: number;
  /** Zero-based page index. */
  page: number;
  size: number;
  onPageChange: (page: number) => void;
  /** Omit to hide the rows-per-page selector. */
  onSizeChange?: (size: number) => void;
  pageSizeOptions?: readonly number[];
};

/** "Showing X–Y of Z" + rows-per-page + Prev/Next, below every list table. */
export function TablePaginationFooter({
  total,
  page,
  size,
  onPageChange,
  onSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / size));

  return (
    <div className="flex flex-col gap-3 border-t px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          {total === 0
            ? "Showing 0"
            : `Showing ${page * size + 1}-${Math.min((page + 1) * size, total)}`}{" "}
          of {total}
        </span>

        {onSizeChange ? (
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={String(size)}
              onValueChange={(v) => onSizeChange(Number(v))}
            >
              <SelectTrigger size="sm" className="h-8 w-[72px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <span>
          Page {page + 1} of {pageCount}
        </span>
      </div>

      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page === 0}
              className={page === 0 ? "pointer-events-none opacity-50" : ""}
              onClick={(e) => {
                e.preventDefault();
                if (page > 0) onPageChange(page - 1);
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page + 1 >= pageCount}
              className={
                page + 1 >= pageCount ? "pointer-events-none opacity-50" : ""
              }
              onClick={(e) => {
                e.preventDefault();
                if (page + 1 < pageCount) onPageChange(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
