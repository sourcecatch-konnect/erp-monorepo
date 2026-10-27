"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconClockExclamation,
  IconInbox,
  IconRefresh,
  IconTrain,
  IconTruck,
} from "@tabler/icons-react";
import { StatTile } from "@skerp/ui/components/stat-tile";
import { Button } from "@skerp/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Skeleton } from "@skerp/ui/components/skeleton";
import type {
  MyWorkGoingOn,
  MyWorkModule,
  MyWorkQueue,
  MyWorkQueueKey,
} from "@skerp/types";
import { useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";
import { useMyWork } from "../hooks";
import { DoFirst } from "./DoFirst";
import { MODULES } from "./modules";
import { WorkList, type View } from "./WorkList";
import type { QuickAction } from "./quick";

// The dialogs pull in the order and LR screens, so load them only when a
// quick action is actually opened.
const QuickActions = dynamic(() => import("./QuickActions"), { ssr: false });

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const updatedAgo = (at: number) => {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return "just now";
  return mins === 1 ? "1 min ago" : `${mins} min ago`;
};

const MOVING_ICON: Record<MyWorkGoingOn["key"], typeof IconTruck> = {
  trips_in_transit: IconTruck,
  rakes_moving: IconTrain,
};

const VIEWS: View[] = ["waiting", "late", "stale"];

/**
 * Branch, area, step and view are kept in the address
 * (?branch=…&area=orders&step=…&show=late), so coming back from "Make LR" or a
 * document lands on the same list, and a filtered list can be shared.
 */
function useListState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const set = (
    next: Partial<Record<"branch" | "area" | "step" | "show", string | null>>,
  ) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return {
    branch: params.get("branch"),
    module: MODULES.find((m) => m.key === params.get("area"))?.key ?? null,
    stepParam: params.get("step"),
    view: VIEWS.find((v) => v === params.get("show")) ?? "waiting",
    setBranch: (b: string | null) => set({ branch: b, step: null }),
    // A new area starts with all its steps.
    setModule: (m: MyWorkModule | null) => set({ area: m, step: null }),
    setQueue: (q: MyWorkQueueKey | null) => set({ step: q }),
    setView: (v: View) => set({ show: v === "waiting" ? null : v }),
  };
}

/** A step only counts when the user has it and it sits in the picked area. */
const pickStep = (
  queues: MyWorkQueue[],
  module: MyWorkModule | null,
  step: string | null,
) =>
  queues.find((q) => q.key === step && (module === null || q.module === module))
    ?.key ?? null;

