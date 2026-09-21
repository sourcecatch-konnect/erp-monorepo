"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  IconBan,
  IconClock,
  IconReceipt2,
  IconReceiptRupee,
} from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
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
import { TablePaginationFooter } from "@/components/data-table";
import { receiptApi } from "./receipt.service";
import { PageHeader, ReceiptStatusBadge, formatDate, money } from "./receipt.ui";

export function ReceiptRegisterPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const receipts = useQuery({
    queryKey: ["receivables", "receipts", page, size],
    queryFn: () => receiptApi.list({ page, size }),
  });

  const data = receipts.data?.data ?? [];
  const total = receipts.data?.meta?.total ?? 0;
  const pendingCount = data.filter(
    (r) => r.status === "PENDING_APPROVAL",
  ).length;
  const cancelledCount = data.filter((r) => r.status === "CANCELLED").length;
  const postedTotal = data
    .filter((r) => r.status === "POSTED")
    .reduce((sum, r) => sum + BigInt(r.amountPaise), 0n);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client payment receivable"
        description="Record customer payments against outstanding bills, and track approvals for TDS, damage or rate-difference deductions."
        actions={
          <Button onClick={() => router.push("/accounts/receipts/new")}>
            New receipt
          </Button>
        }
      />
      {receipts.isLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total receipts",
                value: data.length,
                icon: IconReceipt2,
              },
              {
                label: "Pending approval",
                value: pendingCount,
                icon: IconClock,
              },
              {
                label: "Posted amount",
                value: money(postedTotal),
                icon: IconReceiptRupee,
              },
              {
                label: "Cancelled",
                value: cancelledCount,
                icon: IconBan,
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
              <CardTitle>Receipts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select any row to review its allocations and take approval or
                cancellation actions.
              </p>
            </CardHeader>
            <CardContent>
              {!data.length ? (
                <div className="py-10 text-center">
                  <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <IconReceipt2 size={20} />
                  </span>
                  <p className="mt-3 font-medium">No receipts yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Record your first customer payment to see it here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt no.</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Bills</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((receipt) => (
                        <TableRow
                          key={receipt.id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(`/accounts/receipts/${receipt.id}`)
                          }
                        >
                          <TableCell className="font-medium">
                            {receipt.receiptNumber ?? "Pending"}
                          </TableCell>
                          <TableCell>{formatDate(receipt.receivedAt)}</TableCell>
                          <TableCell>{receipt.customer.name}</TableCell>
                          <TableCell>{receipt.branch.name}</TableCell>
                          <TableCell>{receipt._count.allocations}</TableCell>
                          <TableCell>
                            <ReceiptStatusBadge status={receipt.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {money(receipt.amountPaise)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePaginationFooter
                    total={total}
                    page={page}
                    size={size}
                    onPageChange={setPage}
                    onSizeChange={handleSizeChange}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
