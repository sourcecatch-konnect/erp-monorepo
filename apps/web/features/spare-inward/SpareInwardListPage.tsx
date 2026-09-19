"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus, IconFileInvoice, IconEye } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { SpareInwardStatusBadge } from "./spareInwardStatusBadge";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { Combobox } from "@skerp/ui/components/combobox";
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
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { formatPaise, rupeesToPaise, paiseToRupees } from "@/lib/money";
import { purchaseOrderApi } from "@/features/purchase-order/api/purchase-order.service";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import { spareInwardApi, type SpareInward } from "./api/spare-inward.service";
import { spareInwardKeys } from "./api/spare-inward.keys";

type LineDraft = {
  poLineId: string;
  sparePartId: string;
  sparePartName: string;
  unit: string;
  remaining: number;
  qtyReceived: string;
  qtyRejected: string;
  rate: string;
  batchNo: string;
  warrantyExpiry: string;
  guaranteeExpiry: string;
};

const today = () => new Date().toISOString().slice(0, 10);



/** Inward Stock — receives goods against an approved/sent Purchase Order.
 *  Single-step submit (matches old ERP: "On Submit, Inventory stock
 *  increases") — partial receipt is normal, just post another Inward
 *  against the same PO for the rest. */
export function SpareInwardListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.INWARD_MANAGE);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState("");
  const [supplierSearch, setSupplierSearch] = React.useState("");
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch, 300);
  const [poId, setPoId] = React.useState("");
  const [inwardDate, setInwardDate] = React.useState(today());
  const [supplierInvoiceNo, setSupplierInvoiceNo] = React.useState("");
  const [discount, setDiscount] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [lines, setLines] = React.useState<LineDraft[]>([]);

  const [cancelTarget, setCancelTarget] = React.useState<SpareInward | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");

  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const [voucherId, setVoucherId] = React.useState<string | null>(null);

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);

  const listQuery = React.useMemo(() => ({ page, size }), [page, size]);

  const list = useQuery({
    queryKey: spareInwardKeys.list(listQuery),
    queryFn: () => spareInwardApi.list(listQuery),
  });
  const suppliers = useQuery({
    queryKey: ["purchase-order", "suppliers", debouncedSupplierSearch],
    queryFn: () => purchaseOrderApi.suppliers(debouncedSupplierSearch),
    enabled: createOpen,
  });
  const openPOs = useQuery({
    queryKey: spareInwardKeys.openPOs(supplierId),
    queryFn: () => spareInwardApi.openPurchaseOrders(supplierId),
    enabled: Boolean(supplierId),
  });
  const selectedPO = useQuery({
    queryKey: ["purchase-order", "detail", poId],
    queryFn: () => purchaseOrderApi.get(poId),
    enabled: Boolean(poId),
  });
  const voucher = useQuery({
    queryKey: ["ledger", "voucher", voucherId],
    queryFn: () => ledgerApi.voucher(voucherId!),
    enabled: voucherOpen && Boolean(voucherId),
  });

  React.useEffect(() => {
    if (!selectedPO.data) {
      setLines([]);
      return;
    }
    setLines(
      selectedPO.data.lines
        .filter((l) => l.qtyOrdered > l.qtyReceived)
        .map((l) => ({
          poLineId: l.id,
          sparePartId: l.sparePartId,
          sparePartName: l.sparePart.name,
          unit: l.sparePart.unit,
          remaining: l.qtyOrdered - l.qtyReceived,
          qtyReceived: String(l.qtyOrdered - l.qtyReceived),
          qtyRejected: "0",
          rate: String(paiseToRupees(Number(l.ratePaise))),
          batchNo: "",
          warrantyExpiry: "",
          guaranteeExpiry: "",
        })),
    );
  }, [selectedPO.data]);

  const resetForm = () => {
    setSupplierId("");
    setSupplierSearch("");
    setPoId("");
    setInwardDate(today());
    setSupplierInvoiceNo("");
    setDiscount("");
    setRemarks("");
    setLines([]);
  };

  const updateLine = (poLineId: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.poLineId === poLineId ? { ...l, ...patch } : l)));

  const grossPaise = lines.reduce(
    (sum, l) => sum + rupeesToPaise(Number(l.rate) || 0) * (Number(l.qtyReceived) || 0),
    0,
  );
  const discountPaise = rupeesToPaise(Number(discount) || 0);
  const payablePaise = grossPaise - discountPaise;

  const hasAnyReceipt = lines.some((l) => Number(l.qtyReceived) > 0);
  const linesValid = lines.every(
    (l) =>
      Number(l.qtyReceived) >= 0 &&
      Number(l.qtyRejected) >= 0 &&
      Number(l.qtyReceived) + Number(l.qtyRejected) <= l.remaining &&
      (Number(l.qtyReceived) === 0 || l.batchNo.trim().length > 0),
  );
  const canSubmit =
    Boolean(poId) && Boolean(inwardDate) && Boolean(supplierInvoiceNo.trim()) &&
    hasAnyReceipt && linesValid && discountPaise <= grossPaise;

  const create = useMutation({
    mutationFn: () =>
      spareInwardApi.create({
        poId,
        inwardDate,
        supplierInvoiceNo: supplierInvoiceNo.trim(),
        discountPaise: discountPaise || undefined,
        remarks: remarks.trim() || undefined,
        lines: lines
          .filter((l) => Number(l.qtyReceived) > 0 || Number(l.qtyRejected) > 0)
          .map((l) => ({
            poLineId: l.poLineId,
            sparePartId: l.sparePartId,
            qtyReceived: Number(l.qtyReceived) || 0,
            qtyRejected: Number(l.qtyRejected) || 0,
            ratePaise: rupeesToPaise(Number(l.rate) || 0),
            batchNo: l.batchNo.trim() || undefined,
            warrantyExpiry: l.warrantyExpiry || undefined,
            guaranteeExpiry: l.guaranteeExpiry || undefined,
          })),
      }),
    onSuccess: (inward) => {
      toast.success(`Inward posted — ${inward.inwardNumber}`);
      queryClient.invalidateQueries({ queryKey: spareInwardKeys.all });
      queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
      setCreateOpen(false);
      resetForm();
      if (inward.journalEntry) {
        setVoucherId(inward.journalEntry.id);
        setVoucherOpen(true);
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not post inward"),
  });

  const cancel = useMutation({
    mutationFn: () => spareInwardApi.cancel(cancelTarget!.id, cancelReason.trim()),
    onSuccess: () => {
      toast.success("Inward cancelled");
      queryClient.invalidateQueries({ queryKey: spareInwardKeys.all });
      queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
      setCancelTarget(null);
      setCancelReason("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not cancel"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Inward Stock</h1>
          <p className="text-sm text-muted-foreground">
            Receive goods against a purchase order. Partial receipt is normal — post another
            Inward against the same PO for the rest.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus size={15} className="mr-1" /> New Inward
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inward Number</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Payable</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!list.isLoading && (list.data?.data.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No inwards yet.
                </TableCell>
              </TableRow>
            )}
            {list.data?.data.map((inward) => (
              <TableRow
                key={inward.id}
                className="cursor-pointer"
                onClick={() => router.push(`/workshop/inward/${inward.id}`)}
              >
                <TableCell className="font-medium">{inward.inwardNumber ?? "—"}</TableCell>
                <TableCell>{inward.po.poNumber ?? "—"}</TableCell>
                <TableCell>{inward.supplier.name}</TableCell>
                <TableCell>{new Date(inward.inwardDate).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>
                  <SpareInwardStatusBadge status={inward.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(inward.payableAmountPaise)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push(`/workshop/inward/${inward.id}`)}
                    >
                      <IconEye size={15} className="mr-1" /> View
                    </Button>
                    {inward.journalEntry && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setVoucherId(inward.journalEntry!.id);
                          setVoucherOpen(true);
                        }}
                      >
                        <IconFileInvoice size={15} className="mr-1" /> Voucher
                      </Button>
                    )}
                    {inward.status === "POSTED" && canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setCancelTarget(inward)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePaginationFooter
          total={list.data?.meta?.total ?? 0}
          page={page}
          size={size}
          onPageChange={setPage}
          onSizeChange={(next) => { setSize(next); setPage(0); }}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="w-[95vw] max-h-[95vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>New Inward</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Supplier + Purchase Order */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Supplier */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Supplier</label>

                <Combobox
                  options={suppliers.data ?? []}
                  value={supplierId}
                  onChange={(v) => {
                    setSupplierId(v);
                    setPoId("");
                  }}
                  searchValue={supplierSearch}
                  onSearchChange={setSupplierSearch}
                  placeholder="Search supplier..."
                  searchPlaceholder="Type to search..."
                  emptyText={suppliers.isLoading ? "Loading suppliers..." : "No suppliers found"}
                />
              </div>

              {/* Purchase Order - 2 columns */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Purchase Order</label>

                <Select
                  value={poId}
                  onValueChange={setPoId}
                  disabled={!supplierId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        supplierId
                          ? "Select PO"
                          : "Pick a supplier first"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {openPOs.data?.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.poNumber} ({po.status.replaceAll("_", " ")})
                      </SelectItem>
                    ))}

                    {supplierId &&
                      (openPOs.data?.length ?? 0) === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          No open POs for this supplier
                        </div>
                      )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Inward / Invoice information */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Inward date */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Inward date
                </label>

                <Input
                  type="date"
                  value={inwardDate}
                  onChange={(e) => setInwardDate(e.target.value)}
                />
              </div>

              {/* Supplier invoice */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Supplier invoice no.
                </label>

                <Input
                  value={supplierInvoiceNo}
                  onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                />
              </div>

            </div>

            {/* Discount */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Discount */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Discount (₹){" "}
                  <span className="text-muted-foreground">
                    (optional)
                  </span>
                </label>

                <Input
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">
                  Remarks{" "}
                  <span className="text-muted-foreground">
                    (optional)
                  </span>
                </label>

                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          </div>

          {poId && (
            <div className="rounded-md border">
              <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">
                Lines {selectedPO.isLoading && <span className="text-muted-foreground">(loading...)</span>}
              </div>
              <div className="divide-y">
                {lines.map((line) => (
                  <div key={line.poLineId} className="grid gap-2 p-3 sm:grid-cols-6 sm:items-center">
                    <div className="sm:col-span-2">
                      <div className="text-sm font-medium">{line.sparePartName}</div>
                      <div className="text-xs text-muted-foreground">
                        Pending: {line.remaining} {line.unit}
                      </div>
                    </div>
                    <Input
                      inputMode="numeric"
                      placeholder="Received qty"
                      value={line.qtyReceived}
                      onChange={(e) => updateLine(line.poLineId, { qtyReceived: e.target.value })}
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="Rejected qty"
                      value={line.qtyRejected}
                      onChange={(e) => updateLine(line.poLineId, { qtyRejected: e.target.value })}
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="Rate (₹)"
                      value={line.rate}
                      onChange={(e) => updateLine(line.poLineId, { rate: e.target.value })}
                    />
                    <Input
                      placeholder="Batch no. *"
                      value={line.batchNo}
                      onChange={(e) => updateLine(line.poLineId, { batchNo: e.target.value })}
                      className={
                        Number(line.qtyReceived) > 0 && !line.batchNo.trim()
                          ? "border-destructive"
                          : undefined
                      }
                    />
                    <div className="sm:col-span-3">
                      <label className="text-xs text-muted-foreground">Warranty expiry</label>
                      <Input
                        type="date"
                        value={line.warrantyExpiry}
                        onChange={(e) => updateLine(line.poLineId, { warrantyExpiry: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-xs text-muted-foreground">Guarantee expiry</label>
                      <Input
                        type="date"
                        value={line.guaranteeExpiry}
                        onChange={(e) => updateLine(line.poLineId, { guaranteeExpiry: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
                {!selectedPO.isLoading && lines.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nothing pending on this PO.
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-6 border-t bg-muted/20 px-3 py-2.5 text-sm">
                <span>
                  Gross <span className="font-semibold tabular-nums">{formatPaise(grossPaise)}</span>
                </span>
                <span>
                  Payable <span className="font-semibold tabular-nums">{formatPaise(payablePaise)}</span>
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Posting..." : "Post Inward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {cancelTarget?.inwardNumber}?</DialogTitle>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
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

      <VoucherDialog
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        voucher={voucher.data}
        isLoading={voucher.isLoading}
        isError={voucher.isError}
        errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
      />
    </div>
  );
}
