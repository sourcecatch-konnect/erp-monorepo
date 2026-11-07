"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconGavel, IconRotateClockwise } from "@tabler/icons-react";

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
import {
  challanAckApi,
  challanAckKeys,
  type DeliveryChallanAckType,
} from "./ack.service";

/**
 * The DC acknowledgement + approval surface on a delivery challan.
 *
 * Shows both accounts side by side and, for someone holding the approve
 * permission, lets them accept one. Approving records figures only — it
 * posts nothing to the ledger (decision Q9); the money is accrued later and
 * once, by the vendor-payment slip.
 */
export function ChallanAckPanel({ challanId }: { challanId: string }) {
  const queryClient = useQueryClient();
  const canApprove = useCan(PERMS.DELIVERY_CHALLAN.APPROVE);

  const view = useQuery({
    queryKey: challanAckKeys.view(challanId),
    queryFn: () => challanAckApi.view(challanId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: challanAckKeys.view(challanId) });

  const approve = useMutation({
    mutationFn: (acceptedAckType: DeliveryChallanAckType) =>
      challanAckApi.approve(challanId, { acceptedAckType }),
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

  const { supervisor, broker, mismatches, bothFiled, approval } = view.data;
  const anyFiled = Boolean(supervisor || broker);

  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle>Acknowledgement &amp; approval</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {approval ? (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <IconGavel size={16} className="shrink-0 text-primary" />
              Approved — {approval.acceptedAckType === "SUPERVISOR"
                ? "supervisor's"
                : "broker's"}{" "}
              account accepted
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

        <ChallanAckComparison
          supervisor={supervisor}
          broker={broker}
          mismatches={mismatches}
          bothFiled={bothFiled}
        />

        {!approval && canApprove && anyFiled ? (
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-medium">Accept one account</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The accepted account&apos;s dates become the basis for the
              detention calculation. This records figures only — it posts
              nothing.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!supervisor || approve.isPending}
                onClick={() => approve.mutate("SUPERVISOR")}
              >
                Accept supervisor&apos;s
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!broker || approve.isPending}
                onClick={() => approve.mutate("BROKER")}
              >
                Accept broker&apos;s
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
