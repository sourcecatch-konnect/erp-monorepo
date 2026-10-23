"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconChevronRight } from "@tabler/icons-react";

import { Input } from "@skerp/ui/components/input";
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
import { logSlipApi } from "./journey.service";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import { formatMoneyOrDash, formatPct, profitTone } from "./vehicle-pnl.format";

/** A label/value pair inside the summary strip — no box of its own. */
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

/** One row per vehicle, summed across every Log Slip that actually posted to
 * accounts, less finalised Job Card repairs. Read-only: nothing else in
 * Accounts is touched by this screen. EMI / insurance / permit are not
 * tracked yet, so "profit after repairs" is not the full profit. */
export default function VehiclePnlPage() {
    const [from, setFrom] = React.useState("");
    const [to, setTo] = React.useState("");
    const [search, setSearch] = React.useState("");
    const debouncedSearch = useDebouncedValue(search, 300);
    const [page, setPage] = React.useState(0);
    const [size, setSize] = React.useState(20);

    // Any filter change resets to page 0 — a stale page number past the new
    // result count would otherwise show an empty page with no way back.
    const resetToFirstPage = <T,>(setter: (v: T) => void) => (value: T) => {
        setter(value);
        setPage(0);
    };

    const filters = {
        from: from || undefined,
        to: to || undefined,
        search: debouncedSearch || undefined,
    };

    const pnl = useQuery({
        queryKey: ["vehicle-pnl", from, to, debouncedSearch, page, size],
        queryFn: () => logSlipApi.vehiclePnl({ ...filters, page, size }),
    });
    const summaryQuery = useQuery({
        queryKey: ["vehicle-pnl-summary", from, to, debouncedSearch],
        queryFn: () => logSlipApi.vehiclePnlSummary(filters),
    });

    // Open the detail for the same dates, so its numbers match this row.
    const dateQuery = new URLSearchParams({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
    }).toString();
    const detailHref = (vehicleId: string) =>
        `/vehicle-journeys/vehicle-pnl/${vehicleId}${dateQuery ? `?${dateQuery}` : ""}`;

    const rows = pnl.data?.data ?? [];
    const total = pnl.data?.meta?.total ?? 0;
    const summary = summaryQuery.data;

    return (
        <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Vehicle P&amp;L</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Profitability of own vehicles from posted Log Slips, after repairs
                        from Job Cards.
                    </p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            Search vehicle
                        </label>
                        <Input
                            className="h-9 w-48"
                            placeholder="Vehicle number..."
                            value={search}
                            onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            From
                        </label>
                        <Input
                            type="date"
                            className="h-9 w-40"
                            value={from}
                            onChange={(e) => resetToFirstPage(setFrom)(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            To
                        </label>
                        <Input
                            type="date"
                            className="h-9 w-40"
                            value={to}
                            onChange={(e) => resetToFirstPage(setTo)(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {pnl.isLoading ? <Skeleton className="h-64 w-full" /> : null}

            {pnl.isError ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    Could not load Vehicle P&amp;L.
                </div>
            ) : null}

            {!pnl.isLoading && !pnl.isError && rows.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                    No vehicle has a Log Slip posted to accounts yet — post one from a
                    journey&apos;s Log Slip page to see it here.
                </div>
            ) : null}

            {rows.length > 0 && (
                <div className="space-y-4">
                    {summary ? (
                        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                            <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
                                <Stat
                                    label="Freight"
                                    value={formatPaise(summary.totalFreightPaise)}
                                    sub={`${summary.vehicleCount} vehicles · ${summary.totalKm.toLocaleString("en-IN")} km`}
                                />
                                <Stat
                                    label="Trip expenses"
                                    value={formatPaise(summary.totalExpensePaise)}
                                    sub="Diesel, toll, driver, other"
                                />
                                <Stat
                                    label="Repairs"
                                    value={formatPaise(summary.totalRepairsPaise)}
                                    sub="Finalised job cards"
                                />
                                <Stat
                                    label="Profit after repairs"
                                    value={formatPaise(summary.profitAfterRepairsPaise)}
                                    sub={`Margin ${formatPct(summary.marginPct)}`}
                                    tone={profitTone(summary.profitAfterRepairsPaise)}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
                                <span>
                                    Loss-making:{" "}
                                    <span
                                        className={`font-semibold ${summary.lossMakingCount > 0 ? "text-destructive" : "text-foreground"}`}
                                    >
                                        {summary.lossMakingCount} of {summary.vehicleCount}
                                    </span>
                                </span>
                                {summary.bestVehicle ? (
                                    <span>
                                        Best:{" "}
                                        <span className="font-semibold text-foreground">
                                            {summary.bestVehicle.vehicleNumber}
                                        </span>{" "}
                                        <span className={profitTone(summary.bestVehicle.profitPaise)}>
                                            {formatPaise(summary.bestVehicle.profitPaise)}
                                        </span>
                                    </span>
                                ) : null}
                                {summary.worstVehicle ? (
                                    <span>
                                        Weakest:{" "}
                                        <span className="font-semibold text-foreground">
                                            {summary.worstVehicle.vehicleNumber}
                                        </span>{" "}
                                        <span className={profitTone(summary.worstVehicle.profitPaise)}>
                                            {formatPaise(summary.worstVehicle.profitPaise)}
                                        </span>
                                    </span>
                                ) : null}
                            </div>
                        </section>
                    ) : null}

                    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-5 text-xs font-semibold">Vehicle</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Freight</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Costs</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">
                                        Profit after repairs
                                    </TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Profit / km</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Utilisation</TableHead>
                                    <TableHead className="w-10 pr-5" />
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {rows.map((row) => {
                                    const costs =
                                        BigInt(row.totalExpensePaise) + BigInt(row.repairsPaise);
                                    return (
                                        <TableRow
                                            key={row.vehicleId}
                                            className="h-16 border-b border-border/60 last:border-b-0 hover:bg-muted/30"
                                        >
                                            <TableCell className="pl-5">
                                                <Link
                                                    href={detailHref(row.vehicleId)}
                                                    className="font-semibold hover:text-primary hover:underline"
                                                >
                                                    {row.vehicleNumber}
                                                </Link>
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {row.journeyCount} journeys ·{" "}
                                                    {row.totalKm.toLocaleString("en-IN")} km
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatPaise(row.totalFreightPaise)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatPaise(costs.toString())}
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    Repairs {formatPaise(row.repairsPaise)}
                                                </p>
                                            </TableCell>
                                            <TableCell
                                                className={`text-right font-semibold tabular-nums ${profitTone(row.profitAfterRepairsPaise)}`}
                                            >
                                                {formatPaise(row.profitAfterRepairsPaise)}
                                                <p className="mt-0.5 text-xs font-normal">
                                                    Margin {formatPct(row.marginPct)}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatMoneyOrDash(row.profitPerKmPaise)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                {formatPct(row.utilisationPct)}
                                            </TableCell>
                                            <TableCell className="pr-5 text-right">
                                                <Link
                                                    href={detailHref(row.vehicleId)}
                                                    aria-label={`Open ${row.vehicleNumber} detail`}
                                                    className="text-muted-foreground hover:text-primary"
                                                >
                                                    <IconChevronRight size={16} />
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        <TablePaginationFooter
                            total={total}
                            page={page}
                            size={size}
                            onPageChange={setPage}
                            onSizeChange={(nextSize) => {
                                setSize(nextSize);
                                setPage(0);
                            }}
                        />
                    </section>

                    <p className="text-xs text-muted-foreground">
                        Costs = trip expenses + finalised Job Card repairs. This view
                        leaves out Vehicle Costs (EMI, insurance, salary…) — see{" "}
                        <Link
                            href="/vehicle-journeys/vehicle-pnl/monthly"
                            className="font-medium text-primary hover:underline"
                        >
                            Vehicle Performance
                        </Link>{" "}
                        for true profit. Open a vehicle for its full breakdown, trend and
                        empty-km details.
                    </p>
                </div>
            )}
        </div>
    );
}
