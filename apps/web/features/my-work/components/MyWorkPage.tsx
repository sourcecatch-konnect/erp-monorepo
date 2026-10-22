"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconRefresh, IconTrain, IconTruck } from "@tabler/icons-react";
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
import { AreaCards } from "./AreaCards";
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

  const set = (next: Partial<Record<"branch" | "area" | "step" | "show", string | null>>) => {
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
    <div className="mx-auto w-full max-w-7xl space-y-4">
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
 *   2. a card per work area (Orders, LR, Rail, Billing, …) — pick one to focus
 *   3. the list of items, most urgent first, with the next-step button
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
      <div className="mx-auto w-full max-w-7xl rounded-lg border bg-card p-6 text-sm text-muted-foreground">
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">My Work</h1>
          <p className="text-sm text-muted-foreground">
            {greeting()}
            {user?.role.name ? ` · ${user.role.name}` : ""}. Updated{" "}
            {updatedAgo(dataUpdatedAt)}.
          </p>
          <p className="text-base text-foreground">
            {summary.needsYou === 0 ? (
              "Nothing needs you right now."
            ) : (
              <>
                <b className="font-semibold tabular-nums">
                  {summary.needsYou.toLocaleString("en-IN")}
                </b>{" "}
                {summary.needsYou === 1 ? "item needs" : "items need"} you
                {summary.late > 0 ? (
                  <>
                    {", "}
                    <b
                      className={cn(
                        "font-semibold tabular-nums",
                        summary.veryLate > 0 ? "text-destructive" : "text-warning",
                      )}
                    >
                      {summary.late.toLocaleString("en-IN")} late
                    </b>
                    .
                  </>
                ) : (
                  ", all on time."
                )}
              </>
            )}
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

      {moving.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="text-xs font-medium">Moving now, no action needed:</span>
          {moving.map((g) => {
            const IconCmp = MOVING_ICON[g.key];
            return (
              <Link
                key={g.key}
                href={g.href}
                className="inline-flex items-center gap-1.5 text-foreground transition-colors hover:text-primary hover:underline"
              >
                <IconCmp className="size-4 text-muted-foreground" />
                <b className="font-semibold tabular-nums">{g.count}</b>
                {g.key === "trips_in_transit" ? "trucks in transit" : "rakes moving"}
              </Link>
            );
          })}
        </p>
      )}

      <AreaCards queues={queues} value={list.module} onChange={list.setModule} />

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
        onQuick={setQuick}
      />

      <QuickActions action={quick} onClose={() => setQuick(null)} />
    </div>
  );
}
