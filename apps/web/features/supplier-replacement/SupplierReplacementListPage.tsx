"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconEye, IconPlus } from "@tabler/icons-react";
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
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";
import {
  supplierReplacementApi,
  type ReplacementType,
} from "./api/supplier-replacement.service";
import { supplierReplacementKeys } from "./api/supplier-replacement.keys";
import { ReplacementListStatusBadge } from "./supplierReplaceStatusBadge";

const today = () => new Date().toISOString().slice(0, 10);


type NewLineDraft = {
  sparePartId: string;
  originalInwardLineId: string;
  sparePartName: string;
  unit: string;
  available: number;
  qtyRequested: string;
  replacementType: ReplacementType;
};

/** Supplier Replacement — a defective part returned to the ORIGINAL supplier,
 *  keyed off the purchase inward (not a truck/Job Card — that's Removed
 *  Parts, a different flow). Two stages: request it go out, then receive
 *  the replacement back (the receive/cancel/view flow lives on the detail
 *  page — this list only creates new requests and links out to it). */
export function SupplierReplacementListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.REPLACEMENT_MANAGE);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [branchId, setBranchId] = React.useState("");
  const [supplierId, setSupplierId] = React.useState("");
  const [originalInwardId, setOriginalInwardId] = React.useState("");
  const [requestDate, setRequestDate] = React.useState(today());
  const [remarks, setRemarks] = React.useState("");
  const [newLines, setNewLines] = React.useState<NewLineDraft[]>([]);
  const [supplierSearch, setSupplierSearch] = React.useState("");
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch, 300);

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const lists = useQuery({
    queryKey: supplierReplacementKeys.lists({ page, size }),
    queryFn: () => supplierReplacementApi.listReplacementLists({ page, size }),
  });
  const suppliers = useQuery({
    queryKey: supplierReplacementKeys.suppliers(debouncedSupplierSearch),
    queryFn: () => supplierReplacementApi.suppliers(debouncedSupplierSearch),
    enabled: createOpen,
  });
  // Single-workshop-at-HO: this is always the same one branch, so cache it
  // indefinitely instead of refetching on every screen open.
  const headOfficeBranch = useQuery({
    queryKey: supplierReplacementKeys.headOfficeBranch,
    queryFn: supplierReplacementApi.headOfficeBranch,
    staleTime: Infinity,
  });
  const postedInwards = useQuery({
    queryKey: supplierReplacementKeys.postedInwards(supplierId),
    queryFn: () => supplierReplacementApi.postedInwardsForSupplier(supplierId),
    enabled: Boolean(supplierId),
  });
  const originalInward = useQuery({
    queryKey: supplierReplacementKeys.originalInward(originalInwardId),
    queryFn: () => supplierReplacementApi.originalInward(originalInwardId),
    enabled: Boolean(originalInwardId),
  });

  React.useEffect(() => {
    if (!originalInward.data) {
      setNewLines([]);
      return;
    }
    setNewLines(
      originalInward.data.lines
        .filter((l) => (l.batch?.qtyRemaining ?? 0) > 0)
        .map((l) => ({
          sparePartId: l.sparePartId,
          originalInwardLineId: l.id,
          sparePartName: l.sparePart.name,
          unit: l.sparePart.unit,
          available: l.batch?.qtyRemaining ?? 0,
          qtyRequested: "",
          replacementType: "FREE",
        })),
    );
  }, [originalInward.data]);

  React.useEffect(() => {
    if (headOfficeBranch.data) setBranchId(headOfficeBranch.data.id);
  }, [headOfficeBranch.data]);

  const resetCreateForm = () => {
    setSupplierId("");
    setSupplierSearch("");
    setOriginalInwardId("");
    setRequestDate(today());
    setRemarks("");
    setNewLines([]);
  };

  const updateNewLine = (originalInwardLineId: string, patch: Partial<NewLineDraft>) =>
    setNewLines((prev) =>
      prev.map((l) => (l.originalInwardLineId === originalInwardLineId ? { ...l, ...patch } : l)),
    );

  const selectedNewLines = newLines.filter((l) => Number(l.qtyRequested) > 0);
  const canCreate =
    Boolean(branchId) && Boolean(supplierId) && Boolean(originalInwardId) &&
    selectedNewLines.length > 0 &&
    selectedNewLines.every((l) => Number(l.qtyRequested) <= l.available);

  const createList = useMutation({
    mutationFn: () =>
      supplierReplacementApi.createReplacementList({
        branchId,
        supplierId,
        originalInwardId,
        requestDate,
        remarks: remarks.trim() || undefined,
        lines: selectedNewLines.map((l) => ({
          sparePartId: l.sparePartId,
          originalInwardLineId: l.originalInwardLineId,
          qtyRequested: Number(l.qtyRequested),
          replacementType: l.replacementType,
        })),
      }),
    onSuccess: (list) => {
      toast.success(`Replacement requested — ${list.replacementNumber}`);
      queryClient.invalidateQueries({ queryKey: supplierReplacementKeys.all });
      setCreateOpen(false);
      resetCreateForm();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Supplier Replacement</h1>
          <p className="text-sm text-muted-foreground">
            A defective part returned to the original supplier — keyed off the purchase it came
            from, not a truck.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <IconPlus size={15} className="mr-1" /> New Replacement
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Replacement #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Original Inward</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lists.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!lists.isLoading && (lists.data?.data.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No replacement requests yet.
                </TableCell>
              </TableRow>
            )}
            {lists.data?.data.map((list) => (
              <TableRow
                key={list.id}
                className="cursor-pointer"
                onClick={() => router.push(`/workshop/supplier-replacement/${list.id}`)}
              >
                <TableCell className="font-medium">{list.replacementNumber ?? "—"}</TableCell>
                <TableCell>{list.supplier.name}</TableCell>
                <TableCell>{list.originalInward.inwardNumber ?? "—"}</TableCell>
                <TableCell>{new Date(list.requestDate).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>
                  <ReplacementListStatusBadge status={list.status} />

                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/workshop/supplier-replacement/${list.id}`);
                      }}
                    >
                      <IconEye size={15} className="mr-1" /> View
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePaginationFooter
          total={lists.data?.meta?.total ?? 0}
          page={page}
          size={size}
          onPageChange={setPage}
          onSizeChange={handleSizeChange}
        />
      </div>

      {/* New replacement request */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="w-[95vw] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Replacement Request</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-sm font-medium">Supplier</label>
              <Combobox
                options={suppliers.data ?? []}
                value={supplierId}
                onChange={(v) => { setSupplierId(v); setOriginalInwardId(""); }}
                searchValue={supplierSearch}
                onSearchChange={setSupplierSearch}
                placeholder="Search supplier..."
                searchPlaceholder="Type to search..."
                emptyText={suppliers.isLoading ? "Loading suppliers..." : "No suppliers found"}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Original Inward</label>
              <Select value={originalInwardId} onValueChange={setOriginalInwardId} disabled={!supplierId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={supplierId ? "Select inward" : "Pick a supplier first"} />
                </SelectTrigger>
                <SelectContent>
                  {postedInwards.data?.map((inw) => (
                    <SelectItem key={inw.id} value={inw.id}>
                      {inw.inwardNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Branch</label>
              <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                {headOfficeBranch.data?.name ?? "—"}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Request date</label>
              <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium">
                Remarks <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={1} className="resize-none" />
            </div>
          </div>

          {originalInwardId && (
            <div className="rounded-md border">
              <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">
                Parts to replace
                {originalInward.data && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    — Bill No. {originalInward.data.supplierInvoiceNo}
                  </span>
                )}
                {originalInward.isLoading && <span className="text-muted-foreground">(loading...)</span>}
              </div>
              <div className="divide-y">
                {newLines.map((line) => (
                  <div key={line.originalInwardLineId} className="grid gap-2 p-3 sm:grid-cols-4 sm:items-center">
                    <div>
                      <div className="text-sm font-medium">{line.sparePartName}</div>
                      <div className="text-xs text-muted-foreground">In stock: {line.available} {line.unit}</div>
                    </div>
                    <Input
                      inputMode="numeric"
                      placeholder="Qty to send back"
                      value={line.qtyRequested}
                      onChange={(e) => updateNewLine(line.originalInwardLineId, { qtyRequested: e.target.value })}
                    />
                    <Select
                      value={line.replacementType}
                      onValueChange={(v) => updateNewLine(line.originalInwardLineId, { replacementType: v as ReplacementType })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FREE">Free</SelectItem>
                        <SelectItem value="PAYABLE">Payable</SelectItem>
                        <SelectItem value="CREDIT_NOTE">Credit Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {!originalInward.isLoading && newLines.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No stock available on this inward to replace.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canCreate || createList.isPending} onClick={() => createList.mutate()}>
              {createList.isPending ? "Submitting..." : "Send to supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
