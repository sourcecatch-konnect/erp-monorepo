"use client";

import * as React from "react";
import Link from "next/link";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";
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

import ReasonDialog from "@/components/feedback/ReasonDialog";
import { useAuth, useCan } from "@/features/auth";
import { attachmentApi } from "@/features/attachments/attachment.client";
import { DetailSection } from "@/features/masters/_shared/DetailSection";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { AssessClaimDialog } from "./AssessClaimDialog";
import { SettleClaimDialog } from "./SettleClaimDialog";
import { RecoveriesSection } from "./RecoveriesSection";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import {
  CLAIM_CAUSE_LABELS,
  CLAIM_ORIGIN_LABELS,
  CLAIM_TYPE_LABELS,
  ClaimStatusBadge,
  PAYMENT_MODE_LABELS,
  SETTLEMENT_MODE_LABELS,
  claimSourceLink,
  isEstimatedAmount,
} from "./claim.ui";

/** Photos, the customer's claim letter, surveyor report — one list per claim. */
export const CLAIM_ATTACHMENT_ENTITY = "claim";

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Claim raised",
  UPDATED: "Updated",
  STATUS_CHANGED: "Status changed",
  SOURCE_CHANGED: "Source document changed",
  SETTLEMENT_REQUESTED: "Settlement sent for approval",
  SETTLEMENT_DECLINED: "Settlement declined",
  RECOVERY_ADDED: "Recovery added",
  RECOVERY_STATUS_CHANGED: "Recovery updated",
  NOTE: "Note",
};

type ReasonAction = "reject" | "cancel" | "decline";

const REASON_DIALOG: Record<
  ReasonAction,
  { title: string; description: string; confirmLabel: string; done: string }
