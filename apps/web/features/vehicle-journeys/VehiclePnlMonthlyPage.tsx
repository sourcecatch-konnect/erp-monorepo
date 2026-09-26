"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconChevronDown, IconChevronRight, IconDownload } from "@tabler/icons-react";

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

import { formatPaise } from "@/lib/money";
import {
    currentMonth,
    vehicleCostApi,
    type MonthlyPnlResult,
    type MonthlyPnlRow,
} from "./vehicle-cost.service";
import { profitTone } from "./vehicle-pnl.format";

const shortDate = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit" }).format(
              new Date(value),
          )
        : "—";

const monthTitle = (month: string) => {
    const [year, mon] = month.split("-").map(Number) as [number, number];
    return new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(year, mon - 1, 1)));
};

const rupees = (paise: string) => (Number(paise) / 100).toFixed(2);

/** Plain CSV the accountant can open in Excel — one line per vehicle. */
function exportCsv(data: MonthlyPnlResult) {
    const header = [
        "Sr", "Vehicle", "Period from", "Period to", "Trips", "Days", "Km",
        "Freight", "Trip expenses", "Trip balance",
        "Tax", "Insurance", "Permit", "Fitness", "EMI", "Salary", "Fixed total",
        "Spare & repairs", "Tyre", "Other", "Variable total", "Result",
    ];
    const lines = data.rows.map((r, i) =>
        [
            i + 1, r.vehicleNumber, r.periodFrom?.slice(0, 10) ?? "", r.periodTo?.slice(0, 10) ?? "",
            r.trips, r.days, r.km,
            rupees(r.freightPaise), rupees(r.totalExpensePaise), rupees(r.tripBalancePaise),
            rupees(r.taxPaise), rupees(r.insurancePaise), rupees(r.permitPaise),
            rupees(r.fitnessPaise), rupees(r.emiPaise), rupees(r.salaryPaise), rupees(r.fixedTotalPaise),
            rupees(r.repairsPaise), rupees(r.tyrePaise), rupees(r.otherCostPaise),
            rupees(r.variableTotalPaise), rupees(r.resultPaise),
        ].join(","),
    );
    lines.push(
        "",
        `Profit vehicle amount,${rupees(data.totals.profitAmountPaise)}`,
        `Loss vehicle amount,${rupees(data.totals.lossAmountPaise)}`,
        `Net,${rupees(data.totals.netPaise)}`,
    );
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], {
        type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vehicle-performance-${data.month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function Stat({
    label,
    value,
    sub,
    tone,
}: {
    label: string;
    value: string;
    sub?: string;
    tone?: string;
}) {
    return (
        <div className="min-w-0 px-5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className={`mt-1 truncate text-base font-semibold tabular-nums ${tone ?? ""}`}>
                {value}
            </p>
            {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
        </div>
    );
}

function Line({ label, paise }: { label: string; paise: string }) {
    return (
        <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{formatPaise(paise)}</span>
        </div>
    );
}

function Breakdown({ row }: { row: MonthlyPnlRow }) {
    return (
        <div className="grid gap-6 px-5 py-4 sm:grid-cols-3">
            <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Trips ({row.trips} · {row.km.toLocaleString("en-IN")} km)
                </p>
                <Line label="Freight" paise={row.freightPaise} />
                <Line label="Diesel" paise={row.dieselPaise} />
                <Line label="Other trip expenses" paise={row.otherExpensePaise} />
                <Line label="Trip balance" paise={row.tripBalancePaise} />
            </div>
            <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Monthly fixed
                </p>
                <Line label="Tax" paise={row.taxPaise} />
                <Line label="Insurance" paise={row.insurancePaise} />
                <Line label="Permit" paise={row.permitPaise} />
                <Line label="Fitness" paise={row.fitnessPaise} />
                <Line label="EMI" paise={row.emiPaise} />
                <Line label="Salary" paise={row.salaryPaise} />
            </div>
            <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Monthly variable
                </p>
                <Line label="Spare & repairs" paise={row.repairsPaise} />
                <Line label="Tyre" paise={row.tyrePaise} />
                <Line label="Other" paise={row.otherCostPaise} />
                <Link
                    href={`/vehicle-journeys/vehicle-pnl/${row.vehicleId}`}
                    className="inline-block pt-2 text-xs font-medium text-primary hover:underline"
                >
                    Open vehicle detail ↗
                </Link>
            </div>
        </div>
    );
}

/** The accountant's month-end Performance Report, automated: every own
 * vehicle (idle ones too), trip balance less monthly fixed and variable
 * costs. Read-only — costs are entered on the Vehicle Costs page. */
export default function VehiclePnlMonthlyPage() {
    const [month, setMonth] = React.useState(currentMonth());
    const [openId, setOpenId] = React.useState<string | null>(null);

    const query = useQuery({
        queryKey: ["vehicle-pnl-monthly", month],
        queryFn: () => vehicleCostApi.monthlyPnl(month),
        enabled: /^\d{4}-\d{2}$/.test(month),
    });
    const data = query.data;

    return (
        <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                        Vehicle Performance Report
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {monthTitle(month)} · own vehicles, after monthly fixed and
                        variable costs.
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Month</label>
                        <input
                            type="month"
                            className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/vehicle-journeys/vehicle-costs">Enter monthly costs</Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!data}
                        onClick={() => data && exportCsv(data)}
                    >
                        <IconDownload size={16} /> Export
                    </Button>
                </div>
            </div>

            {query.isLoading ? <Skeleton className="h-64 w-full" /> : null}
            {query.isError ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    Could not load the report.
                </div>
            ) : null}

            {data ? (
                <>
                    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
                            <Stat
                                label="Profit vehicle amount"
                                value={formatPaise(data.totals.profitAmountPaise)}
                                sub={`${data.totals.profitVehicleCount} vehicles`}
                                tone="text-emerald-700"
                            />
                            <Stat
                                label="Loss vehicle amount"
                                value={formatPaise(data.totals.lossAmountPaise)}
                                sub={`${data.totals.lossVehicleCount} vehicles`}
                                tone={data.totals.lossVehicleCount > 0 ? "text-destructive" : undefined}
                            />
                            <Stat
                                label="Net result"
                                value={formatPaise(data.totals.netPaise)}
                                sub={`${data.totals.vehicleCount} own vehicles`}
                                tone={profitTone(data.totals.netPaise)}
                            />
                            <Stat
                                label="Freight"
                                value={formatPaise(data.totals.freightPaise)}
                                sub={`Fixed ${formatPaise(data.totals.fixedTotalPaise)} · Variable ${formatPaise(data.totals.variableTotalPaise)}`}
                            />
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-10 pl-4" />
                                    <TableHead className="text-xs font-semibold">Vehicle</TableHead>
                                    <TableHead className="text-xs font-semibold">Period</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Trips</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Days</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Trip balance</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Fixed</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Variable</TableHead>
                                    <TableHead className="pr-5 text-right text-xs font-semibold">Result</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.rows.map((row) => {
                                    const open = openId === row.vehicleId;
                                    const loss = BigInt(row.resultPaise) < 0n;
                                    return (
                                        <React.Fragment key={row.vehicleId}>
                                            <TableRow
                                                className={`h-12 cursor-pointer border-b border-border/60 hover:bg-muted/30 ${loss ? "bg-destructive/[0.04]" : ""}`}
                                                onClick={() => setOpenId(open ? null : row.vehicleId)}
                                            >
                                                <TableCell className="pl-4 text-muted-foreground">
                                                    {open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                                </TableCell>
                                                <TableCell className="font-semibold">
                                                    {row.vehicleNumber}
                                                    {row.trips === 0 ? (
                                                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                            idle
                                                        </span>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground tabular-nums">
                                                    {row.trips > 0
                                                        ? `${shortDate(row.periodFrom)} – ${shortDate(row.periodTo)}`
                                                        : "—"}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">{row.trips}</TableCell>
                                                <TableCell className="text-right tabular-nums">{row.days}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatPaise(row.tripBalancePaise)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatPaise(row.fixedTotalPaise)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatPaise(row.variableTotalPaise)}
                                                </TableCell>
                                                <TableCell
                                                    className={`pr-5 text-right font-semibold tabular-nums ${profitTone(row.resultPaise)}`}
                                                >
                                                    {formatPaise(row.resultPaise)}
                                                </TableCell>
                                            </TableRow>
                                            {open ? (
                                                <TableRow className="bg-muted/20 hover:bg-muted/20">
                                                    <TableCell colSpan={9} className="p-0">
                                                        <Breakdown row={row} />
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </section>

                    <p className="text-xs text-muted-foreground">
                        Result = trip balance (freight − trip expenses) − monthly fixed
                        (tax, insurance, permit, fitness, EMI, salary) − monthly variable
                        (spare &amp; repairs from finalised Job Cards, tyre, other). Vehicles
                        with no trips still carry their fixed costs.
                    </p>
                </>
            ) : null}
        </div>
    );
}
