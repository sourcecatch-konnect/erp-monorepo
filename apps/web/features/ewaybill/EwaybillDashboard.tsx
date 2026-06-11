"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IconAlertTriangleFilled,
  IconTruckLoading,
  IconRoad,
  IconClipboardList,
  IconClockHour4,
  IconArrowUpRight,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";

import { ewbApi } from "./ewaybill.service";
import { ewbKeys } from "./ewaybill.keys";
import { KpiTile } from "./components/KpiTile";
import { StatusBadge } from "./components/StatusBadge";
import { ExpiryCountdown } from "./components/ExpiryCountdown";
import { Button } from "@skerp/ui/components/button";
import { cn } from "@skerp/ui/lib/util";

export default function EwaybillDashboard() {
  const summary = useQuery({
    queryKey: ewbKeys.summary(),
    queryFn: ewbApi.summary,
    refetchInterval: 30_000,
  });

  const liveStatus = useQuery({
    queryKey: [...ewbKeys.all, "live-status"],
    queryFn: ewbApi.liveStatus,
    staleTime: 60_000,
  });

  const data = summary.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            E-Way Bill Console
          </h1>
          <p className="text-sm text-muted-foreground">
            Transporter operations · live status of consignments assigned to
            your GSTIN
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge
            configured={liveStatus.data?.configured}
            statusCd={liveStatus.data?.result?.status_cd}
          />
          <Button asChild variant="outline" size="sm">
            <Link href="/ewaybills/inbox">
              Open Inbox
              <IconArrowUpRight />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiTile
          label="Total Assigned"
          value={data?.counts.total ?? "—"}
          icon={IconClipboardList}
        />
        <KpiTile
          label="Active"
          value={data?.counts.active ?? "—"}
          icon={IconRoad}
          tone="info"
        />
        <KpiTile
          label="In Transit"
          value={data?.counts.inTransit ?? "—"}
          icon={IconTruckLoading}
          tone="info"
        />
        <KpiTile
          label="Part-B Pending"
          value={data?.counts.partBPending ?? "—"}
          icon={IconClockHour4}
          tone="warn"
          sub="Vehicle not assigned yet"
        />
        <KpiTile
          label="Expiring < 4h"
          value={data?.counts.expiringSoon ?? "—"}
          icon={IconAlertTriangleFilled}
          tone={
            (data?.counts.expiringSoon ?? 0) > 0 ? "danger" : "default"
          }
        />
      </div>

      {/* Expiring soon strip */}
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Expiring soon — act now
          </h2>
          <Link
            href="/ewaybills/inbox?status=ACTIVE"
            className="text-xs text-primary hover:underline"
          >
            View all active
          </Link>
        </div>

        {summary.isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse border border-border bg-muted/40"
              />
            ))}
          </div>
        ) : data && data.expiringSoon.length === 0 ? (
          <div className="flex items-center gap-3 border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/5 dark:text-emerald-200">
            <IconCheck className="size-5" />
            All clear — nothing expires in the next 4 hours.
          </div>
        ) : (
          <div className="grid gap-2">
            {data?.expiringSoon.map((b) => (
              <Link
                key={b.ewbNo}
                href={`/ewaybills/${b.ewbNo}`}
                className="group flex flex-wrap items-center gap-3 border border-amber-300 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/5 dark:hover:bg-amber-500/10"
              >
                <IconAlertTriangleFilled className="size-5 text-amber-700 dark:text-amber-400" />
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="font-mono">{b.ewbNo}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="truncate">
                      {b.fromPlace} → {b.toPlace}
                    </span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {b.fromTrdName} · {b.vehicleNo || "Vehicle not assigned"}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <ExpiryCountdown validUntil={b.validUntil} />
                  <StatusBadge status={b.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Origin states breakdown */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pickups by origin state
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          {data?.byState.map((s) => (
            <Link
              key={s.stateCode}
              href={`/ewaybills/inbox?fromState=${s.stateCode}`}
              className="flex items-center justify-between border bg-card px-3 py-2 transition-colors hover:bg-muted/50"
            >
              <span className="truncate text-sm">{s.stateName}</span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {s.count}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function LiveBadge({
  configured,
  statusCd,
}: {
  configured?: boolean;
  statusCd?: string;
}) {
  if (configured === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
        <span className="size-1.5 animate-pulse bg-current" />
        Checking live link…
      </span>
    );
  }

  if (!configured) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground">
        <IconAlertCircle className="size-3" />
        Live API not configured
      </span>
    );
  }

  const ok = statusCd === "1" || statusCd === "200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-1 text-[11px]",
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/5 dark:text-emerald-200"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/5 dark:text-amber-200"
      )}
    >
      <span className="size-1.5 animate-pulse bg-current" />
      WhiteBooks Sandbox · {ok ? "live" : `code ${statusCd ?? "—"}`}
    </span>
  );
}
