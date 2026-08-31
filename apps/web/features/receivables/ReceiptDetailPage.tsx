"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconUser,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@skerp/ui/components/Card";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { useCan } from "@/features/auth";
import { receiptApi } from "./receipt.service";
import {
  PAYMENT_MODE_LABELS,
  PageHeader,
  RECEIPT_STATUS_LABELS,
  ReceiptStatusBadge,
  formatDate,
  money,
} from "./receipt.ui";

export function ReceiptDetailPage({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canApprove = useCan(PERMS.RECEIPT.APPROVE);
  const canCancel = useCan(PERMS.RECEIPT.CANCEL);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const receipt = useQuery({
    queryKey: ["receivables", "receipt", receiptId],
    queryFn: () => receiptApi.receipt(receiptId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["receivables", "receipt", receiptId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["receivables", "receipts"],
    });
  };

  const approve = useMutation({
    mutationFn: () => receiptApi.approve(receiptId),
    onSuccess: () => {
      invalidate();
      const accountName = receipt.data?.receivedIntoAccount?.name;
      toast.success(
        accountName
          ? `Receipt approved and posted — ${money(
            receipt.data!.amountPaise,
          )} credited to ${accountName}`
          : "Receipt approved and posted",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not approve the receipt",
      ),
  });

  const cancel = useMutation({
    mutationFn: () => receiptApi.cancel(receiptId, cancelReason.trim()),
    onSuccess: () => {
      invalidate();
      setCancelOpen(false);
      setCancelReason("");
      toast.success("Receipt cancelled");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not cancel the receipt",
      ),
  });

  const data = receipt.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data?.receiptNumber ?? "Draft receipt"}
        description="Review what was received, which bills it settled, and its approval history."
        actions={
          <Button
            variant="outline"
            onClick={() => router.push("/accounts/receipts")}
          >
            Back to register
          </Button>
        }
      />

      {receipt.isLoading ? <Skeleton className="h-96" /> : null}
      {receipt.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {receipt.error instanceof Error
              ? receipt.error.message
              : "Could not load this receipt"}
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
                <CardTitle>Allocations</CardTitle>
                <ReceiptStatusBadge status={data.status} />
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {data.allocations.map((allocation) => (
                    <button
                      type="button"
                      key={allocation.id}
                      onClick={() => router.push(`/accounts/bills/${allocation.bill.id}`)}
                      className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {allocation.bill.billNumber ?? "Draft"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(allocation.bill.billDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Bill outstanding</p>
                          <p className="font-medium tabular-nums">
                            {money(allocation.bill.outstandingAmountPaise)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Received
                          </p>
                          <p className="text-sm font-medium tabular-nums">
                            {money(allocation.amountAppliedPaise)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            TDS{allocation.tdsSection ? ` (${allocation.tdsSection})` : ""}
                          </p>
                          <p className="text-sm font-medium tabular-nums">
                            {money(allocation.tdsAmountPaise)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Damage
                          </p>
                          <p className="text-sm font-medium tabular-nums">
                            {money(allocation.damageAmountPaise)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Rate diff
                          </p>
                          <p className="text-sm font-medium tabular-nums">
                            {money(allocation.rateDiffAmountPaise)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <CardTitle>Status history</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {data.statusHistory.map((entry, index) => (
                    <li key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <span className="size-1.5 rounded-full bg-current" />
                        </span>
                        {index < data.statusHistory.length - 1 ? (
                          <span className="mt-1 w-px flex-1 bg-border" />
                        ) : null}
                      </div>
                      <div className="pb-2">
                        <p className="text-sm font-medium">
                          {entry.fromStatus
                            ? `${RECEIPT_STATUS_LABELS[entry.fromStatus]} → ${RECEIPT_STATUS_LABELS[entry.toStatus]}`
                            : RECEIPT_STATUS_LABELS[entry.toStatus]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.changedAt).toLocaleString("en-IN")}
                        </p>
                        {entry.reason ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {entry.reason}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <CardTitle>Receipt summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-base font-semibold">
                    {money(data.amountPaise)}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <IconBuilding size={15} className="mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="font-medium">{data.customer.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <IconBuilding size={15} className="mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Branch</p>
                    <p className="font-medium">{data.branch.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <IconWallet size={15} className="mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Payment mode</p>
                    <p className="font-medium">
                      {PAYMENT_MODE_LABELS[data.paymentMode]}
                      {data.referenceNumber ? ` · ${data.referenceNumber}` : ""}
                    </p>
                  </div>
                </div>
                {data.receivedIntoAccount ? (
                  <div className="flex items-start gap-2">
                    <IconWallet size={15} className="mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Credited into</p>
                      <p className="font-medium">{data.receivedIntoAccount.name}</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-start gap-2">
                  <IconCalendar size={15} className="mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Received on</p>
                    <p className="font-medium">{formatDate(data.receivedAt)}</p>
                  </div>
                </div>
                {data.createdBy ? (
                  <div className="flex items-start gap-2">
                    <IconUser size={15} className="mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Recorded by</p>
                      <p className="font-medium">
                        {data.createdBy.firstName} {data.createdBy.lastName}
                      </p>
                    </div>
                  </div>
                ) : null}
                {data.remarks ? (
                  <div>
                    <p className="text-xs text-muted-foreground">Remark</p>
                    <p className="mt-1">{data.remarks}</p>
                  </div>
                ) : null}
                {data.status === "CANCELLED" && data.cancellationReason ? (
                  <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400">
                    {data.cancellationReason}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {data.status === "PENDING_APPROVAL" || data.status === "POSTED" ? (
              <Card>
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.status === "PENDING_APPROVAL" && canApprove ? (
                    <Button
                      className="w-full"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate()}
                    >
                      <IconCheck size={16} />
                      {approve.isPending ? "Approving..." : "Approve and post"}
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => setCancelOpen(true)}
                    >
                      <IconX size={16} />
                      Cancel receipt
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this receipt?</DialogTitle>
            <DialogDescription>
              {data?.status === "POSTED"
                ? "The settled bills will have their outstanding amounts restored. This action is recorded in the receipt history."
                : "This action is recorded in the receipt history."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor={`receipt-cancel-reason-${receiptId}`}
              className="text-sm font-medium"
            >
              Cancellation reason
            </label>
            <Textarea
              id={`receipt-cancel-reason-${receiptId}`}
              value={cancelReason}
              maxLength={500}
              placeholder="For example: Wrong client selected"
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancel.isPending}
            >
              Keep receipt
            </Button>
            <Button
              onClick={() => cancel.mutate()}
              disabled={cancelReason.trim().length < 3 || cancel.isPending}
            >
              {cancel.isPending ? "Cancelling..." : "Confirm cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
