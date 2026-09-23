"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconClock } from "@tabler/icons-react";

import { Card, CardContent, CardHeader, CardTitle } from "@skerp/ui/components/Card";
import { Skeleton } from "@skerp/ui/components/skeleton";
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
import { TablePaginationFooter } from "@/components/data-table";

import { vendorPaymentApi, type VendorPaymentType } from "./vendor-payment.service";
import { PageHeader, formatDate, money } from "./vendor-payment.ui";

const TYPE_FILTERS: { label: string; value: VendorPaymentType | "ALL" }[] = [
  { label: "All types", value: "ALL" },
  { label: "Transporter", value: "TRANSPORTER" },
  { label: "Hamali", value: "HAMALI" },
];

export function VendorPaymentApprovalPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [type, setType] = React.useState<VendorPaymentType | "ALL">("ALL");

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const query = useQuery({
    queryKey: ["vendor-payment", "approval-queue", page, size, type],
    queryFn: () =>
      vendorPaymentApi.listSlips({
        page,
        size,
        status: "PENDING_APPROVAL",
        type: type === "ALL" ? undefined : type,
      }),
  });

  const slips = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment approvals"
        description="Vendor payment slips pending approval — open one to review its lines and approve or reject."
      />

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
          <div>
            <CardTitle>Approval queue</CardTitle>
            <p className="text-sm text-muted-foreground">
              {total} slip{total === 1 ? "" : "s"} waiting on a decision.
            </p>
          </div>
          <Select value={type} onValueChange={(v) => setType(v as VendorPaymentType | "ALL")}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <Skeleton className="h-72" />
          ) : !slips.length ? (
            <div className="py-10 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <IconClock size={20} />
              </span>
              <p className="mt-3 font-medium">Nothing pending</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No vendor payment slips are waiting on approval right now.
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
                    <TableHead>Branch</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Net payable</TableHead>
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
                      <TableCell className="text-xs">{formatDate(slip.createdAt)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {money(slip.netPayablePaise)}
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
