"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconGavel, IconPencil, IconRotateClockwise } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@skerp/ui/components/Card";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { useCan } from "@/features/auth";
import { PERMS } from "@skerp/types";

import { ChallanAckComparison } from "./ChallanAckComparison";
import { ChallanAckForm } from "./ChallanAckForm";
import {
  challanAckApi,
  challanAckKeys,
} from "./ack.service";

/**
 * The DC acknowledgement + approval surface on a delivery challan.
 *
 * Shows the broker's claim and, for someone holding the approve permission,
 * lets them rule on it. Approving records figures only — it posts nothing to
 * the ledger (decision Q9); the money is accrued later and once, by the
 * vendor-payment slip.
 */
export function ChallanAckPanel({ challanId }: { challanId: string }) {
  const queryClient = useQueryClient();
  const canApprove = useCan(PERMS.DELIVERY_CHALLAN.APPROVE);
  const canFileAck = useCan(PERMS.DELIVERY_CHALLAN.ACK_BROKER);
  const [formOpen, setFormOpen] = React.useState(false);

  const view = useQuery({
    queryKey: challanAckKeys.view(challanId),
    queryFn: () => challanAckApi.view(challanId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: challanAckKeys.view(challanId) });

  const approve = useMutation({
    mutationFn: () => challanAckApi.approve(challanId, {}),
    onSuccess: () => {
      toast.success("Challan approved");
      void invalidate();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not approve the challan",
      ),
  });

  const revoke = useMutation({
    mutationFn: (version: number) =>
      challanAckApi.revokeApproval(challanId, {
        reason: "Approval revoked for correction",
        version,
      }),
    onSuccess: () => {
      toast.success("Approval revoked");
      void invalidate();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not revoke the approval",
      ),
  });

  if (view.isPending)
    return (
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Acknowledgement &amp; approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </CardContent>
      </Card>
    );

  if (view.isError || !view.data)
    return (
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Acknowledgement &amp; approval</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Could not load the acknowledgements for this challan.
          </p>
        </CardContent>
      </Card>
    );

  const { supervisor, broker, approval } = view.data;

  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Acknowledgement &amp; approval</CardTitle>
          {/* Amending is blocked server-side once an approval exists — the
              approver ruled on the text as it was — so the button goes with
              it rather than failing on save. */}
          {canFileAck && !approval ? (
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
              <IconPencil size={14} />
              {broker ? "Amend claim" : "Enter broker's claim"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {approval ? (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <IconGavel size={16} className="shrink-0 text-primary" />
              Approved — the broker’s claim has been ruled on
            </p>
            <p className="mt-1 pl-6 text-xs text-muted-foreground">
              {approval.approvedBy
                ? `${approval.approvedBy.firstName} ${approval.approvedBy.lastName}`
                : "—"}{" "}
              ·{" "}
              {new Date(approval.approvedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
            <p className="mt-1 pl-6 text-xs text-muted-foreground">
              Detention is now calculated from these approved dates. Nothing
              has been posted to the ledger — the broker is paid through a
              payment slip.
            </p>
            {canApprove ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(approval.version)}
              >
                <IconRotateClockwise size={14} />
                Revoke approval
              </Button>
            ) : null}
          </div>
        ) : null}

        <ChallanAckComparison broker={broker} supervisor={supervisor} />

        {!approval && canApprove && broker ? (
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-medium">Approve this claim</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The approved dates become the basis for the detention
              calculation, and the broker is paid the lower of his claim and
              his slab. This records figures only — it posts nothing.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={approve.isPending}
                onClick={() => approve.mutate()}
              >
                Approve
              </Button>
            </div>
          </div>
        ) : null}

        {canFileAck ? (
          <ChallanAckForm
            challanId={challanId}
            view={view.data}
            open={formOpen}
            onOpenChange={setFormOpen}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
