"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Textarea } from "@skerp/ui/components/textarea";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { useCan } from "@/features/auth";
import { formatPaise } from "@/lib/money";
import { DetailSection } from "@/features/masters/_shared/DetailSection";
import { purchaseOrderApi } from "./api/purchase-order.service";
import { purchaseOrderKeys } from "./api/purchase-order.keys";
import { PurchaseOrderStatusBadge } from "./purchaseOrderStatusBadge";



/** Purchase Order detail — a commitment-only document, so unlike Job Card
 *  there is never a linked ledger voucher here (only a Goods Inward posted
 *  against this PO moves stock/ledger, and that's a separate document). */
export function PurchaseOrderDetailPage({ purchaseOrderId }: { purchaseOrderId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.PO_MANAGE);
  const canApprove = useCan(PERMS.WORKSHOP.PO_APPROVE);

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const { data: po, isLoading } = useQuery({
    queryKey: purchaseOrderKeys.detail(purchaseOrderId),
    queryFn: () => purchaseOrderApi.get(purchaseOrderId),
  });

  const approveAndSend = useMutation({
    mutationFn: async (id: string) => {
      await purchaseOrderApi.approve(id);
      return purchaseOrderApi.send(id);
    },
    onSuccess: () => {
      toast.success("Approved and sent to supplier");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not approve/send"),
  });

  const send = useMutation({
    mutationFn: (id: string) => purchaseOrderApi.send(id),
    onSuccess: () => {
      toast.success("Marked as sent to supplier");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not send"),
  });

  const close = useMutation({
    mutationFn: (id: string) => purchaseOrderApi.close(id),
    onSuccess: () => {
      toast.success("Purchase order closed");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not close"),
  });

  const cancel = useMutation({
    mutationFn: () => purchaseOrderApi.cancel(purchaseOrderId, cancelReason.trim()),
    onSuccess: () => {
      toast.success("Purchase order cancelled");
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      setCancelOpen(false);
      setCancelReason("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not cancel"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-48" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!po) {
    return <p className="text-sm text-muted-foreground">Purchase order not found.</p>;
  }

  const canEdit = po.status === "DRAFT" && canManage;
  const canApproveSend = po.status === "DRAFT" && canApprove;
  const canSend = po.status === "APPROVED" && canManage;
  const canClose = ["SENT", "PARTIALLY_RECEIVED", "RECEIVED"].includes(po.status) && canManage;
  const canCancel = !["RECEIVED", "CLOSED", "CANCELLED"].includes(po.status) && canManage;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Purchase Order</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{po.poNumber ?? "Purchase Order"}</h1>
            <PurchaseOrderStatusBadge status={po.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Commitment to buy from a supplier — placing or approving this never moves stock;
            only an Inward posted against it does.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => router.push(`/workshop/purchase-orders?edit=${po.id}`)}
            >
              Edit
            </Button>
          )}
          {canApproveSend && (
            <Button disabled={approveAndSend.isPending} onClick={() => approveAndSend.mutate(po.id)}>
              {approveAndSend.isPending ? "Approving..." : "Approve & Send"}
            </Button>
          )}
          {canSend && (
            <Button disabled={send.isPending} onClick={() => send.mutate(po.id)}>
              {send.isPending ? "Sending..." : "Send"}
            </Button>
          )}
          {canClose && (
            <Button variant="outline" disabled={close.isPending} onClick={() => close.mutate(po.id)}>
              {close.isPending ? "Closing..." : "Close"}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      <DetailSection title="Order Details" contentClassName="grid gap-4 p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Branch</p>
          <p className="text-sm">
            {po.branch.name} <span className="text-xs text-muted-foreground">(single workshop — fixed)</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Supplier</p>
          <p className="text-sm">
            {po.supplier.shopName ? `${po.supplier.name} (${po.supplier.shopName})` : po.supplier.name}
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">PO date</p>
          <p className="text-sm">{new Date(po.poDate).toLocaleDateString("en-IN")}</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Expected date</p>
          <p className="text-sm text-muted-foreground">
            {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString("en-IN") : "—"}
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Created by</p>
          <p className="text-sm text-muted-foreground">
            {po.createdBy ? `${po.createdBy.firstName} ${po.createdBy.lastName}` : "—"}
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Approved by</p>
          <p className="text-sm text-muted-foreground">
            {po.approvedBy ? `${po.approvedBy.firstName} ${po.approvedBy.lastName}` : "—"}
          </p>
        </div>
        {po.remarks && (
          <div className="space-y-1.5 sm:col-span-3">
            <p className="text-xs font-medium text-muted-foreground">Remarks</p>
            <p className="text-sm text-muted-foreground">{po.remarks}</p>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Lines">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">SN</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead className="text-right">Qty Ordered</TableHead>
                <TableHead className="text-right">Qty Received</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.lines.map((line, i) => (
                <TableRow key={line.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{line.sparePart.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.qtyOrdered}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.qtyReceived}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPaise(line.ratePaise)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPaise(line.amountPaise)}</TableCell>
                </TableRow>
              ))}
              {po.lines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No lines on this purchase order.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end border-t bg-muted/20 px-3 py-2.5 text-sm">
          Estimated total{" "}
          <span className="ml-1 font-semibold tabular-nums">{formatPaise(po.estimatedPaise)}</span>
        </div>
      </DetailSection>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {po.poNumber}?</DialogTitle>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "Cancelling..." : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
