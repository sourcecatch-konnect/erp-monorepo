"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconCashBanknote } from "@tabler/icons-react";

import { Card, CardContent, CardHeader, CardTitle } from "@skerp/ui/components/Card";
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

import { vendorPaymentApi, type VendorPaymentSlip } from "./vendor-payment.service";
import { PageHeader, VendorPaymentStatusBadge, money } from "./vendor-payment.ui";

const outstanding = (slip: VendorPaymentSlip) =>
  BigInt(slip.netPayablePaise) - BigInt(slip.paidPaise);

export function VendorPaymentDisbursementQueuePage() {
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  // APPROVED and PARTIALLY_PAID are the two statuses eligible for a further
  // disbursement — fetch both and merge, since the list endpoint filters on
  // one status at a time.
  const approved = useQuery({
    queryKey: ["vendor-payment", "disbursement-queue", "APPROVED", page, size],
    queryFn: () => vendorPaymentApi.listSlips({ page, size, status: "APPROVED" }),
  });
  const partiallyPaid = useQuery({
    queryKey: ["vendor-payment", "disbursement-queue", "PARTIALLY_PAID", page, size],
    queryFn: () => vendorPaymentApi.listSlips({ page, size, status: "PARTIALLY_PAID" }),
  });

  const isLoading = approved.isLoading || partiallyPaid.isLoading;
  const slips = [...(approved.data?.data ?? []), ...(partiallyPaid.data?.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const total = (approved.data?.meta?.total ?? 0) + (partiallyPaid.data?.meta?.total ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment disbursements"
        description="Approved and partially paid vendor payment slips ready for a further payment."
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Ready to disburse</CardTitle>
          <p className="text-sm text-muted-foreground">
            {total} slip{total === 1 ? "" : "s"} with an outstanding balance.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : !slips.length ? (
            <div className="py-10 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <IconCashBanknote size={20} />
              </span>
              <p className="mt-3 font-medium">Nothing to disburse</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No approved or partially paid slips have an outstanding balance right now.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slip no.</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slips.map((slip) => (
                    <TableRow
                      key={slip.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/accounts/vendor-payments/${slip.id}/disburse`)}
                    >
                      <TableCell className="font-medium">{slip.slipNumber}</TableCell>
                      <TableCell className="text-sm">{slip.type}</TableCell>
                      <TableCell className="text-sm">
                        {slip.transport?.name ?? slip.labour?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <VendorPaymentStatusBadge status={slip.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {money(outstanding(slip))}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
