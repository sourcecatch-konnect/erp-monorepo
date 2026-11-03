"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";

import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import { CLAIM_CAUSE_LABELS, CLAIM_TYPE_LABELS, ClaimStatusBadge } from "./claim.ui";

const COLUMN_COUNT = 12;

export function ClaimsListPage() {
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(20);

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const params = { page, size };
  const list = useQuery({
    queryKey: claimKeys.list(params),
    queryFn: () => claimApi.list(params),
    placeholderData: keepPreviousData,
  });
  const claims = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Damage Claims</h1>
        <p className="text-sm text-muted-foreground">
          Every damage or shortage on an LR: what the customer claimed, what we settled, and what
          we recovered from whoever caused it.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>LR No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Caused by</TableHead>
              <TableHead className="text-right">Claimed</TableHead>
              <TableHead className="text-right">Settled</TableHead>
              <TableHead className="text-right">Recovered</TableHead>
              <TableHead className="text-right">Net loss</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!list.isLoading && claims.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No claims yet. A claim appears here when an LR acknowledgement or GRN records
                  damage or shortage.
                </TableCell>
              </TableRow>
            )}
            {claims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell className="font-medium whitespace-nowrap">{claim.claimNumber}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(claim.claimDate)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={`/lorry-receipts/${claim.lr.id}`}
                    className="text-primary hover:underline"
                  >
                    {claim.lr.lrNumber}
                  </Link>
                </TableCell>
                <TableCell>{claim.customer.name}</TableCell>
                <TableCell>{claim.branch.name}</TableCell>
                <TableCell>{CLAIM_TYPE_LABELS[claim.claimType]}</TableCell>
                <TableCell>{claim.causedBy ? CLAIM_CAUSE_LABELS[claim.causedBy] : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(claim.claimedAmountPaise)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(claim.settledAmountPaise)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(claim.recoveredAmountPaise)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(claim.netLossPaise)}
                </TableCell>
                <TableCell>
                  <ClaimStatusBadge status={claim.status} />
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
    </div>
  );
}
