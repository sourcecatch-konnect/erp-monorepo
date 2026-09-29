"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconClock } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@skerp/ui/components/Card";
import { Input } from "@skerp/ui/components/input";
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

import type { VendorPaymentType } from "./vendor-payment.service";
import {
  LoadMoreFooter,
  PageHeader,
  SkeletonTableRows,
  formatDate,
  money,
} from "./vendor-payment.ui";
import { useSlipList } from "./useSlipList";

const TYPE_FILTERS: { label: string; value: VendorPaymentType | "ALL" }[] = [
  { label: "All types", value: "ALL" },
  { label: "Transporter", value: "TRANSPORTER" },
  { label: "Hamali", value: "HAMALI" },
];

export function VendorPaymentApprovalPage() {
  const router = useRouter();
  const [type, setType] = React.useState<VendorPaymentType | "ALL">("ALL");
  const { search, setSearch, isSearching, debouncedSearch, query, slips, total } = useSlipList({
    scope: "approval-queue",
    status: "PENDING_APPROVAL",
    type: type === "ALL" ? undefined : type,
  });

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
              {total} slip{total === 1 ? "" : "s"}
              {isSearching ? ` matching “${debouncedSearch}”` : " waiting on a decision"}.
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
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by slip no. or vendor name..."
            aria-label="Search the approval queue"
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
                <IconClock size={20} />
              </span>
              <p className="mt-3 font-medium">
                {isSearching ? "No matching slips" : "Nothing pending"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isSearching
                  ? "No slip waiting on approval matches that slip number or vendor."
                  : "No vendor payment slips are waiting on approval right now."}
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
                  {query.isFetchingNextPage ? <SkeletonTableRows columns={6} /> : null}
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
