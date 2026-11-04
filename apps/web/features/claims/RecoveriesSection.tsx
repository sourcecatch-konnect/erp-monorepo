"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";
import { PERMS, type ClaimDetail } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import ReasonDialog from "@/components/feedback/ReasonDialog";
import { useCan } from "@/features/auth";
import { DetailSection } from "@/features/masters/_shared/DetailSection";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { AddRecoveryDialog, leftToRecoverPaise } from "./AddRecoveryDialog";
import { ReceiveRecoveryDialog } from "./ReceiveRecoveryDialog";
import { claimApi } from "./claim.service";
import { claimKeys } from "./claim.keys";
import { PAYMENT_MODE_LABELS, RECOVERY_SOURCE_LABELS, RecoveryStatusBadge } from "./claim.ui";

type Recovery = ClaimDetail["recoveries"][number];

/** Transporter / driver lines come back through their payments (C7 / C6), not by hand. */
const RECEIVED_ELSEWHERE = new Set<Recovery["source"]>(["TRANSPORTER", "DRIVER"]);

function StatusCell({ recovery }: { recovery: Recovery }) {
  return (
    <div className="space-y-1">
      <RecoveryStatusBadge status={recovery.status} />
      {recovery.status === "RECEIVED" && recovery.receivedAt ? (
        <p className="text-xs text-muted-foreground">
          {formatDate(recovery.receivedAt)}
          {recovery.receiptMode ? ` · ${PAYMENT_MODE_LABELS[recovery.receiptMode]}` : ""}
          {recovery.receivedIntoName ? ` · ${recovery.receivedIntoName}` : ""}
          {recovery.voucher ? ` · ${recovery.voucher.voucherNumber}` : ""}
        </p>
      ) : null}
      {recovery.status === "REJECTED" && recovery.rejectedReason ? (
        <p className="text-xs text-muted-foreground">{recovery.rejectedReason}</p>
      ) : null}
      {(recovery.status === "FILED" || recovery.status === "APPROVED") &&
      RECEIVED_ELSEWHERE.has(recovery.source) ? (
        <p className="text-xs text-muted-foreground">
          {recovery.source === "TRANSPORTER" ? "Deducted on their vendor slip" : "Deducted from salary"}
        </p>
      ) : null}
    </div>
  );
}

export function RecoveriesSection({ claim }: { claim: ClaimDetail }) {
  const queryClient = useQueryClient();
  const canRecover = useCan(PERMS.CLAIM.RECOVERY);
  const [addOpen, setAddOpen] = React.useState(false);
  const [receiving, setReceiving] = React.useState<Recovery | null>(null);
  const [rejecting, setRejecting] = React.useState<Recovery | null>(null);

  const recoverable = claim.status === "ACTIVE" || claim.status === "SETTLED";
  const leftPaise = leftToRecoverPaise(claim);

  const onUpdated = (updated: ClaimDetail) => {
    queryClient.setQueryData(claimKeys.detail(claim.id), updated);
    queryClient.invalidateQueries({ queryKey: claimKeys.all });
  };

  const approve = useMutation({
    mutationFn: (recovery: Recovery) => claimApi.approveRecovery(claim.id, recovery.id, claim.version),
    onSuccess: (updated) => {
      toast.success("Recovery approved");
      onUpdated(updated);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const reject = useMutation({
    mutationFn: ({ recovery, reason }: { recovery: Recovery; reason: string }) =>
      claimApi.rejectRecovery(claim.id, recovery.id, { version: claim.version, reason }),
    onSuccess: (updated) => {
      toast.success("Recovery rejected");
      setRejecting(null);
      onUpdated(updated);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const action =
    canRecover && recoverable && leftPaise > 0 ? (
      <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
        <IconPlus size={14} /> Add recovery
      </Button>
    ) : undefined;

  return (
    <DetailSection title="Recoveries" action={action}>
      {claim.recoveries.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No recovery recorded yet. Record what insurance, the transporter, the driver or others
          pay back — split across several lines if more than one party pays.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                {canRecover ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {claim.recoveries.map((recovery) => {
                const live = recovery.status === "FILED" || recovery.status === "APPROVED";
                return (
                  <TableRow key={recovery.id}>
                    <TableCell className="text-muted-foreground">R{recovery.lineNo}</TableCell>
                    <TableCell>{RECOVERY_SOURCE_LABELS[recovery.source]}</TableCell>
                    <TableCell>{recovery.partyName ?? "—"}</TableCell>
                    <TableCell>{recovery.referenceNo ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPaise(recovery.amountPaise)}
                    </TableCell>
                    <TableCell>
                      <StatusCell recovery={recovery} />
                    </TableCell>
                    {canRecover ? (
                      <TableCell className="text-right">
                        {live ? (
                          <div className="flex justify-end gap-1">
                            {recovery.status === "FILED" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={approve.isPending}
                                onClick={() => approve.mutate(recovery)}
                              >
                                Approve
                              </Button>
                            )}
                            {!RECEIVED_ELSEWHERE.has(recovery.source) && (
                              <Button size="sm" variant="ghost" onClick={() => setReceiving(recovery)}>
                                Received
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setRejecting(recovery)}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {claim.status === "SETTLED" && leftPaise > 0 ? (
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">
              {formatPaise(leftPaise)} of the {formatPaise(claim.settledAmountPaise)} settled is not
              being recovered from anyone — that stays as the net loss.
            </p>
          ) : null}
        </>
      )}

      <AddRecoveryDialog claim={claim} open={addOpen} onOpenChange={setAddOpen} />
      <ReceiveRecoveryDialog
        claim={claim}
        recovery={receiving}
        onOpenChange={(open) => !open && setReceiving(null)}
      />
      {rejecting ? (
        <ReasonDialog
          open
          onOpenChange={(open) => !open && setRejecting(null)}
          title={`Reject recovery R${rejecting.lineNo}`}
          description="The party won't pay this. Nothing was posted, so nothing is reversed."
          confirmLabel="Reject recovery"
          destructive
          isPending={reject.isPending}
          onConfirm={(reason) => reject.mutate({ recovery: rejecting, reason })}
        />
      ) : null}
    </DetailSection>
  );
}
