"use client";

import * as React from "react";
import Link from "next/link";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { IconArrowLeft } from "@tabler/icons-react";
import { AttachmentPanel } from "@skerp/attachments-web";
import { PERMS, type ClaimDetail } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { StatTile } from "@skerp/ui/components/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import { attachmentApi } from "@/features/attachments/attachment.client";
import { DetailSection } from "@/features/masters/_shared/DetailSection";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import {
  CLAIM_CAUSE_LABELS,
  CLAIM_ORIGIN_LABELS,
  CLAIM_TYPE_LABELS,
  ClaimStatusBadge,
  RECOVERY_SOURCE_LABELS,
  RecoveryStatusBadge,
  claimSourceLink,
} from "./claim.ui";

/** Photos, the customer's claim letter, surveyor report — one list per claim. */
export const CLAIM_ATTACHMENT_ENTITY = "claim";

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Claim raised",
  UPDATED: "Updated from the source document",
  STATUS_CHANGED: "Status changed",
  SOURCE_CHANGED: "Source document changed",
  RECOVERY_ADDED: "Recovery added",
  RECOVERY_STATUS_CHANGED: "Recovery updated",
  NOTE: "Note",
};

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Timeline({ events }: { events: ClaimDetail["events"] }) {
  if (events.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Nothing recorded yet.</p>;
  }
  return (
    <ol className="space-y-4 p-4">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">{EVENT_LABELS[event.eventType] ?? event.eventType}</p>
            {event.fromStatus && event.toStatus ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <ClaimStatusBadge status={event.fromStatus} />
                <span>to</span>
                <ClaimStatusBadge status={event.toStatus} />
              </div>
            ) : null}
            {event.note ? <p className="text-sm text-muted-foreground">{event.note}</p> : null}
            <p className="text-xs text-muted-foreground">
              {event.actor?.name ?? "System"} · {formatDateTime(event.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const loadErrorText = (error: unknown) => {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 403) return "This claim belongs to a branch you don't have access to.";
  if (status === 404) return "This claim doesn't exist or has been removed.";
  return getErrorMessage(error);
};

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-72" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[66px] w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function ClaimDetailPage({ claimId }: { claimId: string }) {
  const canViewAttachments = useCan(PERMS.ATTACHMENTS.VIEW);
  const query = useQuery({
    queryKey: claimKeys.detail(claimId),
    queryFn: () => claimApi.get(claimId),
  });

  const backLink = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 text-muted-foreground hover:text-foreground"
    >
      <Link href="/claims">
        <IconArrowLeft size={15} className="mr-1" /> Back to claims
      </Link>
    </Button>
  );

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    return (
      <div className="space-y-3">
        {backLink}
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          {loadErrorText(query.error)}
        </div>
      </div>
    );
  }

  const claim = query.data;
  const source = claimSourceLink(claim);
  const closedReason =
    claim.status === "REJECTED"
      ? claim.rejectedReason
      : claim.status === "CANCELLED"
        ? claim.cancelReason
        : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {backLink}
        <p className="text-xs font-medium text-muted-foreground">Damage claim</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{claim.claimNumber}</h1>
          <ClaimStatusBadge status={claim.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {CLAIM_TYPE_LABELS[claim.claimType]} on LR {claim.lr.lrNumber} · raised{" "}
          {formatDate(claim.claimDate)} by {claim.createdBy.name}
        </p>
      </div>

      {closedReason ? (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
          <span className="font-medium">
            {claim.status === "REJECTED" ? "Rejected: " : "Cancelled: "}
          </span>
          {closedReason}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Claimed" value={formatPaise(claim.claimedAmountPaise)} />
        <StatTile
          label="Settled"
          value={formatPaise(claim.settledAmountPaise)}
          hint={claim.settledAt ? `on ${formatDate(claim.settledAt)}` : "Not settled yet"}
        />
        <StatTile
          label="Recovered"
          value={formatPaise(claim.recoveredAmountPaise)}
          hint="Approved + received"
        />
        <StatTile
          label="Net loss"
          value={formatPaise(claim.netLossPaise)}
          hint={claim.netLossPaise === null ? "Known once settled" : "Settled − recovered"}
          tone={claim.netLossPaise !== null && claim.netLossPaise > 0 ? "warning" : "muted"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DetailSection title="Claim details" contentClassName="grid gap-4 p-4 sm:grid-cols-3">
            <Info label="LR">
              <Link
                href={`/lorry-receipts/${claim.lr.groupId}`}
                className="text-primary hover:underline"
              >
                {claim.lr.lrNumber}
              </Link>
              <span className="block text-xs text-muted-foreground">{claim.lr.groupNumber}</span>
            </Info>
            <Info label="Customer">{claim.customer.name}</Info>
            <Info label="Branch">{claim.branch.name}</Info>
            <Info label="Consignor → consignee">
              {claim.lr.consignor.name} → {claim.lr.consignee.name}
            </Info>
            <Info label="Raised from">
              {source.href ? (
                <Link href={source.href} className="text-primary hover:underline">
                  {source.label}
                </Link>
              ) : (
                CLAIM_ORIGIN_LABELS[claim.origin]
              )}
            </Info>
            <Info label="Caused by">
              {claim.causedBy ? CLAIM_CAUSE_LABELS[claim.causedBy] : "Not assessed yet"}
            </Info>
            <Info label="Goods value">{formatPaise(claim.goodsValuePaise)}</Info>
            <Info label="Claim date">{formatDate(claim.claimDate)}</Info>
            {claim.basisDescription ? (
              <div className="sm:col-span-3">
                <Info label="Basis of claim">{claim.basisDescription}</Info>
              </div>
            ) : null}
          </DetailSection>

          <DetailSection title="Goods">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Goods</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead className="text-right">Short</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claim.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No goods lines recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  claim.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.goodsName}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.damagedQty}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.shortageQty}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPaise(item.valuePaise)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DetailSection>

          <DetailSection title="Recoveries">
            {claim.recoveries.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No recovery recorded yet. Recovery from insurance, the transporter or others is
                tracked here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claim.recoveries.map((recovery) => (
                    <TableRow key={recovery.id}>
                      <TableCell>{RECOVERY_SOURCE_LABELS[recovery.source]}</TableCell>
                      <TableCell>{recovery.partyName ?? "—"}</TableCell>
                      <TableCell>{recovery.referenceNo ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPaise(recovery.amountPaise)}
                      </TableCell>
                      <TableCell>
                        <RecoveryStatusBadge status={recovery.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DetailSection>
        </div>

        <div className="space-y-4">
          <DetailSection title="Timeline">
            <Timeline events={claim.events} />
          </DetailSection>

          {canViewAttachments && (
            <DetailSection title="Photos and documents" contentClassName="space-y-2 p-4">
              <p className="text-xs text-muted-foreground">
                Damage photos, the customer&apos;s claim letter, surveyor report.
              </p>
              <AttachmentPanel
                api={attachmentApi}
                entityType={CLAIM_ATTACHMENT_ENTITY}
                entityId={claim.id}
              />
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
}
