"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@skerp/ui/components/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@skerp/ui/components/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { branchApi } from "@/features/masters/branch/branch.service";
import { ledgerApi } from "./api/ledger.service";
import { ledgerKeys } from "./api/ledger.keys";
import { VoucherDialog } from "./components/VoucherDialog";
import { JournalStatusBadge } from "./components/journalStatusBadge";
import type { VoucherType } from "./voucher.types";
import { formatLabel, invoiceDate, money } from "./voucher.util";

const VOUCHER_TYPES: VoucherType[] = [
    "SALES",
    "RECEIPT",
    "PAYMENT",
    "JOURNAL",
    "CONTRA",
    "CREDIT_NOTE",
    "DEBIT_NOTE",
];

const today = () => new Date().toISOString().slice(0, 10);

/** Every voucher posted on a given date (or range), across all types —
 *  the day-by-day audit trail. Click a row to see its full Dr/Cr breakdown. */
export function DayBookPage() {
    const [from, setFrom] = React.useState(today());
    const [to, setTo] = React.useState(today());
    const [branchId, setBranchId] = React.useState<string>("ALL");
    const [voucherType, setVoucherType] = React.useState<VoucherType | "ALL">("ALL");
    const [openVoucherId, setOpenVoucherId] = React.useState<string | null>(null);

    const branches = useQuery({
        queryKey: ["ledger", "day-book", "branches"],
        queryFn: () => branchApi.list({ page: 0, size: 200 }),
    });

    const filters = {
        from,
        to,
        branchId: branchId === "ALL" ? undefined : branchId,
        voucherType: voucherType === "ALL" ? undefined : voucherType,
    };

    const dayBook = useQuery({
        queryKey: ledgerKeys.dayBook(filters),
        queryFn: () => ledgerApi.dayBook(filters),
        enabled: Boolean(from),
    });

    const voucher = useQuery({
        queryKey: ledgerKeys.voucher(openVoucherId ?? ""),
        queryFn: () => ledgerApi.voucher(openVoucherId!),
        enabled: Boolean(openVoucherId),
    });

    const total = (dayBook.data ?? []).reduce(
        (sum, e) => sum + BigInt(e.totalPaise),
        0n,
    );

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-lg font-semibold">Day Book</h1>
                <p className="text-sm text-muted-foreground">
                    Every voucher posted on a date — sales, receipts, payments and
                    manual journals together. Click a row for its full breakdown.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">From</label>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">To</label>
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All branches</SelectItem>
                        {branches.data?.data.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                                {b.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={voucherType} onValueChange={(v) => setVoucherType(v as VoucherType | "ALL")}>
                    <SelectTrigger className="w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All voucher types</SelectItem>
                        {VOUCHER_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                                {formatLabel(t)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Voucher</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Narration</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dayBook.isLoading
                            ? [0, 1, 2, 3].map((row) => (
                                <TableRow key={row}>
                                    {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
                                        <TableCell key={cell}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                            : null}
                        {!dayBook.isLoading && dayBook.data?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                                    No vouchers posted in this range.
                                </TableCell>
                            </TableRow>
                        ) : null}
                        {dayBook.data?.map((entry) => (
                            <TableRow
                                key={entry.id}
                                className="cursor-pointer hover:bg-muted/40"
                                onClick={() => setOpenVoucherId(entry.id)}
                            >
                                <TableCell className="whitespace-nowrap">
                                    {invoiceDate(entry.voucherDate)}
                                </TableCell>
                                <TableCell className="font-medium">{entry.voucherNumber}</TableCell>
                                <TableCell className="text-muted-foreground">
                                    {formatLabel(entry.voucherType)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {entry.branch.name}
                                </TableCell>
                                <TableCell className="max-w-64 truncate text-muted-foreground">
                                    {entry.narration ?? "—"}
                                </TableCell>
                                <TableCell>
                                    <JournalStatusBadge status={entry.status} />
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                    {money(entry.totalPaise)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    {dayBook.data?.length ? (
                        <tfoot>
                            <TableRow>
                                <TableCell colSpan={6} className="text-right text-sm font-semibold">
                                    Total
                                </TableCell>
                                <TableCell className="text-right text-sm font-semibold tabular-nums">
                                    {money(total)}
                                </TableCell>
                            </TableRow>
                        </tfoot>
                    ) : null}
                </Table>
            </div>

            <VoucherDialog
                open={Boolean(openVoucherId)}
                onOpenChange={(open) => !open && setOpenVoucherId(null)}
                voucher={voucher.data}
                isLoading={voucher.isLoading}
                isError={voucher.isError}
                errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
            />
        </div>
    );
}
