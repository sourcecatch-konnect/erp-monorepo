"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    IconChevronDown,
    IconChevronRight,
    IconDownload,
    IconTrophy,
    IconArrowUpRight
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@skerp/ui/components/dialog";
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
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import {
    currentMonth,
    vehicleCostApi,
    type MonthlyPnlResult,
    type MonthlyPnlRow,
} from "./vehicle-cost.service";
import { profitTone } from "./vehicle-pnl.format";
import { ReportPrintMenu } from "@/components/ReportPrintMenu";

// Year included: a quarter, year or custom period can span two calendar years,
// and a journey can start in an earlier month than its Log Slip.
const shortDate = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(new Date(value))
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
        "Sr", "Vehicle", "Period from", "Period to", "Months ran", "Trips", "Days", "Km",
        "Freight", "Trip expenses", "Trip balance",
        "Tax", "Insurance", "Permit", "Fitness", "EMI", "Salary", "Fixed total",
        "Spare & repairs", "Tyre", "Other", "Variable total", "Result",
        "Booking freight", "Freight difference",
    ];
    const lines = data.rows.map((r, i) =>
        [
            i + 1, r.vehicleNumber, r.periodFrom?.slice(0, 10) ?? "", r.periodTo?.slice(0, 10) ?? "",
            `${r.monthsRan}/${data.monthCount}`, r.trips, r.days, r.km,
            rupees(r.freightPaise), rupees(r.totalExpensePaise), rupees(r.tripBalancePaise),
            rupees(r.taxPaise), rupees(r.insurancePaise), rupees(r.permitPaise),
            rupees(r.fitnessPaise), rupees(r.emiPaise), rupees(r.salaryPaise), rupees(r.fixedTotalPaise),
            rupees(r.repairsPaise), rupees(r.tyrePaise), rupees(r.otherCostPaise),
            rupees(r.variableTotalPaise), rupees(r.resultPaise),
            rupees(r.bookingFreightPaise), rupees(r.freightDiffPaise),
        ].join(","),
    );
    lines.push(
        "",
        `Profit vehicle amount,${rupees(data.totals.profitAmountPaise)}`,
        `Loss vehicle amount,${rupees(data.totals.lossAmountPaise)}`,
        `Net,${rupees(data.totals.netPaise)}`,
        `Freight difference,${rupees(data.totals.freightDiffPaise)}`,
        `Business result,${rupees(data.totals.businessResultPaise)}`,
    );
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], {
        type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
        data.from === data.to
            ? `vehicle-performance-${data.from}.csv`
            : `vehicle-performance-${data.from}_to_${data.to}.csv`;
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

/** Last calendar day of a "YYYY-MM" month, as "YYYY-MM-DD". */
const monthEnd = (month: string) => {
    const [year, mon] = splitYm(month);
    return `${month}-${String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, "0")}`;
};

function SummaryItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium tabular-nums">{value}</p>
        </div>
    );
}

/** Short summary under an expanded row. Every line (each expense, fixed and
 * variable cost) lives on the vehicle's detail page, opened for this same
 * period so its true profit matches the Result here. */
function RowSummary({ row, from, to }: { row: MonthlyPnlRow; from: string; to: string }) {
    const href = `/vehicle-journeys/vehicle-pnl/${row.vehicleId}?from=${from}-01&to=${monthEnd(to)}`;
    return (
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
            <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-5">
                <SummaryItem label="Freight" value={formatPaise(row.freightPaise)} />
                <SummaryItem label="Trip expenses" value={formatPaise(row.totalExpensePaise)} />
                <SummaryItem label="Km" value={row.km.toLocaleString("en-IN")} />
                <SummaryItem label="Booking freight" value={formatPaise(row.bookingFreightPaise)} />
                <SummaryItem
                    label="Business result"
                    value={formatPaise(
                        (BigInt(row.resultPaise) + BigInt(row.freightDiffPaise)).toString(),
                    )}
                />
            </div>
            <div className="flex flex-col items-end gap-1">
                {row.missingBookingTrips > 0 ? (
                    <p className="text-xs text-amber-700">
                        {row.missingBookingTrips} trip(s) skipped — LR has no booking amount
                    </p>
                ) : null}
                <Button size="sm" asChild>
                    <Link href={href}>View full breakdown <IconArrowUpRight className="h-4 w-4" /></Link>
                </Button>
            </div>
        </div>
    );
}

