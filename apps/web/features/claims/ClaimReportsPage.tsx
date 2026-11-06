"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { IconArrowLeft } from "@tabler/icons-react";
import type { ClaimCostGroupBy } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { StatTile } from "@skerp/ui/components/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@skerp/ui/components/tabs";

import { DetailSection } from "@/features/masters/_shared/DetailSection";
import { formatPaise } from "@/lib/money";
import { claimApi, type ClaimFilters } from "./claim.service";
import { claimKeys } from "./claim.keys";

const GROUP_BY: { value: ClaimCostGroupBy; label: string; column: string }[] = [
  { value: "cause", label: "Caused by", column: "Caused by" },
  { value: "transporter", label: "Transporter", column: "Transporter" },
  { value: "route", label: "Route", column: "Route" },
  { value: "customer", label: "Customer", column: "Customer" },
];

/** First day of this month, yyyy-mm-dd. */
const monthStartInput = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
};

function AgeingSection() {
  const ageing = useQuery({
    queryKey: claimKeys.ageing({}),
    queryFn: () => claimApi.ageing({}),
  });

  return (
    <DetailSection title="Open claims by age" contentClassName="space-y-3 p-4">
      <p className="text-xs text-muted-foreground">
        Pending and active claims, by days since they were raised.
      </p>
      {ageing.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[66px] w-full" />
          ))}
        </div>
      ) : ageing.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {ageing.data.buckets.map((bucket) => (
              <StatTile
                key={bucket.key}
                label={bucket.label}
                value={bucket.count}
                hint={`${formatPaise(bucket.claimedAmountPaise)} claimed`}
                tone={bucket.key === "D60_PLUS" && bucket.count > 0 ? "warning" : "muted"}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {ageing.data.openCount} open claim{ageing.data.openCount === 1 ? "" : "s"} in all.
          </p>
        </>
      ) : null}
    </DetailSection>
  );
}

function CostSection() {
  const [groupBy, setGroupBy] = React.useState<ClaimCostGroupBy>("cause");
  const [dateFrom, setDateFrom] = React.useState(monthStartInput);
  const [dateTo, setDateTo] = React.useState("");
  const filters: ClaimFilters = {
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };
  const summary = useQuery({
    queryKey: claimKeys.costSummary(filters, groupBy),
    queryFn: () => claimApi.costSummary(filters, groupBy),
    placeholderData: keepPreviousData,
  });
  const column = GROUP_BY.find((option) => option.value === groupBy)!.column;

  return (
    <DetailSection title="Damage cost" contentClassName="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Settled claims dated in the range: what we paid, what we got back, and the loss left.
        </p>
        <div className="flex items-center gap-1">
          <Input
            type="date"
            aria-label="Claim date from"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-40"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="Claim date to"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-40"
          />
        </div>
      </div>

      <Tabs value={groupBy} onValueChange={(value) => setGroupBy(value as ClaimCostGroupBy)}>
        <TabsList>
          {GROUP_BY.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{column}</TableHead>
              <TableHead className="text-right">Claims</TableHead>
              <TableHead className="text-right">Settled</TableHead>
              <TableHead className="text-right">Recovered</TableHead>
              <TableHead className="text-right">Net loss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {summary.data && summary.data.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No settled claims in this range.
                </TableCell>
              </TableRow>
            )}
            {summary.data?.rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{row.claims}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(row.settledAmountPaise)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(row.recoveredAmountPaise)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatPaise(row.netLossPaise)}
                </TableCell>
              </TableRow>
            ))}
            {summary.data && summary.data.rows.length > 0 && (
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{summary.data.totals.claims}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(summary.data.totals.settledAmountPaise)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(summary.data.totals.recoveredAmountPaise)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(summary.data.totals.netLossPaise)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </DetailSection>
  );
}

export function ClaimReportsPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 text-muted-foreground hover:text-foreground"
        >
          <Link href="/claims">
            <IconArrowLeft size={15} className="mr-1" /> Back to claims
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Claim reports</h1>
        <p className="text-sm text-muted-foreground">
          How old the open claims are, and what damage is costing — by cause, transporter, route
          and customer.
        </p>
      </div>
      <AgeingSection />
      <CostSection />
    </div>
  );
}
