"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconAlertTriangle } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import { CLAIM_TYPE_LABELS, ClaimStatusBadge, quantityText } from "./claim.ui";

/**
 * Damage claims on the LRs of one group, for the LR detail page. Renders
 * nothing without claim.view or when there are no claims.
 */
export function LRClaimsSection({ groupId }: { groupId: string }) {
  const canView = useCan(PERMS.CLAIM.VIEW);
  const params = { lrGroupId: groupId, page: 0, size: 50 };
  const query = useQuery({
    queryKey: claimKeys.list(params),
    queryFn: () => claimApi.list(params),
    enabled: canView,
  });
  const claims = query.data?.data ?? [];
  if (!canView || claims.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <IconAlertTriangle size={19} className="text-primary" />
        Damage claims
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Damage or shortage recorded on {claims.length === 1 ? "this consignment" : "these consignments"}
      </p>
      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim No</TableHead>
              <TableHead>LR No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="text-right">Claimed</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell className="whitespace-nowrap font-medium">
                  <Link href={`/claims/${claim.id}`} className="text-primary hover:underline">
                    {claim.claimNumber}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">{claim.lr.lrNumber}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(claim.claimDate)}</TableCell>
                <TableCell>{CLAIM_TYPE_LABELS[claim.claimType]}</TableCell>
                <TableCell>{quantityText(claim.damagedQty, claim.shortageQty)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(claim.claimedAmountPaise)}
                </TableCell>
                <TableCell>
                  <ClaimStatusBadge status={claim.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
