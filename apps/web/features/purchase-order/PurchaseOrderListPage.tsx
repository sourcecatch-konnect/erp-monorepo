"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
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
import { formatPaise, rupeesToPaise, paiseToRupees } from "@/lib/money";
import {
  purchaseOrderApi,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "./api/purchase-order.service";
import { purchaseOrderKeys } from "./api/purchase-order.keys";

type LineDraft = {
  key: string;
  sparePartId: string;
  qty: string;
  rate: string;
};

const newLine = (): LineDraft => ({
  key: Math.random().toString(36).slice(2),
  sparePartId: "",
  qty: "",
  rate: "",
});

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  DRAFT: "border-muted-foreground/30 bg-muted text-muted-foreground",
  APPROVED: "border-primary/20 bg-primary/10 text-primary",
  SENT: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PARTIALLY_RECEIVED:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  RECEIVED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CLOSED: "border-muted-foreground/30 bg-muted text-muted-foreground",
  CANCELLED: "border-destructive/20 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

/** Purchase Order — commitment-only document (never moves stock or posts to
 *  the ledger). Header + a line-item grid, one page, matching the "search
 *  instead of drill-down" screen philosophy agreed for this module. */
export function PurchaseOrderListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.PO_MANAGE);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<PurchaseOrder | null>(null);
  const [branchId, setBranchId] = React.useState("");
  const [supplierId, setSupplierId] = React.useState("");
  const [poDate, setPoDate] = React.useState(today());
  const [expectedDate, setExpectedDate] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [lines, setLines] = React.useState<LineDraft[]>([newLine()]);

  const list = useQuery({
    queryKey: purchaseOrderKeys.list(),
    queryFn: () => purchaseOrderApi.list(),
  });
  const headOfficeBranch = useQuery({
    queryKey: purchaseOrderKeys.branches,
    queryFn: purchaseOrderApi.headOfficeBranch,
  });
  React.useEffect(() => {
    if (headOfficeBranch.data && !branchId) setBranchId(headOfficeBranch.data.id);
  }, [headOfficeBranch.data, branchId]);
  const suppliers = useQuery({
    queryKey: purchaseOrderKeys.suppliers,
    queryFn: purchaseOrderApi.suppliers,
  });
  const spareParts = useQuery({
    queryKey: purchaseOrderKeys.spareParts(branchId),
    queryFn: () => purchaseOrderApi.spareParts(branchId),
  });

  const resetForm = () => {
    setEditTarget(null);
    setBranchId(headOfficeBranch.data?.id ?? "");
    setSupplierId("");
    setPoDate(today());
    setExpectedDate("");
    setRemarks("");
    setLines([newLine()]);
  };

  // Detail page's Edit button routes back here with ?edit=<id> since the
  // multi-line edit form only exists in this list page's dialog.
  const editParamId = searchParams.get("edit");
  React.useEffect(() => {
    if (!editParamId) return;
    const target = list.data?.find((p) => p.id === editParamId);
    if (target) {
      openEdit(target);
      router.replace("/workshop/purchase-orders");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParamId, list.data]);

  const openEdit = (po: PurchaseOrder) => {
    setEditTarget(po);
    setBranchId(po.branchId);
    setSupplierId(po.supplierId);
    setPoDate(po.poDate.slice(0, 10));
    setExpectedDate(po.expectedDate ? po.expectedDate.slice(0, 10) : "");
    setRemarks(po.remarks ?? "");
    setLines(
      po.lines.map((l) => ({
        key: l.id,
        sparePartId: l.sparePartId,
        qty: String(l.qtyOrdered),
        rate: String(paiseToRupees(Number(l.ratePaise))),
      })),
    );
    setCreateOpen(true);
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const validLines = lines.filter(
    (l) => l.sparePartId && Number(l.qty) > 0 && Number(l.rate) >= 0,
  );
  const estimatedPaise = validLines.reduce(
    (sum, l) => sum + rupeesToPaise(Number(l.rate)) * Number(l.qty),
    0,
  );
  const canSubmit =
    Boolean(branchId) && Boolean(supplierId) && Boolean(poDate) && validLines.length === lines.length && validLines.length > 0;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        branchId,
        supplierId,
        poDate,
        expectedDate: expectedDate || undefined,
        remarks: remarks.trim() || undefined,
        lines: validLines.map((l) => ({
          sparePartId: l.sparePartId,
          qtyOrdered: Number(l.qty),
          ratePaise: rupeesToPaise(Number(l.rate)),
        })),
      };
      return editTarget ? purchaseOrderApi.update(editTarget.id, body) : purchaseOrderApi.create(body);
    },
    onSuccess: (po) => {
      toast.success(editTarget ? `Purchase Order updated — ${po.poNumber}` : `Purchase Order created — ${po.poNumber}`);
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      setCreateOpen(false);
      resetForm();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save purchase order"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">
            Commitment to buy spare parts from a supplier. Creating or approving a PO never
            moves stock — only an Inward posted against it does.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
            <IconPlus size={15} className="mr-1" /> New PO
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Estimated</TableHead>
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
            {!list.isLoading && (list.data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No purchase orders yet.
                </TableCell>
              </TableRow>
            )}
            {list.data?.map((po) => (
              <TableRow
                key={po.id}
                className="cursor-pointer"
                onClick={() => router.push(`/workshop/purchase-orders/${po.id}`)}
              >
                <TableCell className="font-medium">{po.poNumber ?? "—"}</TableCell>
                <TableCell>{po.supplier.name}</TableCell>
                <TableCell>{po.branch.name}</TableCell>
                <TableCell>{new Date(po.poDate).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>
                  <StatusBadge status={po.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(po.estimatedPaise)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/workshop/purchase-orders/${po.id}`);
                    }}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="w-[95vw] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? `Edit ${editTarget.poNumber}` : "New Purchase Order"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Branch</label>
              <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                {headOfficeBranch.data?.name ?? "—"}{" "}
                <span className="ml-1 text-xs">(single workshop — fixed)</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Supplier</label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.data?.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">PO date</label>
              <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Expected date <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <label className="text-sm font-medium">
                Remarks <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">Lines</div>
            <div className="divide-y">
              {lines.map((line) => {
                const amount = rupeesToPaise(Number(line.rate) || 0) * (Number(line.qty) || 0);
                const selectedPart = spareParts.data?.find((p) => p.value === line.sparePartId);
                const gap =
                  selectedPart && selectedPart.currentStock !== null
                    ? Math.max(selectedPart.minimumStock - selectedPart.currentStock, 0)
                    : null;
                const qtyEntered = Number(line.qty) || 0;
                const afterThisOrder = gap !== null ? gap - qtyEntered : null;

                return (
                  <div key={line.key} className="space-y-1.5 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="sm:w-64">
                        <Select
                          value={line.sparePartId}
                          onValueChange={(v) => {
                            const picked = spareParts.data?.find((p) => p.value === v);
                            updateLine(line.key, {
                              sparePartId: v,
                              // Prefill from the master's rate — still freely editable below.
                              rate: picked ? String(paiseToRupees(Number(picked.ratePaise))) : line.rate,
                            });
                          }}
                          disabled={!branchId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={branchId ? "Spare part" : "Pick a branch first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {spareParts.data?.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        inputMode="numeric"
                        placeholder="Qty"
                        value={line.qty}
                        onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                        className="sm:w-24"
                      />
                      <Input
                        inputMode="decimal"
                        placeholder="Rate (₹)"
                        value={line.rate}
                        onChange={(e) => updateLine(line.key, { rate: e.target.value })}
                        className="sm:w-32"
                      />
                      <span className="text-sm text-muted-foreground sm:w-28 sm:text-right">
                        {formatPaise(amount)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={lines.length <= 1}
                        onClick={() => removeLine(line.key)}
                      >
                        <IconTrash size={15} />
                      </Button>
                    </div>

                    {selectedPart && gap !== null && (
                      <div className="pl-1 text-xs">
                        {gap === 0 ? (
                          <span className="text-muted-foreground">
                            Stock is already at or above minimum ({selectedPart.minimumStock}) — have {selectedPart.currentStock}.
                          </span>
                        ) : qtyEntered === 0 ? (
                          <span className="text-destructive">
                            Available to order: <span className="font-semibold">{gap}</span> (min{" "}
                            {selectedPart.minimumStock}, have {selectedPart.currentStock})
                          </span>
                        ) : (
                          <span className={afterThisOrder! > 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}>
                            {gap} available − {qtyEntered} ordered ={" "}
                            <span className="font-semibold">
                              {afterThisOrder! > 0 ? `${afterThisOrder} still short` : "shortfall covered"}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2.5">
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, newLine()])}>
                <IconPlus size={15} className="mr-1" /> Add line
              </Button>
              <span className="text-sm">
                Estimated total{" "}
                <span className="font-semibold tabular-nums">{formatPaise(estimatedPaise)}</span>
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving..." : editTarget ? "Save changes" : "Create PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