> = {
  reject: {
    title: "Reject claim",
    description: "We don't accept the customer's claim. The reason is kept on the claim's timeline.",
    confirmLabel: "Reject claim",
    done: "Claim rejected",
  },
  cancel: {
    title: "Cancel claim",
    description:
      "The claim was raised by mistake. It won't come back even if the acknowledgement or GRN is edited later.",
    confirmLabel: "Cancel claim",
    done: "Claim cancelled",
  },
  decline: {
    title: "Decline settlement",
    description: "The claim stays active and can be settled again for a different amount.",
    confirmLabel: "Decline settlement",
    done: "Settlement declined",
  },
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

function SettlementSection({ settlement, claim }: {
  settlement: NonNullable<ClaimDetail["settlement"]>;
  claim: ClaimDetail;
}) {
  return (
    <DetailSection title="Settlement" contentClassName="grid gap-4 p-4 sm:grid-cols-3">
      <Info label="Settled">
        {formatPaise(claim.settledAmountPaise)} on {formatDate(claim.settledAt)}
      </Info>
      <Info label="How">{SETTLEMENT_MODE_LABELS[settlement.mode]}</Info>
      {settlement.receipt ? (
        <Info label="Receipt">
          <Link
            href={`/accounts/receipts/${settlement.receipt.id}`}
            className="text-primary hover:underline"
          >
            {settlement.receipt.receiptNumber ?? "Receipt"}
          </Link>
          <span className="block text-xs text-muted-foreground">
            Bill {settlement.receipt.billNumber ?? "—"} ·{" "}
            {formatPaise(settlement.receipt.damageAmountPaise)} deducted
          </span>
        </Info>
      ) : null}
      {settlement.creditNote ? (
        <Info label="Credit note">
          <Link
            href={`/accounts/bills/${settlement.creditNote.billId}`}
            className="text-primary hover:underline"
          >
            {settlement.creditNote.noteNumber}
          </Link>
          <span className="block text-xs text-muted-foreground">
            Bill {settlement.creditNote.billNumber ?? "—"} ·{" "}
            {formatPaise(settlement.creditNote.amountPaise)}
          </span>
        </Info>
      ) : null}
      {settlement.mode === "PAID_SEPARATELY" ? (
        <Info label="Paid from">
          {settlement.fundingAccountName ?? "—"}
          {settlement.paymentMode ? (
            <span className="block text-xs text-muted-foreground">
              {PAYMENT_MODE_LABELS[settlement.paymentMode]}
              {settlement.referenceNo ? ` · ${settlement.referenceNo}` : ""}
            </span>
          ) : null}
        </Info>
      ) : null}
      {settlement.voucher ? <Info label="Voucher">{settlement.voucher.voucherNumber}</Info> : null}
      <Info label="Settled by">{settlement.settledBy?.name ?? "—"}</Info>
      {settlement.approvedBy ? (
        <Info label="Approved by">{settlement.approvedBy.name}</Info>
      ) : null}
      {settlement.note ? (
        <div className="sm:col-span-3">
          <Info label="Note">{settlement.note}</Info>
        </div>
      ) : null}
    </DetailSection>
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canViewAttachments = useCan(PERMS.ATTACHMENTS.VIEW);
  const canUpdate = useCan(PERMS.CLAIM.UPDATE);
  const canSettle = useCan(PERMS.CLAIM.SETTLE);
  const canApprove = useCan(PERMS.CLAIM.APPROVE);

  const [assessOpen, setAssessOpen] = React.useState(false);
  const [settleOpen, setSettleOpen] = React.useState(false);
  const [reasonAction, setReasonAction] = React.useState<ReasonAction | null>(null);

  const query = useQuery({
    queryKey: claimKeys.detail(claimId),
    queryFn: () => claimApi.get(claimId),
  });

  const onUpdated = (updated: ClaimDetail) => {
    queryClient.setQueryData(claimKeys.detail(claimId), updated);
    queryClient.invalidateQueries({ queryKey: claimKeys.all });
  };

  const approve = useMutation({
    mutationFn: (version: number) => claimApi.approveSettlement(claimId, version),
    onSuccess: (updated) => {
      toast.success("Settlement approved — claim settled");
      onUpdated(updated);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const withReason = useMutation({
    mutationFn: ({ action, reason, version }: { action: ReasonAction; reason: string; version: number }) => {
      const body = { version, reason };
      if (action === "reject") return claimApi.reject(claimId, body);
      if (action === "cancel") return claimApi.cancel(claimId, body);
      return claimApi.declineSettlement(claimId, body);
    },
    onSuccess: (updated, { action }) => {
      toast.success(REASON_DIALOG[action].done);
      setReasonAction(null);
      onUpdated(updated);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
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
  const pending = claim.pendingSettlement;
  const open = claim.status === "PENDING" || claim.status === "ACTIVE";
  const askedByMe = pending?.requestedBy?.id === user?.id;
  const closedReason =
    claim.status === "REJECTED"
      ? claim.rejectedReason
      : claim.status === "CANCELLED"
        ? claim.cancelReason
        : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

        <div className="flex flex-wrap gap-2">
          {claim.status === "PENDING" && canUpdate && (
            <Button onClick={() => setAssessOpen(true)}>Assess</Button>
          )}
          {claim.status === "ACTIVE" && !pending && canSettle && (
            <Button onClick={() => setSettleOpen(true)}>Settle</Button>
          )}
          {pending && canApprove && !askedByMe && (
            <Button disabled={approve.isPending} onClick={() => approve.mutate(claim.version)}>
              {approve.isPending ? "Approving…" : "Approve settlement"}
            </Button>
          )}
          {pending && canApprove && (
            <Button variant="outline" onClick={() => setReasonAction("decline")}>
              {askedByMe ? "Withdraw settlement" : "Decline"}
            </Button>
          )}
          {claim.status === "ACTIVE" && !pending && canUpdate && (
            <Button variant="outline" onClick={() => setAssessOpen(true)}>
              Edit assessment
            </Button>
          )}
          {open && !pending && canSettle && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setReasonAction("reject")}
            >
              Reject
            </Button>
          )}
          {open && !pending && canUpdate && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setReasonAction("cancel")}
            >
              Cancel claim
            </Button>
          )}
        </div>
      </div>

      {pending ? (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <span className="font-medium">
            Settlement of {formatPaise(pending.amountPaise)} ({SETTLEMENT_MODE_LABELS[pending.mode].toLowerCase()}) is
            waiting for approval.
          </span>{" "}
          Asked by {pending.requestedBy?.name ?? "—"}
          {pending.requestedAt ? ` on ${formatDateTime(pending.requestedAt)}` : ""}.
          {askedByMe ? " Another user with approval rights must approve it." : ""}
        </div>
      ) : null}

      {closedReason ? (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
          <span className="font-medium">
            {claim.status === "REJECTED" ? "Rejected: " : "Cancelled: "}
          </span>
          {closedReason}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Claimed"
          value={formatPaise(claim.claimedAmountPaise)}
          // A GRN records cartons, not rupees, so an unassessed GRN claim is
          // showing the system's pro-rata guess off the LR invoice — not a
          // figure the customer asked for. Saying so is the whole point:
          // the two read identically otherwise.
          hint={
            isEstimatedAmount(claim)
              ? "Estimated from the LR invoice — set the real amount when you assess"
              : undefined
          }
        />
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
            <Info label="Claimed by">{claim.customer.name}</Info>
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

          {claim.settlement ? (
            <SettlementSection settlement={claim.settlement} claim={claim} />
          ) : null}

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

          <RecoveriesSection claim={claim} />
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

      <AssessClaimDialog claim={claim} open={assessOpen} onOpenChange={setAssessOpen} />
      <SettleClaimDialog claim={claim} open={settleOpen} onOpenChange={setSettleOpen} />
      {reasonAction ? (
        <ReasonDialog
          open
          onOpenChange={(next) => !next && setReasonAction(null)}
          title={REASON_DIALOG[reasonAction].title}
          description={REASON_DIALOG[reasonAction].description}
          confirmLabel={REASON_DIALOG[reasonAction].confirmLabel}
          destructive={reasonAction !== "decline"}
          isPending={withReason.isPending}
          onConfirm={(reason) =>
            withReason.mutate({ action: reasonAction, reason, version: claim.version })
          }
        />
      ) : null}
    </div>
  );
}
