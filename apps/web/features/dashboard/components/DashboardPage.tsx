"use client";

import * as React from "react";
import Link from "next/link";
import axios from "axios";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconChecklist,
  IconLock,
  IconRefresh,
} from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import type { DashboardPeriod } from "@skerp/types";
import { cn } from "@/lib/utils";
import { useDashboard } from "../hooks";
import { AgeingCard } from "./AgeingCard";
import { AttentionCard } from "./AttentionCard";
import { BranchPerformanceCard } from "./BranchPerformanceCard";
import { FleetCard } from "./FleetCard";
import { MoneyCards } from "./MoneyCards";
import { OperationsCard } from "./OperationsCard";
import { QuickCreate } from "./QuickCreate";
import { TopCustomersCard } from "./TopCustomersCard";
import { TrendCard } from "./TrendCard";
import { WidgetPanel, WidgetSkeleton } from "./WidgetCard";
import { DASHBOARD_ROUTES } from "../routes";

const PERIODS: { key: DashboardPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
];

/**
 * Period and branch live in the address (?period=month&branch=…), so a view
 * can be shared and coming back from a drill-in lands on the same figures.
 */
function usePageState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const set = (next: Partial<Record<"period" | "branch", string | null>>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return {
    period: PERIODS.find((p) => p.key === params.get("period"))?.key ?? "month",
    branch: params.get("branch"),
    setPeriod: (period: DashboardPeriod) => set({ period }),
    setBranch: (branch: string | null) => set({ branch }),
  };
}

/**
 * The Dashboard: how the business is running. My Work answers what the viewer
 * has to do, so this page deliberately shows no worklist — only the one link
 * across to it.
 *
 * Layout is a single twelve-column grid on a 108px row unit, with cards of
 * mixed span: one hero, one four-figure cluster, then the charts and lists.
 * Spans collapse to eight columns on a tablet and two on a phone.
 */
