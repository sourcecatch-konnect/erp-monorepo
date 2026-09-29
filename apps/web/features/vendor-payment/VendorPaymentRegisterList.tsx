"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconClock, IconTruck, IconWallet } from "@tabler/icons-react";

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

import { vendorPaymentApi } from "./vendor-payment.service";
import {
  LoadMoreFooter,
  SkeletonTableRows,
  VendorPaymentStatusBadge,
  money,
} from "./vendor-payment.ui";
import { useSlipList } from "./useSlipList";

export function VendorPaymentRegisterList() {
  const router = useRouter();
  const { search, setSearch, isSearching, debouncedSearch, query, slips, total } = useSlipList({
    scope: "register",
  });

  // Headline numbers come from the server over every slip in scope — computing
  // them from the loaded chunk would only ever count the rows on screen.
  const summary = useQuery({
    queryKey: ["vendor-payment", "slip-summary"],
    queryFn: () => vendorPaymentApi.slipSummary(),
  });

  const cards = [
    { label: "Draft slips", value: summary.data?.draftCount, icon: IconTruck },
    { label: "Pending approval", value: summary.data?.pendingApprovalCount, icon: IconClock },
    {
      label: "Outstanding payable",
      value: summary.data ? money(summary.data.outstandingPaise) : undefined,
      icon: IconWallet,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                {item.value === undefined ? (
                  <Skeleton className="mt-2 h-6 w-24" />
                ) : (
                  <p className="mt-1 text-lg font-semibold">{item.value}</p>
                )}
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
            {isSearching
              ? `${total} slip${total === 1 ? "" : "s"} matching “${debouncedSearch}”.`
              : "Select any row to review its lines, approval and disbursement history."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by slip no. or vendor name..."
            aria-label="Search vendor payment slips"
            className="sm:max-w-sm"
          />

          {query.isLoading ? (
            <Skeleton className="h-72" />
          ) : query.isError ? (
            <div className="py-10 text-center">
              <p className="font-medium">Could not load the slips</p>
              <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
                Try again
              </Button>
            </div>
          ) : !slips.length ? (
            <div className="py-10 text-center">
              <p className="font-medium">{isSearching ? "No matching slips" : "No slips yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isSearching
                  ? "No slip matches that slip number or vendor."
                  : "Vendor payment slips will appear here once they are created."}
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
                  {query.isFetchingNextPage ? <SkeletonTableRows columns={7} /> : null}
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