/* ---------------- period (month / quarter / year / custom) ---------------- */

type PeriodMode = "month" | "quarter" | "year" | "custom";
type Period = {
    mode: PeriodMode;
    month: string;
    /** Financial year by its starting calendar year: 2026 → FY 2026-27. */
    fy: number;
    quarter: 1 | 2 | 3 | 4;
    from: string;
    to: string;
};

const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
const splitYm = (value: string) => value.split("-").map(Number) as [number, number];
/** Indian financial year starts in April. */
const fyOf = (value: string) => {
    const [year, month] = splitYm(value);
    return month >= 4 ? year : year - 1;
};
const fyLabel = (fy: number) => `FY ${fy}-${String((fy + 1) % 100).padStart(2, "0")}`;
/** Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar. */
const quarterRange = (fy: number, quarter: number) => {
    const [year, month] = quarter < 4 ? [fy, 1 + 3 * quarter] : [fy + 1, 1];
    return { from: ym(year, month), to: ym(year, month + 2) };
};
const QUARTER_MONTHS = ["", "Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"];

const initialPeriod = (): Period => {
    const month = currentMonth();
    const [, mon] = splitYm(month);
    return {
        mode: "month",
        month,
        fy: fyOf(month),
        quarter: (mon >= 4 ? Math.floor((mon - 4) / 3) + 1 : 4) as Period["quarter"],
        from: month,
        to: month,
    };
};

/** The inclusive month range and title for a period. */
const resolvePeriod = (p: Period): { from: string; to: string; label: string } => {
    switch (p.mode) {
        case "month":
            return { from: p.month, to: p.month, label: monthTitle(p.month) };
        case "quarter":
            return {
                ...quarterRange(p.fy, p.quarter),
                label: `Q${p.quarter} ${fyLabel(p.fy)} (${QUARTER_MONTHS[p.quarter]})`,
            };
        case "year":
            return { from: ym(p.fy, 4), to: ym(p.fy + 1, 3), label: fyLabel(p.fy) };
        case "custom":
            return {
                from: p.from,
                to: p.to,
                label: `${monthTitle(p.from)} – ${monthTitle(p.to)}`,
            };
    }
};

const fieldClass = "h-9 rounded-md border border-input bg-background px-3 text-sm";

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
    const set = (patch: Partial<Period>) => onChange({ ...value, ...patch });
    const thisFy = fyOf(currentMonth());
    const fyOptions = [thisFy, thisFy - 1, thisFy - 2, thisFy - 3];
    const fySelect = (
        <select
            className={`${fieldClass} w-32`}
            value={value.fy}
            onChange={(e) => set({ fy: Number(e.target.value) })}
        >
            {fyOptions.map((fy) => (
                <option key={fy} value={fy}>
                    {fyLabel(fy)}
                </option>
            ))}
        </select>
    );
    return (
        <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Period</label>
                <select
                    className={`${fieldClass} w-28`}
                    value={value.mode}
                    onChange={(e) => set({ mode: e.target.value as PeriodMode })}
                >
                    <option value="month">Month</option>
                    <option value="quarter">Quarter</option>
                    <option value="year">Year</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            {value.mode === "month" ? (
                <input
                    type="month"
                    className={`${fieldClass} w-44`}
                    value={value.month}
                    onChange={(e) => set({ month: e.target.value })}
                />
            ) : null}
            {value.mode === "quarter" ? (
                <>
                    <select
                        className={`${fieldClass} w-40`}
                        value={value.quarter}
                        onChange={(e) =>
                            set({ quarter: Number(e.target.value) as Period["quarter"] })
                        }
                    >
                        {[1, 2, 3, 4].map((q) => (
                            <option key={q} value={q}>
                                Q{q} ({QUARTER_MONTHS[q]})
                            </option>
                        ))}
                    </select>
                    {fySelect}
                </>
            ) : null}
            {value.mode === "year" ? fySelect : null}
            {value.mode === "custom" ? (
                <>
                    <input
                        type="month"
                        aria-label="From month"
                        className={`${fieldClass} w-40`}
                        value={value.from}
                        onChange={(e) => set({ from: e.target.value })}
                    />
                    <span className="pb-2 text-sm text-muted-foreground">to</span>
                    <input
                        type="month"
                        aria-label="To month"
                        className={`${fieldClass} w-40`}
                        value={value.to}
                        onChange={(e) => set({ to: e.target.value })}
                    />
                </>
            ) : null}
        </div>
    );
}