export function DashboardPage() {
  const { period, branch, setPeriod, setBranch } = usePageState();
  const { data, isLoading, isFetching, isError, error, refetch } = useDashboard(
    period,
    branch,
  );

  // A card the viewer has no permission for comes back null, so a viewer with
  // none of the module permissions would otherwise get an empty grid.
  const hasAnyCard = data
    ? Boolean(
        data.revenue ??
        data.glance ??
        data.operations ??
        data.ageing ??
        data.topCustomers ??
        data.fleet ??
        data.attention ??
        data.branchPerformance,
      )
    : false;

  const periodLabel = data?.range.label ?? "";
  const previousLabel = data?.range.previousLabel ?? "the previous period";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            {periodLabel ? `${periodLabel} · ` : ""}compared with{" "}
            {previousLabel}
          </p>
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <nav
            aria-label="Period"
            className="inline-flex overflow-hidden rounded-lg border bg-card"
          >
            {PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={period === item.key}
                onClick={() => setPeriod(item.key)}
                className={cn(
                  "border-l px-3 py-1.5 text-sm transition-colors duration-150 first:border-l-0",
                  period === item.key
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {data && data.branches.length > 1 ? (
            <Select
              value={branch ?? "all"}
              onValueChange={(value) =>
                setBranch(value === "all" ? null : value)
              }
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {data.branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Button variant="outline" size="sm" asChild>
            <Link href="/my-work">
              <IconChecklist className="size-4" />
              My Work
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh"
          >
            <IconRefresh
              className={cn("size-4", isFetching && "animate-spin")}
            />
          </Button>
        </div>
      </header>

      <QuickCreate />

      {isError && !data ? (
        <WidgetPanel
          icon={IconAlertTriangle}
          title="The dashboard could not be loaded"
          action={
            <>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
              {branch ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBranch(null)}
                >
                  Show all branches
                </Button>
              ) : null}
            </>
          }
        >
          {errorMessage(error)}
        </WidgetPanel>
      ) : isLoading || !data ? (
        <LoadingGrid />
      ) : !hasAnyCard ? (
        <WidgetPanel
          icon={IconLock}
          title="Nothing here you have access to"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={DASHBOARD_ROUTES.myWork}>Go to My Work</Link>
            </Button>
          }
        >
          This page reports on billing, trips, orders and the fleet, and your
          role covers none of them. Your own queue is on My Work.
        </WidgetPanel>
      ) : (
        <div className="grid auto-rows-[104px] grid-cols-2 gap-3 md:grid-cols-8 xl:grid-cols-12">
          {/* One mosaic, not a stack of full-width rows: cards tile at
              different widths and heights on a shared row unit, so the page
              stays short and nothing has to fill a line on its own. */}
          <MoneyCards
            revenue={data.revenue}
            glance={data.glance}
            periodLabel={periodLabel}
            previousLabel={previousLabel}
          />

          {data.attention ? (
            <AttentionCard
              rows={data.attention}
              className="col-span-2 row-span-3 md:col-span-8 xl:col-span-5"
            />
          ) : null}

          {data.operations ? (
            <OperationsCard
              data={data.operations}
              glance={data.glance}
              periodLabel={periodLabel}
              className="col-span-2 row-span-3 md:col-span-4 xl:col-span-4"
            />
          ) : null}

          {data.ageing ? (
            <AgeingCard
              data={data.ageing}
              className="col-span-2 row-span-3 md:col-span-4 xl:col-span-3"
            />
          ) : null}

          {data.revenue ? (
            <TrendCard
              series={data.revenue.series}
              className="col-span-2 row-span-2 md:col-span-4 xl:col-span-4"
            />
          ) : null}

          {data.branchPerformance ? (
            <BranchPerformanceCard
              rows={data.branchPerformance}
              periodLabel={periodLabel}
              className="col-span-2 row-span-2 md:col-span-4 xl:col-span-4"
            />
          ) : null}

          {data.fleet ? (
            <FleetCard
              data={data.fleet}
              className="col-span-2 row-span-2 md:col-span-8 xl:col-span-4"
            />
          ) : null}

          {data.topCustomers ? (
            <TopCustomersCard
              rows={data.topCustomers}
              periodLabel={periodLabel}
              className="col-span-2 row-span-2 md:col-span-8 xl:col-span-12"
            />
          ) : null}
        </div>
      )}

      {data && hasAnyCard ? (
        <p className="text-xs text-muted-foreground">
          Revenue counts bills past review. Outstanding and ageing are live
          totals across every open bill, not just this period. Fleet and trip
          figures are company-wide — those records carry no branch. Cost, margin
          and cash are not on this page yet — they need the accounts posting
          that advances and trip expenses still skip.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The server's own message when it sent one — a 403 from `?branch=` outside
 * the viewer's scope reads far better than "Request failed".
 */
function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const sent = error.response?.data?.error?.message;
    if (typeof sent === "string" && sent) return sent;
    if (error.response?.status === 403)
      return "That branch is outside the access you have been given.";
    if (!error.response)
      return "The server could not be reached. Check your connection and try again.";
  }
  return "Something went wrong while loading these figures. Try again in a moment.";
}

/** Same spans as the real mosaic, so nothing moves when the data lands. */
export function LoadingGrid() {
  return (
    <div className="grid auto-rows-[104px] grid-cols-2 gap-3 md:grid-cols-8 xl:grid-cols-12">
      {[
        "col-span-1 row-span-1 md:col-span-4 xl:col-span-3",
        "col-span-1 row-span-1 md:col-span-4 xl:col-span-3",
        "col-span-1 row-span-1 md:col-span-4 xl:col-span-3",
        "col-span-1 row-span-1 md:col-span-4 xl:col-span-3",
        "col-span-2 row-span-3 md:col-span-8 xl:col-span-5",
        "col-span-2 row-span-3 md:col-span-4 xl:col-span-4",
        "col-span-2 row-span-3 md:col-span-4 xl:col-span-3",
        "col-span-2 row-span-2 md:col-span-4 xl:col-span-4",
        "col-span-2 row-span-2 md:col-span-4 xl:col-span-4",
        "col-span-2 row-span-2 md:col-span-8 xl:col-span-4",
        "col-span-2 row-span-2 md:col-span-8 xl:col-span-12",
      ].map((span, i) => (
        <WidgetSkeleton key={i} className={span} />
      ))}
    </div>
  );
}
