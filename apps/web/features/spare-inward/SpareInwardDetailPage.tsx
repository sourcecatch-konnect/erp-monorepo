"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconArrowLeft, IconFileInvoice, IconShoppingCart } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { useCan } from "@/features/auth";
import { formatPaise } from "@/lib/money";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { spareInwardApi, type SpareInwardStatus } from "./api/spare-inward.service";
import { spareInwardKeys } from "./api/spare-inward.keys";

const STATUS_STYLE: Record<SpareInwardStatus, string> = {
  DRAFT: "border-muted-foreground/30 bg-muted text-muted-foreground",
  POSTED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CANCELLED: "border-destructive/20 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: SpareInwardStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

export function SpareInwardDetailPage({ inwardId }: { inwardId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.INWARD_MANAGE);

  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const inward = useQuery({
    queryKey: spareInwardKeys.detail(inwardId),
    queryFn: () => spareInwardApi.get(inwardId),
  });

  const voucher = useQuery({
    queryKey: ["ledger", "voucher", inward.data?.journalEntry?.id],
    queryFn: () => ledgerApi.voucher(inward.data!.journalEntry!.id),
    enabled: voucherOpen && Boolean(inward.data?.journalEntry),
  });

  const cancel = useMutation({
    mutationFn: () => spareInwardApi.cancel(inwardId, cancelReason.trim()),
    onSuccess: () => {
      toast.success("Inward cancelled");
      queryClient.invalidateQueries({ queryKey: spareInwardKeys.all });
      queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
      setCancelOpen(false);
      setCancelReason("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not cancel"),
  });

  if (inward.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const iw = inward.data;
  if (!iw) {
    return <p className="text-sm text-muted-foreground">Inward not found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/workshop/inward")}>
              <IconArrowLeft size={15} className="mr-1" /> Back
            </Button>
          </div>
          <h1 className="text-lg font-semibold">{iw.inwardNumber ?? "Inward"}</h1>
          <p className="text-sm text-muted-foreground">
            Status: <StatusBadge status={iw.status} />
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/workshop/purchase-orders/${iw.poId}`)}>
            <IconShoppingCart size={15} className="mr-1" /> {iw.po.poNumber ?? "View PO"}
          </Button>
          {iw.journalEntry && (
            <Button variant="outline" onClick={() => setVoucherOpen(true)}>
              <IconFileInvoice size={15} className="mr-1" /> Voucher
            </Button>
          )}
          {iw.status === "POSTED" && canManage && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              Cancel inward
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Branch</p>
          <p className="text-sm">{iw.branch.name} (single workshop — fixed)</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Supplier</p>
          <p className="text-sm">{iw.supplier.name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Purchase order</p>
          <p className="text-sm">{iw.po.poNumber ?? "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Inward date</p>
          <p className="text-sm">{new Date(iw.inwardDate).toLocaleDateString("en-IN")}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Supplier invoice no.</p>
          <p className="text-sm">{iw.supplierInvoiceNo}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Supplier invoice date</p>
          <p className="text-sm">
            {iw.supplierInvoiceDate ? new Date(iw.supplierInvoiceDate).toLocaleDateString("en-IN") : "—"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Created by</p>
          <p className="text-sm">
            {iw.createdBy ? `${iw.createdBy.firstName} ${iw.createdBy.lastName}` : "—"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Created at</p>
          <p className="text-sm">{new Date(iw.createdAt).toLocaleString("en-IN")}</p>
        </div>
        {iw.remarks && (
          <div className="space-y-1 sm:col-span-3">
            <p className="text-sm font-medium text-muted-foreground">Remarks</p>
            <p className="text-sm">{iw.remarks}</p>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">Lines</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">SN</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Batch No</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Rejected</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Warranty expiry</TableHead>
              <TableHead>Guarantee expiry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {iw.lines.map((line, i) => (
              <TableRow key={line.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{line.sparePart.name}</TableCell>
                <TableCell>{line.batchNo ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{line.qtyReceived}</TableCell>
                <TableCell className="text-right tabular-nums">{line.qtyRejected}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaise(line.ratePaise)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaise(line.amountPaise)}</TableCell>
                <TableCell>
                  {line.warrantyExpiry ? new Date(line.warrantyExpiry).toLocaleDateString("en-IN") : "—"}
                </TableCell>
                <TableCell>
                  {line.guaranteeExpiry ? new Date(line.guaranteeExpiry).toLocaleDateString("en-IN") : "—"}
                </TableCell>
              </TableRow>
            ))}
            {iw.lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                  No lines on this inward.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-end gap-6 border-t bg-muted/20 px-3 py-2.5 text-sm">
          <span>
            Gross <span className="font-semibold tabular-nums">{formatPaise(iw.grossAmountPaise)}</span>
          </span>
          <span>
            Discount <span className="font-semibold tabular-nums">{formatPaise(iw.discountPaise)}</span>
          </span>
          <span>
            Payable <span className="font-semibold tabular-nums">{formatPaise(iw.payableAmountPaise)}</span>
          </span>
        </div>
      </div>

      {iw.journalEntry && (
        <VoucherDialog
          open={voucherOpen}
          onOpenChange={setVoucherOpen}
          voucher={voucher.data}
          isLoading={voucher.isLoading}
          isError={voucher.isError}
          errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
        />
      )}

      <Dialog open={cancelOpen} onOpenChange={(open) => { setCancelOpen(open); if (!open) setCancelReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {iw.inwardNumber}?</DialogTitle>
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
