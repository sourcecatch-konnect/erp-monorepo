"use client";

import * as React from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import { Combobox } from "@skerp/ui/components/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import { formatPaise, rupeesToPaise, paiseToRupees } from "@/lib/money";
import {
  purchaseOrderApi,
  LOOKUP_PAGE_SIZE,
  type PurchaseOrder,
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Purchase order being edited, or null when creating a new one. */
  editTarget: PurchaseOrder | null;
};

/** Create/edit form for a Purchase Order — header fields + a line-item grid
 *  with a live shortfall-vs-minimum-stock hint per spare part. */
export function PurchaseOrderFormDialog({ open, onOpenChange, editTarget }: Props) {
  const queryClient = useQueryClient();

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

  // Single-workshop-at-HO: this is always the same one branch, so cache it
  // indefinitely instead of refetching on every screen open.
  const headOfficeBranch = useQuery({
    queryKey: purchaseOrderKeys.branches,
    queryFn: purchaseOrderApi.headOfficeBranch,
    staleTime: Infinity,
  });
  // Suppliers and the parts catalogue can both run into the thousands — load
  // one page at a time and fetch more as the user scrolls the dropdown,
  // instead of silently truncating to the first 20 matches.
  const suppliers = useInfiniteQuery({
    queryKey: purchaseOrderKeys.suppliers(debouncedSupplierSearch),
    queryFn: ({ pageParam = 0 }) =>
      purchaseOrderApi.suppliers({
        page: pageParam,
        size: LOOKUP_PAGE_SIZE,
        search: debouncedSupplierSearch,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((page) => page.data).length;
      const total = lastPage.meta?.total;
      if (typeof total === "number") {
        return loaded < total ? allPages.length : undefined;
      }
      return lastPage.data.length === LOOKUP_PAGE_SIZE ? allPages.length : undefined;
    },
    enabled: open,
  });
  const spareParts = useInfiniteQuery({
    queryKey: purchaseOrderKeys.spareParts(branchId, debouncedPartSearch),
    queryFn: ({ pageParam = 0 }) =>
      purchaseOrderApi.spareParts({
        branchId,
        search: debouncedPartSearch,
        page: pageParam,
        size: LOOKUP_PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((page) => page.data).length;
      const total = lastPage.meta?.total;
      if (typeof total === "number") {
        return loaded < total ? allPages.length : undefined;
      }
      return lastPage.data.length === LOOKUP_PAGE_SIZE ? allPages.length : undefined;
    },
    enabled: open,
  });
  const supplierOptions = React.useMemo(
    () => suppliers.data?.pages.flatMap((page) => page.data) ?? [],
    [suppliers.data],
  );
  const sparePartOptions = React.useMemo(
    () => spareParts.data?.pages.flatMap((page) => page.data) ?? [],
    [spareParts.data],
  );

  const resetForm = React.useCallback(() => {
    setBranchId(headOfficeBranch.data?.id ?? "");
    setSupplierId("");
    setSupplierSearch("");
    setPartSearch("");
    setPoDate(today());
    setExpectedDate("");
    setRemarks("");
    setLines([newLine()]);
  }, [headOfficeBranch.data]);

  // Populate from editTarget (or reset for a fresh create) each time the
  // dialog opens.
  React.useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setBranchId(editTarget.branchId);
      setSupplierId(editTarget.supplierId);
      setPoDate(editTarget.poDate.slice(0, 10));
      setExpectedDate(editTarget.expectedDate ? editTarget.expectedDate.slice(0, 10) : "");
      setRemarks(editTarget.remarks ?? "");
      setLines(
        editTarget.lines.map((l) => ({
          key: l.id,
          sparePartId: l.sparePartId,
          qty: String(l.qtyOrdered),
          rate: String(paiseToRupees(Number(l.ratePaise))),
        })),
      );
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editTarget]);

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
    Boolean(branchId) &&
    Boolean(supplierId) &&
    Boolean(poDate) &&
    validLines.length === lines.length &&
    validLines.length > 0;

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
      return editTarget
        ? purchaseOrderApi.update(editTarget.id, body)
        : purchaseOrderApi.create(body);
    },
    onSuccess: (po) => {
      toast.success(
        editTarget
          ? `Purchase Order updated — ${po.poNumber}`
          : `Purchase Order created — ${po.poNumber}`,
      );
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not save purchase order",
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {editTarget ? `Edit ${editTarget.poNumber}` : "New Purchase Order"}
          </DialogTitle>
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
              options={supplierOptions}
              value={supplierId}
              onChange={setSupplierId}
              searchValue={supplierSearch}
              onSearchChange={setSupplierSearch}
              placeholder="Search supplier..."
              searchPlaceholder="Type to search..."
              emptyText={suppliers.isLoading ? "Loading suppliers..." : "No suppliers found"}
              hasMore={Boolean(suppliers.hasNextPage)}
              isLoadingMore={suppliers.isFetchingNextPage}
              onScrollEnd={() => {
                if (suppliers.hasNextPage && !suppliers.isFetchingNextPage) {
                  suppliers.fetchNextPage();
                }
              }}
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
              const selectedPart = sparePartOptions.find((p) => p.value === line.sparePartId);
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
                        options={sparePartOptions}
                        value={line.sparePartId}
                        onChange={(v) => {
                          const picked = sparePartOptions.find((p) => p.value === v);
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
                        hasMore={Boolean(spareParts.hasNextPage)}
                        isLoadingMore={spareParts.isFetchingNextPage}
                        onScrollEnd={() => {
                          if (spareParts.hasNextPage && !spareParts.isFetchingNextPage) {
                            spareParts.fetchNextPage();
                          }
                        }}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving..." : editTarget ? "Save changes" : "Create PO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
