"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    IconClock,
    IconReceipt,
    IconReceiptRupee,
    IconShieldCheck,
} from "@tabler/icons-react";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@skerp/ui/components/Card";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@skerp/ui/components/table";
import { TablePaginationFooter, TableSearchInput } from "@/components/data-table";
import { money } from "./billing.util";
import { billingApi } from "./billing.service";
import { BillStatus, BillStatusBadge } from "./components/billingStatusBadge";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@skerp/ui/components/select";

export function BillsList() {
    const router = useRouter();
    const [page, setPage] = React.useState(0);
    const [size, setSize] = React.useState(10);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] =
        React.useState<BillStatus | "ALL">("ALL");
    const debouncedSearch = useDebouncedValue(search);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPage(0);
    };

    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value as BillStatus | "ALL");
        setPage(0);
    };

    const query = useQuery({
        queryKey: [
            "billing",
            "bills",
            page,
            size,
            debouncedSearch.trim(),
            statusFilter,
        ],
        queryFn: () =>
            billingApi.listBills({
                page,
                size,
                search: debouncedSearch.trim() || undefined,
                status:
                    statusFilter === "ALL"
                        ? undefined
                        : statusFilter,
            }),
    });

    const handleSizeChange = (nextSize: number) => {
        setSize(nextSize);
        setPage(0);
    };

    const bills = query.data?.data ?? [];
    const total = query.data?.meta?.total ?? 0;
    const draftCount = bills.filter((bill) => bill.status === "DRAFT").length;
    const reviewCount = bills.filter(
        (bill) => bill.status === "PENDING_REVIEW",
    ).length;
    const approvedCount = bills.filter(
        (bill) => bill.status === "APPROVED",
    ).length;
    const outstanding = bills.reduce(
        (sum, bill) => sum + BigInt(bill.outstandingAmountPaise),
        0n,
    );
    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: "Draft bills", value: draftCount, icon: IconReceipt },
                    { label: "Awaiting review", value: reviewCount, icon: IconClock },
                    {
                        label: "Ready to finalise",
                        value: approvedCount,
                        icon: IconShieldCheck,
                    },
                    {
                        label: "Outstanding",
                        value: money(outstanding),
                        icon: IconReceiptRupee,
                    },
                ].map((item) => (
                    <Card key={item.label}>
                        <CardContent className="flex items-center justify-between p-4">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">
                                    {item.label}
                                </p>
                                <p className="mt-1 text-lg font-semibold">{item.value}</p>
                            </div>
                            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <item.icon size={18} />
                            </span>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Billing register</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Select any row to review its charges, GST calculation and approval
                        actions.
                    </p>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        <TableSearchInput
                            value={search}
                            onChange={handleSearchChange}
                            placeholder="Search bill no. or customer..."
                        />

                        <Select
                            value={statusFilter}
                            onValueChange={handleStatusFilterChange}
                        >
                            <SelectTrigger
                                className="h-9 w-[180px]"
                                aria-label="Filter by bill status"
                            >
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="ALL">All statuses</SelectItem>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="PENDING_REVIEW">
                                    Pending review
                                </SelectItem>
                                <SelectItem value="APPROVED">Approved</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bill no.</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Place of Supply</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Accounting</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {query.isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        <Skeleton className="my-3 h-32 w-full" />
                                    </TableCell>
                                </TableRow>
                            ) : query.isError ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="h-32 text-center text-destructive"
                                    >
                                        <p>Unable to load bills.</p>
                                        <button
                                            type="button"
                                            onClick={() => void query.refetch()}
                                            className="mt-2 underline"
                                        >
                                            Retry
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ) : bills.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="h-32 text-center text-muted-foreground"
                                    >
                                        No bills found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                bills.map((bill) => (
                                    <TableRow
                                        key={bill.id}
                                        className="cursor-pointer"
                                        onClick={() => router.push(`/accounts/bills/${bill.id}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {bill.billNumber ?? "Draft"}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(bill.billDate).toLocaleDateString("en-IN")}
                                        </TableCell>
                                        <TableCell>
                                            {bill.billingCustomer?.name ??
                                                bill.billingPartyNameSnapshot}
                                        </TableCell>
                                        <TableCell>
                                            {bill.placeOfSupplyState?.name ??
                                                bill.placeOfSupplyNameSnapshot}
                                        </TableCell>
                                        <TableCell>
                                            <BillStatusBadge status={bill.status as BillStatus} />

                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {bill.journalEntry
                                                ? bill.journalEntry.status === "REVERSED"
                                                    ? "Reversed"
                                                    : bill.journalEntry.tallySyncStatus === "SYNCED"
                                                        ? "Synced"
                                                        : "Posted"
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {money(bill.totalAmountPaise)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}

                        </TableBody>
                    </Table>
                    <TablePaginationFooter
                        total={total}
                        page={page}
                        size={size}
                        onPageChange={setPage}
                        onSizeChange={handleSizeChange}
                    />
                </CardContent>
            </Card>
        </div>
    );
}