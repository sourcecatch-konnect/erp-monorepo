"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconArrowLeft, IconFileInvoice, IconTruckDelivery } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
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
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { DetailSection } from "@/features/masters/_shared/DetailSection";
import {
  supplierReplacementApi,
  type ReplacementInward,
  type ReplacementType,
} from "./api/supplier-replacement.service";
import { supplierReplacementKeys } from "./api/supplier-replacement.keys";
import { ReplacementListStatusBadge } from "./supplierReplaceStatusBadge";

const today = () => new Date().toISOString().slice(0, 10);



type ReceiveLineDraft = {
  replacementListLineId: string;
  sparePartName: string;
  remaining: number;
  replacementType: ReplacementType;
  qtyReceived: string;
  differentialRate: string;
  batchNo: string;
};

type CreditNoteLineDraft = {
  replacementListLineId: string;
  sparePartName: string;
  qtyRequested: number;
  amount: string;
};

/** Detail page for one ReplacementList — the outward request — with its
 *  full ReplacementInward receiving history nested inline underneath, the
 *  same way the list page used to show it, just without the dialog. */
export function SupplierReplacementDetailPage({ replacementListId }: { replacementListId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.REPLACEMENT_MANAGE);

  const list = useQuery({
    queryKey: supplierReplacementKeys.detail(replacementListId),
    queryFn: () => supplierReplacementApi.get(replacementListId),
  });

  const [inwardsPage, setInwardsPage] = React.useState(0);
  const [inwardsSize, setInwardsSize] = React.useState(10);
  const handleInwardsSizeChange = (nextSize: number) => {
    setInwardsSize(nextSize);
    setInwardsPage(0);
  };

  const inwards = useQuery({
    queryKey: supplierReplacementKeys.inwards(replacementListId, { page: inwardsPage, size: inwardsSize }),
    queryFn: () =>
      supplierReplacementApi.listReplacementInwards(replacementListId, {
        page: inwardsPage,
        size: inwardsSize,
      }),
  });

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [inwardDate, setInwardDate] = React.useState(today());
  const [challanNo, setChallanNo] = React.useState("");
  const [receiveLines, setReceiveLines] = React.useState<ReceiveLineDraft[]>([]);

  const [creditNoteOpen, setCreditNoteOpen] = React.useState(false);
  const [creditNoteDate, setCreditNoteDate] = React.useState(today());
  const [creditNoteLines, setCreditNoteLines] = React.useState<CreditNoteLineDraft[]>([]);

  const [voucherFor, setVoucherFor] = React.useState<ReplacementInward | null>(null);
  const voucher = useQuery({
    queryKey: ["ledger", "voucher", voucherFor?.journalEntry?.id],
    queryFn: () => ledgerApi.voucher(voucherFor!.journalEntry!.id),
    enabled: Boolean(voucherFor?.journalEntry),
  });

  const cancelList = useMutation({
    mutationFn: () => supplierReplacementApi.cancelReplacementList(replacementListId, cancelReason.trim()),
    onSuccess: () => {
      toast.success("Replacement request cancelled");
      queryClient.invalidateQueries({ queryKey: supplierReplacementKeys.all });
      setCancelOpen(false);
      setCancelReason("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not cancel"),
  });

  const openReceive = () => {
    if (!list.data) return;
    setInwardDate(today());
    setChallanNo("");
    setReceiveLines(
      list.data.lines
        // CREDIT_NOTE lines never get a physical batch back — they're
        // settled through the separate Credit Note dialog below, not here.
        .filter((l) => l.qtyRequested > l.qtyReceived && l.replacementType !== "CREDIT_NOTE")
        .map((l) => ({
          replacementListLineId: l.id,
          sparePartName: l.sparePart.name,
          remaining: l.qtyRequested - l.qtyReceived,
          replacementType: l.replacementType,
          qtyReceived: String(l.qtyRequested - l.qtyReceived),
          differentialRate: "",
          batchNo: "",
        })),
    );
    setReceiveOpen(true);
  };

  const updateReceiveLine = (id: string, patch: Partial<ReceiveLineDraft>) =>
    setReceiveLines((prev) => prev.map((l) => (l.replacementListLineId === id ? { ...l, ...patch } : l)));

  const selectedReceiveLines = receiveLines.filter((l) => Number(l.qtyReceived) > 0);
  const canReceive =
    Boolean(inwardDate) && selectedReceiveLines.length > 0 &&
    selectedReceiveLines.every((l) => Number(l.qtyReceived) <= l.remaining);

  const createInward = useMutation({
    mutationFn: () =>
      supplierReplacementApi.createReplacementInward({
        replacementListId,
        inwardDate,
        supplierChallanNo: challanNo.trim() || undefined,
        lines: selectedReceiveLines.map((l) => ({
          replacementListLineId: l.replacementListLineId,
          qtyReceived: Number(l.qtyReceived),
          differentialRatePaise:
            l.replacementType === "PAYABLE" ? rupeesToPaise(Number(l.differentialRate) || 0) : 0,
          batchNo: l.batchNo.trim() || undefined,
        })),
      }),
    onSuccess: (inward) => {
      toast.success(`Replacement received — ${inward.replacementInwardNumber}`);
      queryClient.invalidateQueries({ queryKey: supplierReplacementKeys.all });
      setReceiveOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not receive"),
  });

  const openCreditNote = () => {
    if (!list.data) return;
    setCreditNoteDate(today());
    setCreditNoteLines(
      list.data.lines
        .filter((l) => l.replacementType === "CREDIT_NOTE" && l.qtyRequested > l.qtyReceived)
        .map((l) => ({
          replacementListLineId: l.id,
          sparePartName: l.sparePart.name,
          qtyRequested: l.qtyRequested,
          amount: "",
        })),
    );
    setCreditNoteOpen(true);
  };

  const updateCreditNoteLine = (id: string, patch: Partial<CreditNoteLineDraft>) =>
    setCreditNoteLines((prev) => prev.map((l) => (l.replacementListLineId === id ? { ...l, ...patch } : l)));

  const selectedCreditNoteLines = creditNoteLines.filter((l) => Number(l.amount) > 0);
  const canSubmitCreditNote = Boolean(creditNoteDate) && selectedCreditNoteLines.length > 0;

  const createCreditNote = useMutation({
    mutationFn: () =>
      supplierReplacementApi.createReplacementCreditNote(replacementListId, {
        creditNoteDate,
        lines: selectedCreditNoteLines.map((l) => ({
          replacementListLineId: l.replacementListLineId,
          amountPaise: rupeesToPaise(Number(l.amount) || 0),
        })),
      }),
    onSuccess: () => {
      toast.success("Credit note recorded");
      queryClient.invalidateQueries({ queryKey: supplierReplacementKeys.all });
      setCreditNoteOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not record credit note"),
  });

  if (list.isLoading) {
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

  if (!list.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push("/workshop/supplier-replacement")}>
          <IconArrowLeft size={15} className="mr-1" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Replacement request not found.</p>
      </div>
    );
  }

  const rl = list.data;
  const canCancel = rl.status === "PENDING" && canManage;
  const canReceiveNow = ["PENDING", "PARTIALLY_RECEIVED"].includes(rl.status) && canManage;
  const hasPendingCreditNoteLines = rl.lines.some(
    (l) => l.replacementType === "CREDIT_NOTE" && l.qtyRequested > l.qtyReceived,
  );
  const canRecordCreditNote = canReceiveNow && hasPendingCreditNoteLines;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/workshop/supplier-replacement")}
          >
            <IconArrowLeft size={15} className="mr-1" /> Back to list
          </Button>
          <p className="text-xs font-medium text-muted-foreground">Supplier Replacement</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {rl.replacementNumber ?? "Replacement Request"}
            </h1>
            <ReplacementListStatusBadge status={rl.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Requested {new Date(rl.requestDate).toLocaleDateString("en-IN")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReceiveNow && (
            <Button onClick={openReceive}>
              <IconTruckDelivery size={15} className="mr-1" /> Receive
            </Button>
          )}
          {canRecordCreditNote && (
            <Button variant="outline" onClick={openCreditNote}>
              <IconFileInvoice size={15} className="mr-1" /> Record Credit Note
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              Cancel request
            </Button>
          )}
        </div>
      </div>

      <DetailSection title="Request Details" contentClassName="grid gap-4 p-4 sm:grid-cols-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Supplier</p>
          <p className="text-sm">{rl.supplier.name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Original inward</p>
          <p className="text-sm">{rl.originalInward.inwardNumber ?? "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Branch</p>
          <p className="text-sm">{rl.branch.name} <span className="text-xs text-muted-foreground">(HO — fixed)</span></p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Request date</p>
          <p className="text-sm">{new Date(rl.requestDate).toLocaleDateString("en-IN")}</p>
        </div>
        {rl.remarks && (
          <div className="space-y-1 sm:col-span-4">
            <p className="text-xs font-medium text-muted-foreground">Remarks</p>
            <p className="text-sm text-muted-foreground">{rl.remarks}</p>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Lines sent to supplier">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Original batch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rl.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.sparePart.name}</TableCell>
                  <TableCell>{line.originalBatch.batchNo ?? line.originalBatch.id.slice(0, 6)}</TableCell>
                  <TableCell>{line.replacementType}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.qtyRequested}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.qtyReceived}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.qtyRequested - line.qtyReceived}</TableCell>
                </TableRow>
              ))}
              {rl.lines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No lines.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DetailSection>

      <DetailSection title="Receiving history">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inward #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Challan #</TableHead>
                <TableHead className="text-right">Differential</TableHead>
                <TableHead className="text-right">Voucher</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inwards.isLoading &&
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!inwards.isLoading && (inwards.data?.data.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Nothing received yet — receipts against this request will show up here.
                  </TableCell>
                </TableRow>
              )}
              {inwards.data?.data.map((inward) => (
                <TableRow key={inward.id}>
                  <TableCell className="font-medium">{inward.replacementInwardNumber ?? "—"}</TableCell>
                  <TableCell>{new Date(inward.inwardDate).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>{inward.supplierChallanNo ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(inward.differentialAmountPaise)}
                  </TableCell>
                  <TableCell className="text-right">
                    {inward.journalEntry ? (
                      <Button size="sm" variant="outline" onClick={() => setVoucherFor(inward)}>
                        <IconFileInvoice size={15} className="mr-1" /> Voucher
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePaginationFooter
          total={inwards.data?.meta?.total ?? 0}
          page={inwardsPage}
          size={inwardsSize}
          onPageChange={setInwardsPage}
          onSizeChange={handleInwardsSizeChange}
        />
      </DetailSection>

      <VoucherDialog
        open={Boolean(voucherFor)}
        onOpenChange={(open) => !open && setVoucherFor(null)}
        voucher={voucher.data}
        isLoading={voucher.isLoading}
        isError={voucher.isError}
        errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
      />

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="w-[95vh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Receive — {rl.replacementNumber}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Inward date</label>
              <Input type="date" value={inwardDate} onChange={(e) => setInwardDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Supplier challan no. <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input value={challanNo} onChange={(e) => setChallanNo(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border">
            <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">Lines</div>
            <div className="divide-y">
              {receiveLines.map((line) => (
                <div key={line.replacementListLineId} className="grid gap-2 p-3 sm:grid-cols-4 sm:items-center">
                  <div>
                    <div className="text-sm font-medium">{line.sparePartName}</div>
                    <div className="text-xs text-muted-foreground">
                      Pending: {line.remaining} · {line.replacementType}
                    </div>
                  </div>
                  <Input
                    inputMode="numeric"
                    placeholder="Qty received"
                    value={line.qtyReceived}
                    onChange={(e) => updateReceiveLine(line.replacementListLineId, { qtyReceived: e.target.value })}
                  />
                  {line.replacementType === "PAYABLE" ? (
                    <Input
                      inputMode="decimal"
                      placeholder="Differential (₹/unit)"
                      value={line.differentialRate}
                      onChange={(e) => updateReceiveLine(line.replacementListLineId, { differentialRate: e.target.value })}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">Free — no charge</span>
                  )}
                  <Input
                    placeholder="Batch no."
                    value={line.batchNo}
                    onChange={(e) => updateReceiveLine(line.replacementListLineId, { batchNo: e.target.value })}
                  />
                </div>
              ))}
              {receiveLines.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nothing pending to receive.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>
              Back
            </Button>
            <Button disabled={!canReceive || createInward.isPending} onClick={() => createInward.mutate()}>
              {createInward.isPending ? "Receiving..." : "Confirm receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creditNoteOpen} onOpenChange={setCreditNoteOpen}>
        <DialogContent className="w-[95vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Credit Note — {rl.replacementNumber}</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            The supplier can&apos;t physically replace these — enter what they&apos;re crediting
            instead. This reduces what we owe the supplier and posts a voucher; no stock moves.
          </p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Credit note date</label>
            <Input type="date" value={creditNoteDate} onChange={(e) => setCreditNoteDate(e.target.value)} />
          </div>

          <div className="rounded-md border">
            <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">Lines</div>
            <div className="divide-y">
              {creditNoteLines.map((line) => (
                <div key={line.replacementListLineId} className="grid gap-2 p-3 sm:grid-cols-2 sm:items-center">
                  <div>
                    <div className="text-sm font-medium">{line.sparePartName}</div>
                    <div className="text-xs text-muted-foreground">Requested: {line.qtyRequested}</div>
                  </div>
                  <Input
                    inputMode="decimal"
                    placeholder="Credit amount (₹)"
                    value={line.amount}
                    onChange={(e) => updateCreditNoteLine(line.replacementListLineId, { amount: e.target.value })}
                  />
                </div>
              ))}
              {creditNoteLines.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nothing pending to settle.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditNoteOpen(false)}>
              Back
            </Button>
            <Button disabled={!canSubmitCreditNote || createCreditNote.isPending} onClick={() => createCreditNote.mutate()}>
              {createCreditNote.isPending ? "Recording..." : "Record credit note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {rl.replacementNumber}?</DialogTitle>
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
              disabled={!cancelReason.trim() || cancelList.isPending}
              onClick={() => cancelList.mutate()}
            >
              {cancelList.isPending ? "Cancelling..." : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
