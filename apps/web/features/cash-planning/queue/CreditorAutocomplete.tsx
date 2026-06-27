"use client";

import * as React from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";

import type { Creditor } from "@skerp/types";
import { Input } from "@skerp/ui/components/input";
import { cn } from "@skerp/ui/lib/util";
import { formatPaiseCompact } from "@/lib/money";

import { creditorApi } from "../../masters/creditor/creditor.service";
import { creditorKeys } from "../../masters/creditor/creditor.keys";
import { useDebouncedValue } from "../../masters/_shared/hooks/useDebouncedValue";

const PAGE_SIZE = 20;

type Props = {
  /** The free-text payee value (controlled). */
  value: string;
  /** Fired on every keystroke — free-text payee, no creditor link. */
  onValueChange: (value: string) => void;
  /** Fired when a creditor suggestion is picked. */
  onSelectCreditor: (creditor: Creditor) => void;
  /** Fired on Enter when no suggestion is highlighted (submit the form). */
  onEnterSubmit?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  className?: string;
  placeholder?: string;
};

/**
 * Free-text payee input with a creditor suggestion dropdown that searches the
 * server (debounced) and loads more on scroll — so we never fetch the whole
 * creditor table up front. Typing keeps the value as a free-text payee; picking
 * a suggestion links the creditor. Replaces the old fetch-200 + <datalist>.
 */
export default function CreditorAutocomplete({
  value,
  onValueChange,
  onSelectCreditor,
  onEnterSubmit,
  inputRef,
  className,
  placeholder = "Type payee…",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(-1);
  const listRef = React.useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebouncedValue(value, 300);

  const query = useInfiniteQuery({
    queryKey: creditorKeys.list({
      search: debouncedSearch,
      size: PAGE_SIZE,
      sort: "name:asc",
    }),
    queryFn: ({ pageParam = 0 }) =>
      creditorApi.list({
        page: pageParam,
        size: PAGE_SIZE,
        search: debouncedSearch,
        sort: "name:asc",
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((page) => page.data).length;
      const total = lastPage.meta?.total;
      if (typeof total === "number") {
        return loaded < total ? allPages.length : undefined;
      }
      return lastPage.data.length === PAGE_SIZE ? allPages.length : undefined;
    },
    placeholderData: keepPreviousData,
    enabled: open,
  });

  const creditors = React.useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );

  // Reset the keyboard highlight whenever the result set changes.
  React.useEffect(() => setHighlight(-1), [debouncedSearch]);

  const pick = (creditor: Creditor) => {
    onSelectCreditor(creditor);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setHighlight((h) => Math.min(h + 1, creditors.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const chosen = creditors[highlight];
      if (open && chosen) {
        e.preventDefault();
        pick(chosen);
      } else {
        onEnterSubmit?.();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const reachedBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (reachedBottom && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  };

  const showDropdown =
    open && (creditors.length > 0 || query.isFetching);

  return (
    <div className={cn("relative", className)}>
      <Input
        ref={inputRef}
        className="h-9 w-48"
        placeholder={placeholder}
        value={value}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />

      {showDropdown ? (
        <div
          ref={listRef}
          onScroll={onScroll}
          // mousedown (not click) so selecting fires before the input blur.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 mt-1 max-h-60 w-72 overflow-y-auto overscroll-contain rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {creditors.length === 0 && query.isFetching ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          ) : creditors.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No creditors found
            </div>
          ) : (
            creditors.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(c)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                  i === highlight ? "bg-accent text-accent-foreground" : "",
                )}
              >
                <span className="truncate font-medium">{c.name}</span>
                {c.outstandingBalance > 0 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatPaiseCompact(c.outstandingBalance)} due
                  </span>
                ) : null}
              </button>
            ))
          )}

          {query.hasNextPage ? (
            <div className="px-2 py-2 text-center text-xs text-muted-foreground">
              {query.isFetchingNextPage ? "Loading more…" : "Scroll to load more"}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
