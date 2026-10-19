"use client";

import * as React from "react";
import Link from "next/link";
import { IconCircleCheck, IconRefresh } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@skerp/ui/components/tabs";
import type { MyWorkArea, MyWorkResponse } from "@skerp/types";
import { cn } from "@/lib/utils";
import { useMyWork } from "../hooks";
import { MyWorkQueueCard } from "./MyWorkQueueCard";
import { MyWorkRowItem } from "./MyWorkRowItem";

const AREA_LABEL: Record<MyWorkArea, string> = {
  orders: "Orders",
  "lorry-receipts": "Lorry receipts",
  billing: "Billing",
  trips: "Trips",
};

const AREA_ORDER: MyWorkArea[] = ["orders", "lorry-receipts", "billing", "trips"];

type Tab = "all" | MyWorkArea | "stale";

function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "danger" && value > 0
            ? "text-destructive"
            : "text-foreground",
        )}
      >
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function DoToday({
  items,
  queues,
}: {
  items: MyWorkResponse["doToday"];
  queues: MyWorkResponse["queues"];
}) {
  if (items.length === 0) return null;
  const byKey = new Map(queues.map((q) => [q.key, q]));

  return (
    <section className="rounded-lg border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Do today</h2>
        <p className="text-xs text-muted-foreground">
          The most overdue items across everything you can act on.
        </p>
      </header>
      <ul className="divide-y">
        {items.map((item) => {
          const queue = byKey.get(item.queueKey);
          return (
            <MyWorkRowItem
              key={`${item.queueKey}:${item.id}`}
              row={item}
              actionLabel={item.actionLabel}
              lateAfterDays={queue?.lateAfterDays ?? 1}
              queueTitle={queue?.title}
            />
          );
        })}
      </ul>
    </section>
  );
}

function GoingOn({ items }: { items: MyWorkResponse["goingOn"] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-foreground">
        Going on <span className="font-normal text-muted-foreground">· just watching</span>
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((g) => (
          <Link
            key={g.key}
            href={g.href}
            className="flex items-baseline justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted"
          >
            <span className="text-sm text-foreground">{g.title}</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {g.count.toLocaleString("en-IN")}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AllCaughtUp() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-12 text-center">
      <IconCircleCheck className="size-8 text-success" />
      <p className="text-sm font-medium text-foreground">All caught up</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Nothing is waiting on you right now. New work shows up here as
        orders, LRs and bills move forward.
      </p>
    </div>
  );
}

export function MyWorkPage() {
  const { data, isPending, isError, isFetching, refetch } = useMyWork();
  const [tab, setTab] = React.useState<Tab>("all");

  const queues = data?.queues ?? [];
  const active = queues.filter((q) => q.waiting > 0);
  const stale = queues.filter((q) => q.stale > 0);

  const areaCounts = AREA_ORDER.map((area) => ({
    area,
    count: active
      .filter((q) => q.area === area)
      .reduce((n, q) => n + q.waiting, 0),
  })).filter((a) => a.count > 0);

  // If the selected tab vanishes after a refresh (work cleared), fall back.
  const tabValid =
    tab === "all" ||
    (tab === "stale" ? stale.length > 0 : areaCounts.some((a) => a.area === tab));
  const current: Tab = tabValid ? tab : "all";

  const visibleActive =
    current === "all" ? active : active.filter((q) => q.area === current);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">My Work</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? data.summary.needsYou > 0
                ? `${data.summary.needsYou.toLocaleString("en-IN")} thing(s) need you. Oldest first. Clear the red ones before anything else.`
                : "Nothing needs you right now."
              : "Everything waiting on you, across the ERP."}
          </p>
        </div>
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

      {isPending ? (
        <PageSkeleton />
      ) : isError || !data ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Could not load your work.{" "}
          <Button variant="link" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Needs you"
              value={data.summary.needsYou}
              hint={`across ${active.length} step(s)`}
            />
            <StatTile
              label="Late"
              value={data.summary.late}
              hint="past their time limit"
              tone="danger"
            />
            <StatTile
              label="Going on"
              value={data.summary.goingOn}
              hint="moving, nothing to do yet"
            />
            <StatTile
              label="Stale"
              value={data.summary.stale}
              hint="very old, needs cleanup"
            />
          </div>

          {(areaCounts.length > 0 || stale.length > 0) && (
            <Tabs value={current} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList>
                <TabsTrigger value="all">
                  All {data.summary.needsYou}
                </TabsTrigger>
                {areaCounts.map((a) => (
                  <TabsTrigger key={a.area} value={a.area}>
                    {AREA_LABEL[a.area]} {a.count}
                  </TabsTrigger>
                ))}
                {stale.length > 0 && (
                  <TabsTrigger value="stale">
                    Stale {data.summary.stale}
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          )}

          {current === "stale" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                These have sat untouched far longer than normal. They are
                probably leftovers. Finish them or close them so they stop
                hiding real work.
              </p>
              {stale.map((q) => (
                <MyWorkQueueCard key={q.key} queue={q} scope="stale" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {current === "all" && (
                <DoToday items={data.doToday} queues={data.queues} />
              )}

              {visibleActive.length === 0 ? (
                <AllCaughtUp />
              ) : current === "all" ? (
                AREA_ORDER.map((area) => {
                  const inArea = visibleActive.filter((q) => q.area === area);
                  if (inArea.length === 0) return null;
                  return (
                    <div key={area} className="space-y-3">
                      <h2 className="text-xs font-medium uppercase text-muted-foreground">
                        {AREA_LABEL[area]}
                      </h2>
                      {inArea.map((q) => (
                        <MyWorkQueueCard key={q.key} queue={q} scope="active" />
                      ))}
                    </div>
                  );
                })
              ) : (
                <div className="space-y-3">
                  {visibleActive.map((q) => (
                    <MyWorkQueueCard key={q.key} queue={q} scope="active" />
                  ))}
                </div>
              )}

              {current === "all" && <GoingOn items={data.goingOn} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