/* ---------------- leaderboard ---------------- */

type Metric = "profit" | "margin" | "perKm";
const METRICS: { key: Metric; label: string }[] = [
    { key: "profit", label: "Profit" },
    { key: "margin", label: "Margin %" },
    { key: "perKm", label: "Profit / km" },
];

/** The ranking value, or null when it can't be worked out (no freight or no
 * km — an idle vehicle is ranked by profit only). */
const metricValue = (row: MonthlyPnlRow, metric: Metric): number | null => {
    const result = Number(row.resultPaise);
    if (metric === "profit") return result;
    if (metric === "margin") {
        const freight = Number(row.freightPaise);
        return freight > 0 ? (result / freight) * 100 : null;
    }
    return row.km > 0 ? result / row.km : null;
};

const formatMetric = (value: number, metric: Metric) =>
    metric === "margin"
        ? `${value.toFixed(1)}%`
        : `${formatPaise(String(Math.round(value)))}${metric === "perKm" ? "/km" : ""}`;

type RankFilter = "all" | "profit" | "loss" | "idle";

/** Vehicle-number search plus the profit / loss / idle filter, shared by the
 * main table and the leaderboard. */
const matchesFilter = (row: MonthlyPnlRow, search: string, filter: RankFilter) => {
    const term = search.trim().toLowerCase();
    if (term && !row.vehicleNumber.toLowerCase().includes(term)) return false;
    const result = BigInt(row.resultPaise);
    if (filter === "profit") return result > 0n;
    if (filter === "loss") return result < 0n;
    if (filter === "idle") return row.trips === 0;
    return true;
};

function SearchAndFilter({
    search,
    filter,
    onSearch,
    onFilter,
}: {
    search: string;
    filter: RankFilter;
    onSearch: (value: string) => void;
    onFilter: (value: RankFilter) => void;
}) {
    return (
        <>
            <Input
                placeholder="Search vehicle no."
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="h-9 w-48"
            />
            <select
                aria-label="Filter"
                className={`${fieldClass} w-40`}
                value={filter}
                onChange={(e) => onFilter(e.target.value as RankFilter)}
            >
                <option value="all">All vehicles</option>
                <option value="profit">Profit-making</option>
                <option value="loss">Loss-making</option>
                <option value="idle">Idle (no trips)</option>
            </select>
        </>
    );
}

type Ranked = { row: MonthlyPnlRow; value: number | null; rank: number | null };

/** Full ranking of every own vehicle for the period, in a dialog so it stays
 * usable with a large fleet. Filtering and paging are client-side — the
 * report already holds every vehicle. Rank is the position in the full
 * ranking, so it doesn't change when you search or filter. */
