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
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";

import { useCan } from "@/features/auth";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { formatPaise, rupeesToPaise, paiseToRupees } from "@/lib/money";
import {
  purchaseOrderApi,
  type PurchaseOrder,
} from "./api/purchase-order.service";
import { purchaseOrderKeys } from "./api/purchase-order.keys";
import { PurchaseOrderStatusBadge } from "./purchaseOrderStatusBadge";

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
  const [supplierSearch, setSupplierSearch] = React.useState("");
  const [partSearch, setPartSearch] = React.useState("");
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch, 300);
  const debouncedPartSearch = useDebouncedValue(partSearch, 300);

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const list = useQuery({
    queryKey: purchaseOrderKeys.list({ page, size }),
    queryFn: () => purchaseOrderApi.list({ page, size }),
  });
  const orders = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? 0;
  // Single-workshop-at-HO: this is always the same one branch, so cache it
  // indefinitely instead of refetching on every screen open.
  const headOfficeBranch = useQuery({
    queryKey: purchaseOrderKeys.branches,
    queryFn: purchaseOrderApi.headOfficeBranch,
    staleTime: Infinity,
  });
  React.useEffect(() => {
    if (headOfficeBranch.data && !branchId) setBranchId(headOfficeBranch.data.id);
  }, [headOfficeBranch.data, branchId]);
  const suppliers = useQuery({
    queryKey: purchaseOrderKeys.suppliers(debouncedSupplierSearch),
    queryFn: () => purchaseOrderApi.suppliers(debouncedSupplierSearch),
    enabled: createOpen,
  });
  const spareParts = useQuery({
    queryKey: purchaseOrderKeys.spareParts(branchId, debouncedPartSearch),
    queryFn: () => purchaseOrderApi.spareParts(branchId, debouncedPartSearch),
    enabled: createOpen,
  });

  const resetForm = () => {
    setEditTarget(null);
    setBranchId(headOfficeBranch.data?.id ?? "");
    setSupplierId("");
    setSupplierSearch("");
    setPartSearch("");
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
    const target = orders.find((p) => p.id === editParamId);
    if (target) {
      openEdit(target);
      router.replace("/workshop/purchase-orders");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParamId, orders]);

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
            {!list.isLoading && orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No purchase orders yet.
                </TableCell>
              </TableRow>
            )}
            {orders.map((po) => (
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
                  <PurchaseOrderStatusBadge status={po.status} />
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
        <TablePaginationFooter
          total={total}
          page={page}
          size={size}
          onPageChange={setPage}
          onSizeChange={handleSizeChange}
        />
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
              <Combobox
                options={suppliers.data ?? []}
                value={supplierId}
                onChange={setSupplierId}
                searchValue={supplierSearch}
                onSearchChange={setSupplierSearch}
                placeholder="Search supplier..."
                searchPlaceholder="Type to search..."
                emptyText={suppliers.isLoading ? "Loading suppliers..." : "No suppliers found"}
              />
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
                        <Combobox
                          options={spareParts.data ?? []}
                          value={line.sparePartId}
                          onChange={(v) => {
                            const picked = spareParts.data?.find((p) => p.value === v);
                            updateLine(line.key, {
                              sparePartId: v,
                              // Prefill from the master's rate — still freely editable below.
                              rate: picked ? String(paiseToRupees(Number(picked.ratePaise))) : line.rate,
                            });
                          }}
                          searchValue={partSearch}
                          onSearchChange={setPartSearch}
                          disabled={!branchId}
                          placeholder={branchId ? "Search spare part..." : "Pick a branch first"}
                          searchPlaceholder="Type to search..."
                          emptyText={spareParts.isLoading ? "Loading parts..." : "No parts found"}
                        />
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
