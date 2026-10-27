"use client";

import * as React from "react";
import Link from "next/link";
import {
  IconArchive,
  IconCircleCheck,
  IconExternalLink,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import type { MyWorkModule, MyWorkQueue, MyWorkQueueKey } from "@skerp/types";
import { AreaCards } from "./AreaCards";
import { AreaSections } from "./AreaSections";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import { myWorkApi, type MyWorkListFilter } from "../my-work.service";
import { myWorkKeys } from "../my-work.keys";
import { MODULES } from "./modules";
import { MyWorkRowItem } from "./MyWorkRowItem";
import { QUICK_BY_QUEUE, type QuickAction } from "./quick";

export type View = "waiting" | "late" | "stale";

const PAGE_SIZES = [5, 10, 20, 50] as const;

const countFor = (q: MyWorkQueue, view: View) =>
  view === "late" ? q.late : view === "stale" ? q.stale : q.waiting;

function EmptyState({ view, search }: { view: View; search: string }) {
  const [title, body] = search
    ? [
      `Nothing matches “${search}”`,
      "Search looks at the document number and party name. Try fewer letters.",
    ]
    : view === "stale"
      ? ["No old leftovers", "Nothing has been stuck for a long time. Good."]
      : view === "late"
        ? ["Nothing is late", "Everything here is within its time limit."]
        : [
          "All caught up",
          "Nothing is waiting here. New work shows up as orders, LRs and bills move forward.",
        ];
  const IconCmp = search ? IconSearch : IconCircleCheck;
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <IconCmp
        className={cn("size-10", search ? "text-muted-foreground" : "text-success")}
      />
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

/** Small pill button used for the step chips and the view switch. */
function Pill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors disabled:opacity-50",
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Count({ n, tone }: { n: number; tone?: "late" }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 text-xs tabular-nums",
        tone === "late" && n > 0
          ? "bg-warning/15 text-warning"
          : "bg-muted text-muted-foreground",
      )}
    >
      {n.toLocaleString("en-IN")}
    </span>
  );
}

/**
 * The work itself. Narrowed by the area card above, then by step, then by
 * view (waiting / late / old leftovers) and search. Most urgent first.
 * Area, step and view live in the page URL (see MyWorkPage); search and
 * paging are local. Keyed by area in the parent, so a new area starts fresh.
 */
