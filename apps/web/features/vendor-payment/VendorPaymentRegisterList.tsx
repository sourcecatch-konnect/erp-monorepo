"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconClock, IconTruck, IconWallet } from "@tabler/icons-react";

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

import { vendorPaymentApi } from "./vendor-payment.service";
import { VendorPaymentStatusBadge, money } from "./vendor-payment.ui";

export function VendorPaymentRegisterList() {
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const query = useQuery({
    queryKey: ["vendor-payment", "slips", page, size],
    queryFn: () => vendorPaymentApi.listSlips({ page, size }),
  });
  if (query.isLoading) return <Skeleton className="h-72" />;
  const slips = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? 0;

  const draftCount = slips.filter((s) => s.status === "DRAFT").length;
  const pendingCount = slips.filter((s) => s.status === "PENDING_APPROVAL").length;
  const outstanding = slips.reduce(
    (sum, s) => sum + (BigInt(s.netPayablePaise) - BigInt(s.paidPaise)),
    0n,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Draft slips", value: draftCount, icon: IconTruck },
          { label: "Pending approval", value: pendingCount, icon: IconClock },
          { label: "Outstanding payable", value: money(outstanding), icon: IconWallet },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
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
          <CardTitle>Vendor payment slips</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select any row to review its lines, approval and disbursement history.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slip no.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Net payable</TableHead>
                <TableHead className="text-right">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((slip) => (
                <TableRow
                  key={slip.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/accounts/vendor-payments/${slip.id}`)}
                >
                  <TableCell className="font-medium">{slip.slipNumber}</TableCell>
                  <TableCell className="text-sm">{slip.type}</TableCell>
                  <TableCell className="text-sm">
                    {slip.transport?.name ?? slip.labour?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{slip.branch?.name ?? "—"}</TableCell>
                  <TableCell>
                    <VendorPaymentStatusBadge status={slip.status} />
                  </TableCell>
                  <TableCell className="text-right">{money(slip.netPayablePaise)}</TableCell>
                  <TableCell className="text-right">{money(slip.paidPaise)}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
