"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconArrowLeft } from "@tabler/icons-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    type TooltipValueType,
} from "recharts";

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
import { logSlipApi, type VehiclePnlRow } from "./journey.service";
import { ReportPrintMenu } from "./ReportPrintMenu";
import {
    formatMoneyOrDash,
    formatMonth,
    formatPct,
    paiseToRupees,
    profitTone,
} from "./vehicle-pnl.format";

const COLORS = {
    freight: "#059669",
    diesel: "#f59e0b",
    other: "#64748b",
    repairs: "#e11d48",
    vehicleCosts: "#7c3aed",
    profit: "#2563eb",
    loaded: "#059669",
    empty: "#f59e0b",
};

const rupeeAxis = (value: number) =>
    Math.abs(value) >= 100000
        ? `${(value / 100000).toFixed(1)}L`
        : Math.abs(value) >= 1000
          ? `${(value / 1000).toFixed(0)}k`
          : String(value);

const rupeeTooltip = (value: unknown) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(value));

function dateLabel(value: string) {
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(value));
}

function StatGroup({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="min-w-0 px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {title}
            </p>
            <dl className="mt-2 space-y-1.5">{children}</dl>
        </div>
    );
}

function StatLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium tabular-nums">{value}</dd>
        </div>
    );
}

function ChartCard({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">{title}</h2>
            {subtitle ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
            <div className="mt-3 h-64">{children}</div>
        </section>
    );
}

/** Every line behind the vehicle's result — the full version of the summary
 * shown when a row is expanded on Vehicle Performance, grouped the same way
 * as the accountant's sheet (trips, monthly fixed, monthly variable). */
function ProfitBreakdown({ row }: { row: VehiclePnlRow }) {
    const costs = row.costs;
    const diesel = BigInt(row.dieselPaise);
    const tripBalance = BigInt(row.totalFreightPaise) - BigInt(row.totalExpensePaise);
    const fixed = costs
        ? BigInt(costs.taxPaise) +
          BigInt(costs.insurancePaise) +
          BigInt(costs.permitPaise) +
          BigInt(costs.fitnessPaise) +
          BigInt(costs.emiPaise) +
          BigInt(costs.salaryPaise)
        : null;
    const variable =
        BigInt(row.repairsPaise) +
        (costs ? BigInt(costs.tyrePaise) + BigInt(costs.otherPaise) : 0n);
    const result = tripBalance - (fixed ?? 0n) - variable;
    const diff = row.freightDiff;

    return (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Profit breakdown</h2>
                <p className="text-xs text-muted-foreground">
                    Every freight, expense and cost line for the selected period.
                </p>
            </div>
            <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <StatGroup
                    title={`Trips (${row.journeyCount} · ${row.totalKm.toLocaleString("en-IN")} km)`}
                >
                    <StatLine label="Freight" value={formatPaise(row.totalFreightPaise)} />
                    <StatLine label="Diesel" value={formatPaise(diesel.toString())} />
                    <StatLine
                        label="Other trip expenses"
                        value={formatPaise(row.otherExpensePaise)}
                    />
                    <StatLine label="Trip balance" value={formatPaise(tripBalance.toString())} />
                    {diff ? (
                        <>
                            <StatLine label="Booking freight" value={formatPaise(diff.booking)} />
                            <StatLine label="Freight difference" value={formatPaise(diff.diff)} />
                            {diff.missing > 0 ? (
                                <p className="text-xs text-amber-700">
                                    {diff.missing} trip(s) skipped — LR has no booking amount
                                </p>
                            ) : null}
                        </>
                    ) : null}
                </StatGroup>
                <StatGroup title="Monthly fixed">
                    {costs ? (
                        <>
                            <StatLine label="Tax" value={formatPaise(costs.taxPaise)} />
                            <StatLine label="Insurance" value={formatPaise(costs.insurancePaise)} />
                            <StatLine label="Permit" value={formatPaise(costs.permitPaise)} />
                            <StatLine label="Fitness" value={formatPaise(costs.fitnessPaise)} />
                            <StatLine label="EMI" value={formatPaise(costs.emiPaise)} />
                            <StatLine label="Salary" value={formatPaise(costs.salaryPaise)} />
                            <StatLine label="Total fixed" value={formatPaise((fixed ?? 0n).toString())} />
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Tracked for own vehicles only.
                        </p>
                    )}
                </StatGroup>
                <StatGroup title="Monthly variable">
                    <StatLine label="Spare & repairs" value={formatPaise(row.repairsPaise)} />
                    {costs ? (
                        <>
                            <StatLine label="Tyre" value={formatPaise(costs.tyrePaise)} />
                            <StatLine label="Other" value={formatPaise(costs.otherPaise)} />
                        </>
                    ) : null}
                    <StatLine label="Total variable" value={formatPaise(variable.toString())} />
                </StatGroup>
            </div>
            <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground tabular-nums">
                Trip balance {formatPaise(tripBalance.toString())}
                {fixed !== null ? ` − Fixed ${formatPaise(fixed.toString())}` : ""} − Variable{" "}
                {formatPaise(variable.toString())} ={" "}
                <span className={`font-semibold ${profitTone(result.toString())}`}>
                    {formatPaise(result.toString())}
                </span>
                {costs ? null : " (no Vehicle Costs for hired vehicles)"}
            </p>
        </section>
    );
}

export default function VehiclePnlDetailPage({
    vehicleId,
}: {
    vehicleId: string;
}) {
    // Opened from Vehicle Performance with ?from=&to=, so the detail covers
    // the same period and its true profit matches that report's result.
    const searchParams = useSearchParams();
    const [from, setFrom] = React.useState(() => searchParams.get("from") ?? "");
    const [to, setTo] = React.useState(() => searchParams.get("to") ?? "");

    const query = useQuery({
        queryKey: ["vehicle-pnl-detail", vehicleId, from, to],
        queryFn: () =>
            logSlipApi.vehiclePnl({
                vehicleId,
                from: from || undefined,
                to: to || undefined,
            }),
    });
    const row = query.data?.data[0];

    const back = (
        <Link
            href="/vehicle-journeys/vehicle-pnl"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
            <IconArrowLeft size={16} /> Vehicle P&amp;L
        </Link>
    );

    if (query.isLoading)
        return (
            <div className="space-y-4 p-4">
                {back}
                <Skeleton className="h-96 w-full" />
            </div>
        );

    if (query.isError || !row)
        return (
            <div className="space-y-4 p-4">
                {back}
                <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                    {query.isError
                        ? "Could not load this vehicle."
                        : "No posted Log Slips for this vehicle in the selected range."}
                </div>
            </div>
        );

    const freight = paiseToRupees(row.totalFreightPaise);
    const breakdown = [
        { name: "Freight", value: freight, fill: COLORS.freight },
        { name: "Diesel", value: paiseToRupees(row.dieselPaise), fill: COLORS.diesel },
        {
            name: "Other trip exp.",
            value: paiseToRupees(row.otherExpensePaise),
            fill: COLORS.other,
        },
        { name: "Repairs", value: paiseToRupees(row.repairsPaise), fill: COLORS.repairs },
        ...(row.fixedCostsPaise !== null
            ? [
                  {
                      name: "Vehicle costs",
                      value: paiseToRupees(row.fixedCostsPaise),
                      fill: COLORS.vehicleCosts,
                  },
              ]
            : []),
        {
            name: row.trueProfitPaise !== null ? "True profit" : "Profit",
            value: paiseToRupees(row.trueProfitPaise ?? row.profitAfterRepairsPaise),
            fill: COLORS.profit,
        },
    ];

    // Own vehicles get their Vehicle Costs (EMI, insurance, salary…) charged
    // every month, idle ones included, so the line is true profit.
    const hasVehicleCosts = row.fixedCostsPaise !== null;
    const profitLabel = hasVehicleCosts ? "True profit" : "Profit";
    const monthly = row.monthly.map((m) => ({
        month: formatMonth(m.month),
        Freight: paiseToRupees(m.freightPaise),
        Cost:
            paiseToRupees(m.expensePaise) +
            paiseToRupees(m.repairsPaise) +
            paiseToRupees(m.fixedCostsPaise),
        [profitLabel]: paiseToRupees(m.trueProfitPaise),
    }));

    const kmSplit = [
        { name: "Loaded km", value: row.loadedKm, fill: COLORS.loaded },
        { name: "Empty km", value: row.emptyKm, fill: COLORS.empty },
    ];
    const hasKmSplit = row.loadedKm + row.emptyKm > 0;

    return (
        <div className="space-y-4 p-4">
            {back}

            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                        {row.vehicleNumber}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {row.journeyCount} posted journeys ·{" "}
                        {row.totalKm.toLocaleString("en-IN")} km
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            From
                        </label>
                        <input
                            type="date"
                            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">To</label>
                        <input
                            type="date"
                            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>
                    <ReportPrintMenu
                        downloadPdf={(withLetterhead) =>
                            logSlipApi.vehiclePnlPdf(
                                vehicleId,
                                { from: from || undefined, to: to || undefined },
                                withLetterhead,
                            )
                        }
                        previewPath={(withLetterhead) => {
                            const params = new URLSearchParams({
                                ...(from ? { from } : {}),
                                ...(to ? { to } : {}),
                                letterhead: String(withLetterhead),
                            });
                            return `/log-slips/vehicle-pnl/${encodeURIComponent(vehicleId)}/print-preview?${params}`;
                        }}
                        fileName={`vehicle-pnl-${row.vehicleNumber}`}
                    />
                </div>
            </div>

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {row.trueProfitPaise !== null ? "True profit" : "Profit after repairs"}
                        </p>
                        <p
                            className={`mt-1 text-2xl font-semibold tabular-nums ${profitTone(row.trueProfitPaise ?? row.profitAfterRepairsPaise)}`}
                        >
                            {formatPaise(row.trueProfitPaise ?? row.profitAfterRepairsPaise)}
                        </p>
                        {row.trueProfitPaise !== null ? (
                            <p className="text-xs text-muted-foreground">
                                Before Vehicle Costs: {formatPaise(row.profitAfterRepairsPaise)}
                            </p>
                        ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Margin{" "}
                        <span className="font-semibold text-foreground">
                            {formatPct(row.marginPct)}
                        </span>
                    </p>
                </div>
                <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <StatGroup title="Money">
                        <StatLine label="Freight" value={formatPaise(row.totalFreightPaise)} />
                        <StatLine label="Trip expenses" value={formatPaise(row.totalExpensePaise)} />
                        <StatLine label="Repairs" value={formatPaise(row.repairsPaise)} />
                        {row.fixedCostsPaise !== null ? (
                            <StatLine
                                label="Vehicle costs"
                                value={formatPaise(row.fixedCostsPaise)}
                            />
                        ) : null}
                    </StatGroup>
                    <StatGroup
                        title={hasVehicleCosts ? "Per unit (after Vehicle Costs)" : "Per unit"}
                    >
                        <StatLine label="Revenue / km" value={formatMoneyOrDash(row.revenuePerKmPaise)} />
                        <StatLine label="Cost / km" value={formatMoneyOrDash(row.costPerKmPaise)} />
                        <StatLine label="Profit / km" value={formatMoneyOrDash(row.profitPerKmPaise)} />
                        <StatLine label="Profit / journey" value={formatMoneyOrDash(row.profitPerJourneyPaise)} />
                        <StatLine label="Profit / running day" value={formatMoneyOrDash(row.profitPerDayPaise)} />
                    </StatGroup>
                    <StatGroup title="Operations">
                        <StatLine
                            label="Mileage"
                            value={
                                row.actualAverage !== null
                                    ? `${row.actualAverage.toFixed(2)} km/l`
                                    : "—"
                            }
                        />
                        <StatLine
                            label="Utilisation"
                            value={`${formatPct(row.utilisationPct)} (${row.daysInPeriod}/${row.periodDays} days)`}
                        />
                        <StatLine label="Empty km" value={formatPct(row.emptyPct)} />
                    </StatGroup>
                </div>
            </section>

            <ProfitBreakdown row={row} />

            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                    title="Where the money goes"
                    subtitle="Freight against each cost, and what is left"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={breakdown}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={rupeeAxis} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={rupeeTooltip} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {breakdown.map((b) => (
                                    <Cell key={b.name} fill={b.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                    title="Monthly trend"
                    subtitle={
                        hasVehicleCosts
                            ? "Is this vehicle getting better or worse? Cost includes EMI, insurance, salary and other Vehicle Costs."
                            : "Is this vehicle getting better or worse?"
                    }
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthly}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={rupeeAxis} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={rupeeTooltip} />
                            <Legend />
                            <Bar dataKey="Freight" fill={COLORS.freight} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Cost" fill={COLORS.repairs} radius={[4, 4, 0, 0]} />
                            <Line
                                type="monotone"
                                dataKey={profitLabel}
                                stroke={COLORS.profit}
                                strokeWidth={2}
                                dot
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                    title="Loaded vs empty km"
                    subtitle={
                        row.emptyPct !== null
                            ? `${formatPct(row.emptyPct)} of closed-trip km ran empty`
                            : "From closed trips flagged empty or loaded"
                    }
                >
                    {hasKmSplit ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={kmSplit}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={2}
                                >
                                    {kmSplit.map((k) => (
                                        <Cell key={k.name} fill={k.fill} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(v: TooltipValueType | undefined) =>
                                        `${Number(v).toLocaleString("en-IN")} km`
                                    }
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            No closed trip km recorded yet.
                        </p>
                    )}
                </ChartCard>
            </div>

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-3">
                    <h2 className="text-sm font-semibold">Journeys (Log Slips)</h2>
                </div>
                <Table className="min-w-[760px]">
                    <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-5 text-xs font-semibold">Log Slip</TableHead>
                            <TableHead className="text-xs font-semibold">Journey</TableHead>
                            <TableHead className="text-xs font-semibold">Date</TableHead>
                            <TableHead className="text-right text-xs font-semibold">Km</TableHead>
                            <TableHead className="text-right text-xs font-semibold">Freight</TableHead>
                            <TableHead className="text-right text-xs font-semibold">Expenses</TableHead>
                            <TableHead className="pr-5 text-right text-xs font-semibold">
                                Trip margin
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {row.journeys.map((slip) => (
                            <TableRow key={slip.logSlipId} className="h-12">
                                <TableCell className="pl-5 font-medium">
                                    <Link
                                        href={`/vehicle-journeys/${slip.journeyId}/log-slip`}
                                        className="text-primary hover:underline"
                                    >
                                        {slip.logSlipNumber ?? "Log Slip"}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Link
                                        href={`/vehicle-journeys/${slip.journeyId}`}
                                        className="hover:text-primary hover:underline"
                                    >
                                        {slip.journeyNumber}
                                    </Link>
                                </TableCell>
                                <TableCell>{dateLabel(slip.logSlipDate)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {slip.totalKm.toLocaleString("en-IN")}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatPaise(slip.totalFreightPaise)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatPaise(slip.totalExpensePaise)}
                                </TableCell>
                                <TableCell
                                    className={`pr-5 text-right font-semibold tabular-nums ${profitTone(slip.netResultPaise)}`}
                                >
                                    {formatPaise(slip.netResultPaise)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>

            <p className="text-xs text-muted-foreground">
                Profit after repairs = freight − trip expenses − finalised Job Card cost.
                EMI, insurance and permit/tax are not tracked yet.
            </p>
        </div>
    );
}