export function WorkList({
  queues,
  module,
  branch,
  queue,
  view,
  onQueue,
  onView,
  onArea,
  onQuick,
}: {
  queues: MyWorkQueue[];
  module: MyWorkModule | null;
  branch: string | null;
  queue: MyWorkQueueKey | null;
  view: View;
  onQueue: (queue: MyWorkQueueKey | null) => void;
  onView: (view: View) => void;
  onArea: (module: MyWorkModule | null) => void;
  onQuick: (action: QuickAction) => void;
}) {
  const setQueue = onQueue;
  const setView = onView;
  const [searchText, setSearchText] = React.useState("");
  const search = useDebouncedValue(searchText.trim());
  const [size, setSize] = React.useState<number>(10);

  const filter: MyWorkListFilter = {
    module,
    queue,
    urgency: view === "late" ? "late" : "all",
    scope: view === "stale" ? "stale" : "active",
    search,
    branch,
  };
  // The page belongs to one filter; any change starts from page 1.
  const filterKey = JSON.stringify(filter);
  const [paging, setPaging] = React.useState({ key: filterKey, page: 0 });
  const page = paging.key === filterKey ? paging.page : 0;
  const setPage = (p: number) => setPaging({ key: filterKey, page: p });

  /**
   * With no area picked and nothing typed, the work reads better grouped by
   * area than as one merged page — see AreaSections. Searching, narrowing to
   * an area, or switching to late/leftovers all want the ranked flat list
   * instead, so the two swap automatically rather than behind a toggle.
   */
  const grouped = module === null && view === "waiting" && search === "";

  const list = useQuery({
    queryKey: myWorkKeys.list(filter, page, size),
    queryFn: () => myWorkApi.list(filter, page * size, size),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    // The sections fetch per area; this page would be thrown away.
    enabled: !grouped,
  });
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  const area = MODULES.find((m) => m.key === module) ?? null;
  const inArea = module ? queues.filter((q) => q.module === module) : queues;
  const inScope = queue ? inArea.filter((q) => q.key === queue) : inArea;
  const viewCount = (v: View) => inScope.reduce((n, q) => n + countFor(q, v), 0);
  const byKey = new Map(queues.map((q) => [q.key, q]));
  const step = queue ? byKey.get(queue) ?? null : null;

  return (
    <section className="min-w-0 rounded-lg border bg-card">
      {/* Title + search */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            To do
            {area && (
              <span className="font-normal text-muted-foreground"> · {area.label}</span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {area
              ? `${area.covers}. Most urgent first.`
              : grouped
                ? "Everything waiting on you, grouped by work area."
                : "Everything waiting on you, most urgent first."}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search my work"
            placeholder="Search number or party…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSearchText("")}
            className="h-9 pl-9 pr-8"
          />
          {searchText && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchText("")}
              className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconX className="size-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Filters: area, then steps inside it, then which items */}
      <div className="space-y-3 border-b bg-muted/30 px-4 py-3">
        <AreaCards queues={queues} value={module} onChange={onArea} />

        {area && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-muted-foreground">
              Step
            </span>
            <Pill active={queue === null} onClick={() => setQueue(null)}>
              All steps
              <Count n={inArea.reduce((n, q) => n + countFor(q, view), 0)} />
            </Pill>
            {inArea.map((q) => (
              <Pill
                key={q.key}
                active={queue === q.key}
                onClick={() => setQueue(queue === q.key ? null : q.key)}
              >
                {q.title}
                <Count n={countFor(q, view)} tone={view === "late" ? "late" : undefined} />
              </Pill>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Show
          </span>
          <Pill active={view === "waiting"} onClick={() => setView("waiting")}>
            Waiting
            <Count n={viewCount("waiting")} />
          </Pill>
          <Pill active={view === "late"} onClick={() => setView("late")}>
            Late only
            <Count n={viewCount("late")} tone="late" />
          </Pill>
          <Pill
            active={view === "stale"}
            disabled={viewCount("stale") === 0 && view !== "stale"}
            onClick={() => setView("stale")}
          >
            <IconArchive className="size-3.5" />
            Old leftovers
            <Count n={viewCount("stale")} />
          </Pill>
        </div>

        {(step || view === "stale") && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {view === "stale"
                ? "Very old items, probably finished outside the ERP and never closed. Open each one to finish or cancel it."
                : step?.reason}
            </span>
            {step && (
              <Link
                href={step.listHref}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Open full list
                <IconExternalLink className="size-3.5" />
              </Link>
            )}
          </p>
        )}
      </div>

      {grouped ? (
        <div className="p-4">
          <AreaSections
            queues={queues}
            branch={branch}
            onArea={onArea}
            onQuick={onQuick}
          />
        </div>
      ) : list.isPending ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState view={view} search={search} />
      ) : (
        <ul className="divide-y">
          {rows.map((row, i) => {
            const kind = QUICK_BY_QUEUE[row.queueKey];
            return (
              <MyWorkRowItem
                key={`${row.queueKey}:${row.id}`}
                row={row}
                primary={view !== "stale" && page === 0 && i === 0}
                stale={view === "stale"}
                actionLabel={row.actionLabel}
                lateAfterDays={row.lateAfterDays}
                // With one step picked, every row is that step; don't repeat it.
                queueTitle={queue ? undefined : row.queueTitle}
                needsApproval={byKey.get(row.queueKey)?.section === "approval"}
                onAction={
                  kind
                    ? () => onQuick({ kind, id: row.id, number: row.number, row })
                    : undefined
                }
              />
            );
          })}
        </ul>
      )}

      {!grouped && total > 0 && (
        <div className="border-t px-4 py-3">
          <TablePaginationFooter
            total={total}
            page={page}
            size={size}
            onPageChange={setPage}
            onSizeChange={(s) => {
              setSize(s);
              setPage(0);
            }}
            pageSizeOptions={PAGE_SIZES}
          />
        </div>
      )}
    </section>
  );
}