function PageSkeleton() {
  return (
    <div className="w-full space-y-4">
      <Skeleton className="h-14 w-80" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-32" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

/**
 * My Work, top to bottom:
 *   1. one sentence: how much needs you and how much is late
 *   2. the work itself, grouped by area, in the main column
 *   3. a rail beside it: "Do first", then what is already moving
 *
 * Steps 2 and 4 read the same endpoint and the same ranking; the difference is
 * only that 2 never filters by area. An item can appear in both, which is the
 * intent — the block answers "what now", the list answers "what else".
 */
export function MyWorkPage() {
  const { user } = useAuth();
  const list = useListState();
  const { data, dataUpdatedAt, isPending, isError, isFetching, refetch } =
    useMyWork(list.branch);
  const [quick, setQuick] = React.useState<QuickAction | null>(null);

  if (isPending) return <PageSkeleton />;

  if (isError || !data) {
    return (
      <div className="w-full rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Could not load your work.{" "}
        <Button variant="link" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { summary, queues, goingOn, branches } = data;
  const moving = goingOn.filter((g) => g.count > 0);
  const queue = pickStep(queues, list.module, list.stepParam);

  const movingCount = moving.reduce((total, item) => total + item.count, 0);

  return (
    <div className="w-full space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            My Work
          </h1>
          <p className="text-sm text-muted-foreground">
            {greeting()}
            {user?.role.name ? ` · ${user.role.name}` : ""}. Updated{" "}
            {updatedAgo(dataUpdatedAt)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Only worth showing to people who cover more than one branch. */}
          {branches.length > 1 && (
            <Select
              value={list.branch ?? "all"}
              onValueChange={(v) => list.setBranch(v === "all" ? null : v)}
            >
              <SelectTrigger
                size="sm"
                className="w-44"
                aria-label="Branch"
                title="Trips, trip expenses and log slips have no branch, so they always show."
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <IconRefresh className={cn(isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      {/*
        Four numbers instead of a sentence. "12 items need you, 3 late" is a
        line you read; these are read at a glance, and they match how the
        training screens now open.
      */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={IconInbox}
          tone={summary.needsYou === 0 ? "success" : "primary"}
          label="Needs you"
          value={summary.needsYou.toLocaleString("en-IN")}
          hint={summary.needsYou === 0 ? "All clear" : "Waiting on you"}
        />
        <StatTile
          icon={IconClockExclamation}
          tone={summary.late > 0 ? "warning" : "muted"}
          label="Late"
          value={summary.late.toLocaleString("en-IN")}
          hint={summary.late === 0 ? "Everything on time" : "Past its limit"}
        />
        <StatTile
          icon={IconAlertTriangle}
          tone={summary.veryLate > 0 ? "destructive" : "muted"}
          label="Very late"
          value={summary.veryLate.toLocaleString("en-IN")}
          hint={summary.veryLate === 0 ? "None" : "Deal with these first"}
        />
        <StatTile
          icon={IconTruck}
          tone="muted"
          label="Moving now"
          value={movingCount.toLocaleString("en-IN")}
          hint="No action needed"
        />
      </div>

      {/*
        Two columns on a wide screen: the work itself keeps the main column, so
        its rows never have to truncate an action button, and the rail holds
        what should stay in sight. The rail sticks and scrolls inside itself —
        on a short laptop screen it must never push the list down or trap it.

        Below lg the rail moves above the list, because on a phone "what do I
        do next" is the whole reason the page was opened. "Moving now" drops to
        the bottom there: it is reference, not work.
      */}
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          {/* Keyed so a new area starts on its first page with no step picked. */}
          <WorkList
            key={list.module ?? "all"}
            queues={queues}
            module={list.module}
            branch={list.branch}
            queue={queue}
            view={list.view}
            onQueue={list.setQueue}
            onView={list.setView}
            onArea={list.setModule}
            onQuick={setQuick}
          />
        </div>

        <aside className="order-first flex min-w-0 flex-col gap-4 lg:order-none lg:sticky lg:top-4 lg:col-span-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {/* Only while looking at every area on the waiting view: once a user
              has narrowed to one area or to leftovers they have already chosen
              what to work on, and a cross-area ranking is then just noise. */}
          {list.module === null && list.view === "waiting" ? (
            <DoFirst branch={list.branch} onQuick={setQuick} />
          ) : null}

          {moving.length > 0 && (
            <section className="order-last rounded-lg border bg-card lg:order-none">
              <h2 className="border-b px-4 py-2.5 text-sm font-semibold text-foreground">
                Moving now
              </h2>
              <p className="px-4 pt-2.5 text-xs text-muted-foreground">
                No action needed — this is where freight already is.
              </p>
              <ul className="px-4 pb-3 pt-1">
                {moving.map((g) => {
                  const IconCmp = MOVING_ICON[g.key];
                  return (
                    <li key={g.key}>
                      <Link
                        href={g.href}
                        className="flex items-center gap-2 py-1.5 text-sm text-foreground transition-colors duration-150 hover:text-primary"
                      >
                        <IconCmp className="size-4 shrink-0 text-muted-foreground" />
                        <b className="font-semibold tabular-nums">{g.count}</b>
                        <span className="truncate">
                          {g.key === "trips_in_transit"
                            ? "trucks in transit"
                            : "rakes moving"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <QuickActions action={quick} onClose={() => setQuick(null)} />
    </div>
  );
}
