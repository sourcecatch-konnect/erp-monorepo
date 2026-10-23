"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconPencil } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@skerp/ui/components/dialog";
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
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import {
    currentMonth,
    paiseToInput,
    rupeesToPaise,
    vehicleCostApi,
    type FixedCosts,
    type VehicleCostRow,
} from "./vehicle-cost.service";

type FieldKey =
    | "taxPaise"
    | "insurancePaise"
    | "permitPaise"
    | "fitnessPaise"
    | "emiPaise"
    | "salaryPaise"
    | "tyrePaise"
    | "otherPaise";

const FIXED_FIELDS: { key: FieldKey; label: string }[] = [
    { key: "taxPaise", label: "Tax" },
    { key: "insurancePaise", label: "Insurance" },
    { key: "permitPaise", label: "Permit" },
    { key: "fitnessPaise", label: "Fitness" },
    { key: "emiPaise", label: "EMI / installment" },
];
const MONTHLY_FIELDS: { key: FieldKey; label: string }[] = [
    { key: "salaryPaise", label: "Other staff salary (cleaner / helper)" },
    { key: "tyrePaise", label: "Tyre" },
    { key: "otherPaise", label: "Other" },
];

const sumPaise = (...values: string[]) =>
    values.reduce((s, v) => s + BigInt(v), 0n).toString();

