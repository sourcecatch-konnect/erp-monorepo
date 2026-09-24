"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import {
  vendorPaymentApi,
  type VendorPaymentSlip,
  type VendorPaymentStatus,
} from "./vendor-payment.service";
import { PageHeader, VendorPaymentStatusBadge, money } from "./vendor-payment.ui";

// Rows fetched per request. The queue is never loaded whole: the first chunk
// loads with the page, each further chunk only when "Load more" is clicked.
const CHUNK_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

// The two statuses that can still take a disbursement — sent as one filter so
// the server pages a single combined list.
const DISBURSABLE_STATUSES: VendorPaymentStatus[] = ["APPROVED", "PARTIALLY_PAID"];

const outstanding = (slip: VendorPaymentSlip) =>
  BigInt(slip.netPayablePaise) - BigInt(slip.paidPaise);

export function VendorPaymentDisbursementQueuePage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const queue = useInfiniteQuery({
    queryKey: ["vendor-payment", "disbursement-queue", debouncedSearch],
    queryFn: ({ pageParam }) =>
      vendorPaymentApi.listSlips({
        page: pageParam,
        size: CHUNK_SIZE,
        status: DISBURSABLE_STATUSES,
        search: debouncedSearch || undefined,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < (lastPage.meta?.total ?? 0) ? allPages.length : undefined;
    },
    // Keep the previous results on screen while a new search term is fetched.
    placeholderData: keepPreviousData,
  });

  const slips = React.useMemo(
    () => queue.data?.pages.flatMap((page) => page.data) ?? [],
    [queue.data],
  );
  const total = queue.data?.pages.at(-1)?.meta?.total ?? 0;
  const isSearching = Boolean(debouncedSearch);

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

          {queue.isLoading ? (
            <Skeleton className="h-72" />
          ) : queue.isError ? (
            <div className="py-10 text-center">
              <p className="font-medium">Could not load the queue</p>
              <Button variant="outline" className="mt-3" onClick={() => queue.refetch()}>
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
            <div aria-busy={queue.isPlaceholderData} className={queue.isPlaceholderData ? "opacity-60" : undefined}>
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
                  {queue.isFetchingNextPage
                    ? Array.from({ length: 3 }, (_, index) => (
                        <TableRow key={`loading-${index}`}>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-4 w-20" />
                          </TableCell>
                        </TableRow>
                      ))
                    : null}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {slips.length} of {total}
                </p>
                {queue.hasNextPage ? (
                  <Button
                    variant="outline"
                    onClick={() => queue.fetchNextPage()}
                    disabled={queue.isFetchingNextPage}
                  >
                    Load more
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
