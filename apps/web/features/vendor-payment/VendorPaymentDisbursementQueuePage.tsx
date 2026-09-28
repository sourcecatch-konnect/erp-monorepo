"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconCashBanknote } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@skerp/ui/components/Card";
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

import type { VendorPaymentSlip, VendorPaymentStatus } from "./vendor-payment.service";
import {
  LoadMoreFooter,
  PageHeader,
  SkeletonTableRows,
  VendorPaymentStatusBadge,
  money,
} from "./vendor-payment.ui";
import { useSlipList } from "./useSlipList";

// The two statuses that can still take a disbursement — sent as one filter so
// the server pages a single combined list.
const DISBURSABLE_STATUSES: VendorPaymentStatus[] = ["APPROVED", "PARTIALLY_PAID"];

const outstanding = (slip: VendorPaymentSlip) =>
  BigInt(slip.netPayablePaise) - BigInt(slip.paidPaise);

export function VendorPaymentDisbursementQueuePage() {
  const router = useRouter();
  const { search, setSearch, isSearching, debouncedSearch, query, slips, total } = useSlipList({
    scope: "disbursement-queue",
    status: DISBURSABLE_STATUSES,
  });

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
            {total} slip{total === 1 ? "" : "s"}
            {isSearching ? ` matching “${debouncedSearch}”` : " with an outstanding balance"}.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by slip no. or vendor name..."
            aria-label="Search the disbursement queue"
            className="sm:max-w-sm"
          />

          {query.isLoading ? (
            <Skeleton className="h-72" />
          ) : query.isError ? (
            <div className="py-10 text-center">
              <p className="font-medium">Could not load the queue</p>
              <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
                Try again
              </Button>
            </div>
          ) : !slips.length ? (
            <div className="py-10 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <IconCashBanknote size={20} />
              </span>
              <p className="mt-3 font-medium">
                {isSearching ? "No matching slips" : "Nothing to disburse"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isSearching
                  ? "No approved or partially paid slip matches that slip number or vendor."
                  : "No approved or partially paid slips have an outstanding balance right now."}
              </p>
            </div>
          ) : (
            <div
              aria-busy={query.isPlaceholderData}
              className={query.isPlaceholderData ? "opacity-60" : undefined}
            >
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
                  {query.isFetchingNextPage ? <SkeletonTableRows columns={5} /> : null}
                </TableBody>
              </Table>
              <LoadMoreFooter
                shown={slips.length}
                total={total}
                hasNextPage={Boolean(query.hasNextPage)}
                isFetchingNextPage={query.isFetchingNextPage}
                onLoadMore={() => query.fetchNextPage()}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