function EditDialog({
    row,
    month,
    onClose,
}: {
    row: VehicleCostRow | null;
    month: string;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const [values, setValues] = React.useState<Record<FieldKey, string>>(
        {} as Record<FieldKey, string>,
    );
    const [remarks, setRemarks] = React.useState("");
    const [saveAsDefault, setSaveAsDefault] = React.useState(false);

    React.useEffect(() => {
        if (!row) return;
        const next = {} as Record<FieldKey, string>;
        for (const { key } of [...FIXED_FIELDS, ...MONTHLY_FIELDS])
            next[key] = paiseToInput(row[key]);
        setValues(next);
        setRemarks(row.remarks ?? "");
        setSaveAsDefault(false);
    }, [row]);

    const save = useMutation({
        mutationFn: async () => {
            if (!row) return;
            const paise = {} as Record<FieldKey, string>;
            for (const { key } of [...FIXED_FIELDS, ...MONTHLY_FIELDS])
                paise[key] = rupeesToPaise(values[key] ?? "");
            await vehicleCostApi.saveMonth(row.vehicleId, month, {
                ...paise,
                remarks: remarks.trim() || null,
            });
            if (saveAsDefault) {
                const defaults: FixedCosts = {
                    taxPaise: paise.taxPaise,
                    insurancePaise: paise.insurancePaise,
                    permitPaise: paise.permitPaise,
                    fitnessPaise: paise.fitnessPaise,
                    emiPaise: paise.emiPaise,
                };
                await vehicleCostApi.saveDefaults(row.vehicleId, defaults);
            }
        },
        onSuccess: () => {
            toast.success(`Costs saved for ${row?.vehicleNumber}`);
            queryClient.invalidateQueries({ queryKey: ["vehicle-costs"] });
            queryClient.invalidateQueries({ queryKey: ["vehicle-pnl-monthly"] });
            onClose();
        },
        onError: (e) => toast.error(e instanceof Error && e.message === "Enter a valid amount" ? e.message : getErrorMessage(e)),
    });

    const reset = useMutation({
        mutationFn: () => vehicleCostApi.resetMonth(row!.vehicleId, month),
        onSuccess: () => {
            toast.success("Reverted to the vehicle's defaults");
            queryClient.invalidateQueries({ queryKey: ["vehicle-costs"] });
            queryClient.invalidateQueries({ queryKey: ["vehicle-pnl-monthly"] });
            onClose();
        },
        onError: (e) => toast.error(getErrorMessage(e)),
    });

    const field = ({ key, label }: { key: FieldKey; label: string }) => (
        <div key={key} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            <Input
                inputMode="decimal"
                className="h-9 text-right tabular-nums"
                placeholder="0"
                value={values[key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
        </div>
    );

    return (
        <Dialog open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{row?.vehicleNumber} · costs for {month}</DialogTitle>
                    <DialogDescription>
                        Amounts in rupees. Leave blank for zero.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Monthly fixed
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {FIXED_FIELDS.map(field)}
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={saveAsDefault}
                                onChange={(e) => setSaveAsDefault(e.target.checked)}
                            />
                            Also use these fixed amounts as this vehicle&apos;s default for
                            other months
                        </label>
                    </div>

                    <div>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            This month only
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {MONTHLY_FIELDS.map(field)}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Spare &amp; repairs are taken from finalised Job Cards
                            automatically.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Driver salary (automatic, from the approved salary run):{" "}
                            <span className="font-medium text-foreground">
                                {row && BigInt(row.driverSalaryPaise) > 0n
                                    ? formatPaise(row.driverSalaryPaise)
                                    : "none yet"}
                            </span>
                        </p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Remarks</label>
                        <Input
                            className="h-9"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                    <div>
                        {row?.hasMonthlyRow ? (
                            <Button
                                variant="ghost"
                                disabled={reset.isPending}
                                onClick={() => reset.mutate()}
                            >
                                Revert to defaults
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button disabled={save.isPending} onClick={() => save.mutate()}>
                            Save
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Monthly costs for every own vehicle. Fixed costs fall back to the
 * vehicle's defaults until a month is saved; salary, tyre and other are
 * entered per month. Feeds the Vehicle Performance Report. */
export default function VehicleCostsPage() {
    const [month, setMonth] = React.useState(currentMonth());
    const [editing, setEditing] = React.useState<VehicleCostRow | null>(null);

    const query = useQuery({
        queryKey: ["vehicle-costs", month],
        queryFn: () => vehicleCostApi.list(month),
        enabled: /^\d{4}-\d{2}$/.test(month),
    });
    const rows = query.data ?? [];

    // Client-side: the list is every own vehicle for one month, already loaded.
    const [search, setSearch] = React.useState("");
    const [source, setSource] = React.useState<"all" | "saved" | "defaults">("all");
    const [page, setPage] = React.useState(0);
    const [size, setSize] = React.useState(20);
    React.useEffect(() => setPage(0), [month]);
    const term = search.trim().toLowerCase();
    const visibleRows = rows.filter(
        (row) =>
            (!term || row.vehicleNumber.toLowerCase().includes(term)) &&
            (source === "all" || row.hasMonthlyRow === (source === "saved")),
    );
    const pageRows = visibleRows.slice(page * size, page * size + size);
    const savedCount = rows.filter((row) => row.hasMonthlyRow).length;

    return (
        <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Vehicle Costs</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Monthly fixed and variable costs for own vehicles. Used by the
                        Vehicle Performance Report.
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
                        <Link href="/vehicle-journeys/vehicle-pnl/monthly">View report</Link>
                    </Button>
                </div>
            </div>

            {query.isLoading ? <Skeleton className="h-64 w-full" /> : null}
            {query.isError ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                    Could not load vehicle costs.
                </div>
            ) : null}

            {!query.isLoading && !query.isError && rows.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                    No own vehicles found.
                </div>
            ) : null}

            {rows.length > 0 ? (
                <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                        <Input
                            placeholder="Search vehicle no."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(0);
                            }}
                            className="h-9 w-48"
                        />
                        <select
                            aria-label="Source"
                            className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
                            value={source}
                            onChange={(e) => {
                                setSource(e.target.value as typeof source);
                                setPage(0);
                            }}
                        >
                            <option value="all">All vehicles</option>
                            <option value="saved">Saved for this month</option>
                            <option value="defaults">Defaults (not saved yet)</option>
                        </select>
                        <span className="ml-auto text-xs text-muted-foreground">
                            {savedCount} of {rows.length} saved for this month
                        </span>
                    </div>
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-5 text-xs font-semibold">Vehicle</TableHead>
                                <TableHead className="text-right text-xs font-semibold">Monthly fixed</TableHead>
                                <TableHead
                                    className="text-right text-xs font-semibold"
                                    title="Automatic — drivers' earned salary from the approved salary run, split by days driven"
                                >
                                    Driver salary (auto)
                                </TableHead>
                                <TableHead className="text-right text-xs font-semibold">Other staff</TableHead>
                                <TableHead className="text-right text-xs font-semibold">Tyre + other</TableHead>
                                <TableHead className="text-xs font-semibold">Source</TableHead>
                                <TableHead className="w-12 pr-5" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
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
                            {pageRows.map((row) => (
                                <TableRow key={row.vehicleId} className="h-12 border-b border-border/60">
                                    <TableCell className="pl-5 font-semibold">{row.vehicleNumber}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatPaise(
                                            sumPaise(
                                                row.taxPaise,
                                                row.insurancePaise,
                                                row.permitPaise,
                                                row.fitnessPaise,
                                                row.emiPaise,
                                            ),
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {BigInt(row.driverSalaryPaise) > 0n
                                            ? formatPaise(row.driverSalaryPaise)
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatPaise(row.salaryPaise)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatPaise(sumPaise(row.tyrePaise, row.otherPaise))}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {row.hasMonthlyRow ? "Saved for this month" : "Defaults"}
                                    </TableCell>
                                    <TableCell className="pr-5 text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={`Edit costs for ${row.vehicleNumber}`}
                                            onClick={() => setEditing(row)}
                                        >
                                            <IconPencil size={16} />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
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
            ) : null}

            <EditDialog row={editing} month={month} onClose={() => setEditing(null)} />
        </div>
    );
}