function LeaderboardDialog({
    rows,
    label,
    open,
    onOpenChange,
}: {
    rows: MonthlyPnlRow[];
    label: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [metric, setMetric] = React.useState<Metric>("profit");
    const [worstFirst, setWorstFirst] = React.useState(false);
    const [filter, setFilter] = React.useState<RankFilter>("all");
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [size, setSize] = React.useState(10);

    const ranked = React.useMemo((): Ranked[] => {
        const withValue = rows.map((row) => ({ row, value: metricValue(row, metric) }));
        const rankable = withValue
            .filter((r): r is { row: MonthlyPnlRow; value: number } => r.value !== null)
            .sort((a, b) => (worstFirst ? a.value - b.value : b.value - a.value))
            .map((r, i) => ({ ...r, rank: i + 1 }));
        // Vehicles that can't be ranked on this measure (no freight / no km) go last.
        const unranked = withValue
            .filter((r) => r.value === null)
            .map((r) => ({ ...r, rank: null }));
        return [...rankable, ...unranked];
    }, [rows, metric, worstFirst]);

    const visible = ranked.filter(({ row }) => matchesFilter(row, search, filter));
    const pageRows = visible.slice(page * size, page * size + size);

    const toggleClass = (active: boolean) =>
        `rounded px-2.5 py-1 text-xs font-medium ${active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[88vh] flex-col gap-4 sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Leaderboard</DialogTitle>
                    <DialogDescription>
                        {label} · {rows.length} own vehicles, ranked on true profit
                        (after fixed and variable costs).
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2">
                    <SearchAndFilter
                        search={search}
                        filter={filter}
                        onSearch={(value) => {
                            setSearch(value);
                            setPage(0);
                        }}
                        onFilter={(value) => {
                            setFilter(value);
                            setPage(0);
                        }}
                    />
                    <div className="flex gap-1 rounded-md bg-muted p-0.5">
                        {METRICS.map((m) => (
                            <button
                                key={m.key}
                                type="button"
                                onClick={() => {
                                    setMetric(m.key);
                                    setPage(0);
                                }}
                                className={toggleClass(metric === m.key)}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-1 rounded-md bg-muted p-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                setWorstFirst(false);
                                setPage(0);
                            }}
                            className={toggleClass(!worstFirst)}
                        >
                            Best first
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setWorstFirst(true);
                                setPage(0);
                            }}
                            className={toggleClass(worstFirst)}
                        >
                            Worst first
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-14 pl-4 text-xs font-semibold">Rank</TableHead>
                                <TableHead className="text-xs font-semibold">Vehicle</TableHead>
                                <TableHead className="text-right text-xs font-semibold">Trips</TableHead>
                                <TableHead className="text-right text-xs font-semibold">Km</TableHead>
                                <TableHead className="text-right text-xs font-semibold">Freight</TableHead>
                                <TableHead className="text-right text-xs font-semibold">Result</TableHead>
                                <TableHead className="pr-4 text-right text-xs font-semibold">
                                    {METRICS.find((m) => m.key === metric)?.label}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pageRows.map(({ row, value, rank }) => (
                                <TableRow key={row.vehicleId} className="h-11">
                                    <TableCell className="pl-4 font-semibold tabular-nums text-muted-foreground">
                                        {rank ?? "—"}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <Link
                                            href={`/vehicle-journeys/vehicle-pnl/${row.vehicleId}`}
                                            className="hover:underline"
                                        >
                                            {row.vehicleNumber}
                                        </Link>
                                        {row.trips === 0 ? (
                                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                idle
                                            </span>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">{row.trips}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {row.km.toLocaleString("en-IN")}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatPaise(row.freightPaise)}
                                    </TableCell>
                                    <TableCell
                                        className={`text-right tabular-nums ${profitTone(row.resultPaise)}`}
                                    >
                                        {formatPaise(row.resultPaise)}
                                    </TableCell>
                                    <TableCell
                                        className={`pr-4 text-right font-semibold tabular-nums ${value === null ? "text-muted-foreground" : value < 0 ? "text-destructive" : "text-emerald-700"}`}
                                    >
                                        {value === null ? "—" : formatMetric(value, metric)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {pageRows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="py-8 text-center text-sm text-muted-foreground"
                                    >
                                        No vehicles match.
                                    </TableCell>
                                </TableRow>
                            ) : null}
                        </TableBody>
                    </Table>
                </div>

                <TablePaginationFooter
                    total={visible.length}
                    page={page}
                    size={size}
                    onPageChange={setPage}
                    onSizeChange={(next) => {
                        setSize(next);
                        setPage(0);
                    }}
                />
                {metric !== "profit" ? (
                    <p className="text-xs text-muted-foreground">
                        Vehicles with no freight or no km can&apos;t be ranked on this
                        measure; they are listed last with “—”.
                    </p>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

/** The accountant's month-end Performance Report, automated: every own
 * vehicle (idle ones too), trip balance less monthly fixed and variable
 * costs. Read-only — costs are entered on the Vehicle Costs page. */
export default function VehiclePnlMonthlyPage() {
    const [period, setPeriod] = React.useState<Period>(initialPeriod);
    const [openId, setOpenId] = React.useState<string | null>(null);
    const [leaderboardOpen, setLeaderboardOpen] = React.useState(false);
    const { from, to, label } = resolvePeriod(period);
    const validRange = /^\d{4}-\d{2}$/.test(from) && /^\d{4}-\d{2}$/.test(to) && from <= to;

    const query = useQuery({
        queryKey: ["vehicle-pnl-monthly", from, to],
        queryFn: () => vehicleCostApi.monthlyPnl(from, to),
        enabled: validRange,
    });
    const data = query.data;
    const multiMonth = (data?.monthCount ?? 1) > 1;

    // Table-only search / filter / paging — the cards, leaderboard and CSV
    // always cover every vehicle.
    const [search, setSearch] = React.useState("");
    const [filter, setFilter] = React.useState<RankFilter>("all");
    const [page, setPage] = React.useState(0);
    const [size, setSize] = React.useState(20);
    React.useEffect(() => setPage(0), [from, to]);
    const visibleRows = (data?.rows ?? []).filter((row) => matchesFilter(row, search, filter));
    const pageRows = visibleRows.slice(page * size, page * size + size);

    return (
        <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                        Vehicle Performance Report
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {label} · own vehicles, after monthly fixed and variable
                        costs.
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <PeriodPicker value={period} onChange={setPeriod} />
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/vehicle-journeys/vehicle-costs">Enter monthly costs</Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!data}
                        onClick={() => setLeaderboardOpen(true)}
                    >
                        <IconTrophy size={16} /> Leaderboard
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!data}
                        onClick={() => data && exportCsv(data)}
                    >
                        <IconDownload size={16} /> Export
                    </Button>
                    <ReportPrintMenu
                        disabled={!data || !validRange}
                        downloadPdf={(withLetterhead) =>
                            vehicleCostApi.monthlyPnlPdf(from, to, withLetterhead)
                        }
                        previewPath={(withLetterhead) =>
                            `/log-slips/vehicle-pnl/monthly/print-preview?from=${from}&to=${to}&letterhead=${withLetterhead}`
                        }
                        fileName={
                            from === to
                                ? `vehicle-performance-${from}`
                                : `vehicle-performance-${from}_to_${to}`
                        }
                    />
                    <ReportPrintMenu
                        label="Vehicle sheet"
                        disabled={!data || !validRange}
                        downloadPdf={(withLetterhead) =>
                            vehicleCostApi.vehicleSheetPdf(from, to, withLetterhead)
                        }
                        previewPath={(withLetterhead) =>
                            `/log-slips/vehicle-pnl/monthly/sheet/print-preview?from=${from}&to=${to}&letterhead=${withLetterhead}`
                        }
                        fileName={
                            from === to
                                ? `vehicle-sheet-${from}`
                                : `vehicle-sheet-${from}_to_${to}`
                        }
                    />
                    <ReportPrintMenu
                        label="Freight difference"
                        disabled={!data || !validRange}
                        downloadPdf={(withLetterhead) =>
                            vehicleCostApi.freightDiffPdf(from, to, withLetterhead)
                        }
                        previewPath={(withLetterhead) =>
                            `/log-slips/vehicle-pnl/monthly/freight-diff/print-preview?from=${from}&to=${to}&letterhead=${withLetterhead}`
                        }
                        fileName={
                            from === to
                                ? `freight-difference-${from}`
                                : `freight-difference-${from}_to_${to}`
                        }
                    />
                </div>
            </div>

            {!validRange ? (
                <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800">
                    Pick a “from” month that is on or before the “to” month.
                </div>
            ) : null}
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
                                label="Freight difference"
                                value={formatPaise(data.totals.freightDiffPaise)}
                                sub={`Booking ${formatPaise(data.totals.bookingFreightPaise)}`}
                                tone={profitTone(data.totals.freightDiffPaise)}
                            />
                            <Stat
                                label="Business result"
                                value={formatPaise(data.totals.businessResultPaise)}
                                sub="Vehicles + freight difference"
                                tone={profitTone(data.totals.businessResultPaise)}
                            />
                        </div>
                        <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground tabular-nums">
                            Vehicle result {formatPaise(data.totals.netPaise)} + Freight difference{" "}
                            {formatPaise(data.totals.freightDiffPaise)} = Business result{" "}
                            <span className="font-semibold text-foreground">
                                {formatPaise(data.totals.businessResultPaise)}
                            </span>
                            {" · "}Freight {formatPaise(data.totals.freightPaise)} · Fixed{" "}
                            {formatPaise(data.totals.fixedTotalPaise)} · Variable{" "}
                            {formatPaise(data.totals.variableTotalPaise)}
                            {data.totals.missingBookingTrips > 0 ? (
                                <span className="text-amber-700">
                                    {" · "}
                                    {data.totals.missingBookingTrips} trip(s) without a booking
                                    amount left out
                                </span>
                            ) : null}
                        </p>
                    </section>

                    <LeaderboardDialog
                        rows={data.rows}
                        label={label}
                        open={leaderboardOpen}
                        onOpenChange={setLeaderboardOpen}
                    />

                    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                            <SearchAndFilter
                                search={search}
                                filter={filter}
                                onSearch={(value) => {
                                    setSearch(value);
                                    setPage(0);
                                }}
                                onFilter={(value) => {
                                    setFilter(value);
                                    setPage(0);
                                }}
                            />
                            <span className="ml-auto text-xs text-muted-foreground">
                                {visibleRows.length} of {data.rows.length} vehicles
                            </span>
                        </div>
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-10 pl-4" />
                                    <TableHead className="text-xs font-semibold">Vehicle</TableHead>
                                    <TableHead className="text-xs font-semibold">Period</TableHead>
                                    {multiMonth ? (
                                        <TableHead className="text-right text-xs font-semibold">Months</TableHead>
                                    ) : null}
                                    <TableHead className="text-right text-xs font-semibold">Trips</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Days</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Trip balance</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Fixed</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Variable</TableHead>
                                    <TableHead className="text-right text-xs font-semibold">Result</TableHead>
                                    <TableHead className="pr-5 text-right text-xs font-semibold">Freight diff</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={multiMonth ? 11 : 10}
                                            className="py-8 text-center text-sm text-muted-foreground"
                                        >
                                            No vehicles match.
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {pageRows.map((row) => {
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
                                                {multiMonth ? (
                                                    <TableCell className="text-right text-muted-foreground tabular-nums">
                                                        {row.monthsRan}/{data.monthCount}
                                                    </TableCell>
                                                ) : null}
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
                                                    className={`text-right font-semibold tabular-nums ${profitTone(row.resultPaise)}`}
                                                >
                                                    {formatPaise(row.resultPaise)}
                                                </TableCell>
                                                <TableCell className="pr-5 text-right tabular-nums text-muted-foreground">
                                                    {formatPaise(row.freightDiffPaise)}
                                                </TableCell>
                                            </TableRow>
                                            {open ? (
                                                <TableRow className="bg-muted/20 hover:bg-muted/20">
                                                    <TableCell colSpan={multiMonth ? 11 : 10} className="p-0">
                                                        <RowSummary row={row} from={from} to={to} />
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        <TablePaginationFooter
                            total={visibleRows.length}
                            page={page}
                            size={size}
                            onPageChange={setPage}
                            onSizeChange={(next) => {
                                setSize(next);
                                setPage(0);
                            }}
                        />
                    </section>

                    <p className="text-xs text-muted-foreground">
                        Result = trip balance (freight − trip expenses) − monthly fixed
                        (tax, insurance, permit, fitness, EMI, salary) − monthly variable
                        (spare &amp; repairs from finalised Job Cards, tyre, other). Vehicles
                        with no trips still carry their fixed costs. Freight difference =
                        booking freight billed on the LRs − onward freight credited to the
                        vehicle; it is kept by the business, not by any vehicle.
                    </p>
                </>
            ) : null}
        </div>
    );
}
