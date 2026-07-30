"use client";

import * as React from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCircleCheck,
  IconPackage,
  IconRoute,
  IconScale,
  IconTrain,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { useCan } from "@/features/auth";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import { useRailRakeDetail } from "./useRailRake";

const DASH = "-";

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
    : DASH;

const formatNumber = (value?: number | string | null) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 }).format(
    Number(value ?? 0),
  );

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function RailRakeDetail({ rakeId }: { rakeId: string }) {
  const rakeQuery = useRailRakeDetail(rakeId);
  const canCreateBranchGrn = useCan(PERMS.RAIL_BRANCH_GRN.CREATE);

  if (rakeQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (rakeQuery.isError || !rakeQuery.data) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          <p className="font-semibold">Unable to load Rail Rake</p>
          <p className="mt-1 text-sm">{getErrorMessage(rakeQuery.error)}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/vp-management/vp-loading">
              <IconArrowLeft size={16} className="mr-1.5" />
              VP Loading
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const rake = rakeQuery.data;
  const rows = rake.vpSchedule.mrRr?.rows ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b bg-muted/20 p-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/vp-management/vp-loading/${rake.vpSchedule.id}`}>
              <IconArrowLeft size={16} className="mr-1.5" />
              Back to VP Loading
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{rake.rakeNumber}</h1>
              <span className="rounded-md border bg-muted px-2.5 py-1 text-xs font-semibold">
                {rake.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Railway rake generated from {rake.vpSchedule.scheduleNumber}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-2">
                <IconRoute size={16} className="text-muted-foreground" />
                {rake.fromBranch.name} to {rake.toBranch.name}
              </span>
              <span>Generated {formatDateTime(rake.generatedAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {["CREATED", "DISPATCHED", "UNLOADING"].includes(rake.status) &&
              canCreateBranchGrn ? (
              <Button asChild>
                <Link href="/vp-management/branch-grn/new">
                  <IconPackage size={17} className="mr-1.5" />
                  Receive at Branch
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Wagons"
          value={formatNumber(rake.summary.totalWagons)}
          icon={<IconTrain size={18} />}
        />
        <Metric
          label="Verified"
          value={`${formatNumber(rake.summary.verifiedWagons)} / ${formatNumber(
            rake.summary.totalWagons,
          )}`}
          icon={<IconCircleCheck size={18} />}
        />
        <Metric
          label="Loaded quantity"
          value={formatNumber(rake.summary.totalLoadedQty)}
          icon={<IconScale size={18} />}
        />
        <Metric
          label="Branch GRNs"
          value={`${formatNumber(
            rake.summary.branchGrnsSubmitted,
          )} / ${formatNumber(rake.summary.totalWagons)}`}
          icon={<IconTruckDelivery size={18} />}
        />
      </div>

      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Actual VP wagons</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These are MRRR VP numbers, not planned wagon-type counts.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b bg-muted/20 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">VP number</th>
                <th className="px-4 py-3 font-medium">Wagon</th>
                <th className="px-4 py-3 font-medium">MR/RR</th>
                <th className="px-4 py-3 font-medium">Loading</th>
                <th className="px-4 py-3 text-right font-medium">Loaded</th>
                <th className="px-4 py-3 font-medium">Branch GRN</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-semibold">
                    {row.vpNo || row.rowLabel}
                  </td>
                  <td className="px-4 py-3">
                    {row.wagon.name || row.wagonTypeLabel}
                  </td>
                  <td className="px-4 py-3">{row.mrRrNo || DASH}</td>
                  <td className="px-4 py-3">
                    {row.vpWagonLoading?.status || DASH}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.vpWagonLoading?.totalLoadedQty)}
                  </td>
                  <td className="px-4 py-3">
                    {row.vpWagonLoading?.branchGrn?.status || "NOT STARTED"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
