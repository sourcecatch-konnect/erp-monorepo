"use client";

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
import { money } from "./billing.util";
import { billingApi } from "./billing.service";
import { BillStatus, BillStatusBadge } from "./components/billingStatusBadge";

export function BillsList() {
    const router = useRouter();
    const query = useQuery({
        queryKey: ["billing", "bills"],
        queryFn: billingApi.listBills,
    });
    if (query.isLoading) return <Skeleton className="h-72" />;
    const bills = query.data ?? [];
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
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bills.map((bill) => (
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
                                    <TableCell className="text-right">
                                        {money(bill.totalAmountPaise)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}