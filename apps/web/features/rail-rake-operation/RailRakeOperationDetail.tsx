"use client";

import Link from "next/link";
import {
  IconArrowLeft,
  IconClock,
  IconEdit,
  IconReceiptRupee,
  IconRoute,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import { useRailRakeOperationDetail } from "./useRailRakeOperation";
import {
  railRakeOperationContext,
  type RailRakeOperationContext,
} from "./rail-rake-operation.context";
import { RailRakeOperationStatusBadge } from "./railRakeOperationStatusBadge";

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const money = (value?: string | number | null) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value ?? 0) / 100);
const duration = (minutes?: number | null) =>
  `${Math.floor((minutes ?? 0) / 60)}h ${(minutes ?? 0) % 60}m`;

export default function RailRakeOperationDetail({
  id,
  context,
}: {
  id: string;
  context: RailRakeOperationContext;
}) {
  const contextConfig = railRakeOperationContext[context];
  const query = useRailRakeOperationDetail(id);
  const canUpdate = useCan(contextConfig.permissions.UPDATE);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="font-semibold">Unable to load Rake operation</p>
        <p className="text-sm text-muted-foreground">
          {getErrorMessage(query.error)}
        </p>
      </div>
    );
  }

  const row = query.data;
  if (row.stage !== contextConfig.stage) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="font-semibold">Rake operation not found on this page</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <Button size="icon-sm" variant="outline" asChild>
            <Link href={contextConfig.basePath}>
              <IconArrowLeft size={16} />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">
                {row.railRake.rakeNumber}
              </h1>

              <RailRakeOperationStatusBadge status={row.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {row.stage === "ORIGIN_RAILHEAD"
                ? "Origin Rail Head"
                : "Destination Branch"}{" "}
              · {row.branch.name}
            </p>
          </div>
        </div>
        {canUpdate && row.status === "DRAFT" ? (
          <Button variant="outline" asChild>
            <Link href={`${contextConfig.basePath}/${row.id}/edit`}>
              <IconEdit size={16} className="mr-1.5" />
              Edit
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <IconRoute size={17} className="text-primary" />
            Route and responsibility
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Rail route</p>
              <p className="font-medium">
                {row.railRake.vpSchedule.sourceArea.name} →{" "}
                {row.railRake.vpSchedule.destinationArea.name}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Branches</p>
              <p className="font-medium">
                {row.railRake.fromBranch.name} → {row.railRake.toBranch.name}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Responsible branch
              </p>
              <p className="font-medium">{row.branch.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Operation area</p>
              <p className="font-medium">{row.area.name}</p>
            </div>
          </div>
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <IconClock size={17} className="text-primary" />
            Movement
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Arrival</p>
              <p className="font-medium">{date(row.arrivalAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Departure</p>
              <p className="font-medium">{date(row.departureAt)}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Placements</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>Removed</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead>Free</TableHead>
              <TableHead>Chargeable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.placements.map((placement) => (
              <TableRow key={placement.id}>
                <TableCell>{placement.sequence}</TableCell>
                <TableCell>{date(placement.placedAt)}</TableCell>
                <TableCell>{date(placement.removedAt)}</TableCell>
                <TableCell>{duration(placement.actualMinutes)}</TableCell>
                <TableCell>{duration(placement.freeMinutes)}</TableCell>
                <TableCell className="font-medium">
                  {duration(placement.chargeableMinutes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {row.charges.map((charge) => (
          <section key={charge.id} className="rounded-lg border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <IconReceiptRupee size={17} className="text-primary" />
              {charge.type === "DEMURRAGE" ? "Demurrage (DC)" : "Wharfage (WC)"}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Gross</p>
                <p className="font-medium">{money(charge.grossAmount)}</p>
              </div>
              {charge.type === "DEMURRAGE" ? (
                <div>
                  <p className="text-xs text-muted-foreground">Waiver</p>
                  <p className="font-medium">
                    {money(charge.approvedWaiverAmount)}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="font-medium">{money(charge.paidAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="font-semibold">{money(charge.balanceAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium">{charge.status}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chargeable time</p>
                <p className="font-medium">
                  {duration(charge.chargeableMinutes)}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
