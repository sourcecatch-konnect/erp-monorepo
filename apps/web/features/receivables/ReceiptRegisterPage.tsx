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

import {
  TablePaginationFooter,
  TableSearchInput,
} from "@/components/data-table";

import { receiptApi, ReceiptStatus } from "./receipt.service";
import {
  PageHeader,
  ReceiptStatusBadge,
  formatDate,
  money,
} from "./receipt.ui";

export function ReceiptRegisterPage() {
  const router = useRouter();

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] =
    React.useState<ReceiptStatus | "ALL">("ALL");

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as ReceiptStatus | "ALL");
    setPage(0);
  };

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("ALL");
    setPage(0);
  };

  const receipts = useQuery({
    queryKey: [
      "receivables",
      "receipts",
      page,
      size,
      debouncedSearch,
      statusFilter,
    ],
    queryFn: () =>
      receiptApi.list({
        page,
        size,
        search: debouncedSearch || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      }),
  });

  const data = receipts.data?.data ?? [];
  const total = receipts.data?.meta?.total ?? 0;

  const pendingCount = data.filter(
    (receipt) => receipt.status === "PENDING_APPROVAL",
  ).length;

  const cancelledCount = data.filter(
    (receipt) => receipt.status === "CANCELLED",
  ).length;

  const postedTotal = data
    .filter((receipt) => receipt.status === "POSTED")
    .reduce((sum, receipt) => sum + BigInt(receipt.amountPaise), 0n);

  const hasFilters = Boolean(search.trim()) || statusFilter !== "ALL";

  const stats = [
    {
      label: "Receipts on this page",
      value: data.length,
      icon: IconReceipt2,
    },
    {
      label: "Pending approval on this page",
      value: pendingCount,
      icon: IconClock,
    },
    {
      label: "Posted amount on this page",
      value: money(postedTotal),
      icon: IconReceiptRupee,
    },
    {
      label: "Cancelled on this page",
      value: cancelledCount,
      icon: IconBan,
    },
  ];

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

      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </p>
                  <div className="mt-1 text-lg font-semibold">
                    {receipts.isLoading ? (
                      <Skeleton className="h-7 w-20" />
                    ) : receipts.isError ? (
                      "—"
                    ) : (
                      item.value
                    )}
                  </div>
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

          <CardContent className="pt-4">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <TableSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search receipt no. or customer..."
              />

              <Select
                value={statusFilter}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger
                  className="h-9 w-[180px]"
                  aria-label="Filter by receipt status"
                >
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">
                    Pending approval
                  </SelectItem>
                  <SelectItem value="POSTED">Posted</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>

            <div
              className="overflow-x-auto"
              aria-busy={receipts.isFetching}
            >
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
                  {receipts.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Skeleton className="my-3 h-40 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : receipts.isError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center">
                        <p className="text-sm text-destructive">
                          Unable to load receipts.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => void receipts.refetch()}
                        >
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center">
                        <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <IconReceipt2 size={20} />
                        </span>
                        <p className="mt-3 font-medium">
                          {hasFilters
                            ? "No matching receipts"
                            : "No receipts on this page"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {hasFilters
                            ? "Try another search or clear the status filter."
                            : "Record a customer payment or check another page."}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((receipt) => (
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
                        <TableCell>
                          {formatDate(receipt.receivedAt)}
                        </TableCell>
                        <TableCell>{receipt.customer.name}</TableCell>
                        <TableCell>{receipt.branch.name}</TableCell>
                        <TableCell>
                          {receipt._count.allocations}
                        </TableCell>
                        <TableCell>
                          <ReceiptStatusBadge status={receipt.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {money(receipt.amountPaise)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

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
    </div>
  );
}