"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

import { formatPaise } from "@/lib/money";
import { jobCardApi, type LookupOption } from "../api/job-card.service";
import { jobCardKeys } from "../api/job-card.keys";
import { newPartLine, type PartLineDraft } from "../line-drafts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  mechanics: LookupOption[];
  onAdd: (lines: PartLineDraft[]) => void;
};

/** Old-ERP-style part picker: Category → Part Name → a table of every batch
 *  that part has in stock, with an editable Qty box per row — you can pull
 *  from several batches of the same part in one go. Mirrors the "Part
 *  Detail" dialog (Category / Part Name / Stock table / Mechanic /
 *  Description / Save). */
export function AddPartDialog({ open, onOpenChange, branchId, mechanics, onAdd }: Props) {
  const [categoryId, setCategoryId] = React.useState("");
  const [sparePartId, setSparePartId] = React.useState("");
  const [mechanicId, setMechanicId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [qtyByBatch, setQtyByBatch] = React.useState<Record<string, string>>({});

  const categories = useQuery({
    queryKey: jobCardKeys.categories("Item"),
    queryFn: () => jobCardApi.categories("Item"),
  });
  const parts = useQuery({
    queryKey: jobCardKeys.spareParts("Item", categoryId),
    queryFn: () => jobCardApi.spareParts("Item", categoryId),
    enabled: Boolean(categoryId),
  });
  const batches = useQuery({
    queryKey: jobCardKeys.batches(sparePartId, branchId),
    queryFn: () => jobCardApi.batches(sparePartId, branchId),
    enabled: Boolean(sparePartId && branchId),
  });

  const reset = () => {
    setCategoryId("");
    setSparePartId("");
    setMechanicId("");
    setDescription("");
    setQtyByBatch({});
  };

  const selectedPart = parts.data?.find((p) => p.value === sparePartId);

  const rowsToAdd = (batches.data ?? [])
    .filter((b) => Number(qtyByBatch[b.id] ?? 0) > 0)
    .map((b) => ({ batch: b, qty: Number(qtyByBatch[b.id]) }));

  const invalid = rowsToAdd.some(({ batch, qty }) => qty > batch.qtyRemaining);
  const canSave = rowsToAdd.length > 0 && !invalid;

  const handleSave = () => {
    const lines: PartLineDraft[] = rowsToAdd.map(({ batch, qty }) => ({
      ...newPartLine(),
      sparePartId,
      sparePartName: selectedPart?.label ?? "",
      batchId: batch.id,
      batchNo: batch.batchNo ?? batch.id.slice(0, 6),
      sourceInvoiceNumber: batch.sourceInvoiceNumber,
      unitCostPaise: batch.unitCostPaise,
      mechanicId,
      qty: String(qty),
      description,
    }));
    onAdd(lines);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="w-[95vw] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Part Detail</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <Select
              value={categoryId}
              onValueChange={(v) => { setCategoryId(v); setSparePartId(""); setQtyByBatch({}); }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.data?.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Part Name</label>
            <Select
              value={sparePartId}
              onValueChange={(v) => { setSparePartId(v); setQtyByBatch({}); }}
              disabled={!categoryId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={categoryId ? "Select part" : "Pick a category first"} />
              </SelectTrigger>
              <SelectContent>
                {parts.data?.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {sparePartId && (
          <div className="rounded-md border">
            <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">
              Stock {batches.isLoading && <span className="text-muted-foreground">(loading...)</span>}
            </div>
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">SN</TableHead>
                    <TableHead>Purchase Invoice</TableHead>
                    <TableHead>Batch No</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Stock Qty</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.data?.map((b, i) => {
                    const qty = qtyByBatch[b.id] ?? "";
                    const over = Number(qty) > b.qtyRemaining;
                    return (
                      <TableRow key={b.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          {b.sourceInvoiceNumber ?? (
                            <span className="text-muted-foreground">Returned stock</span>
                          )}
                        </TableCell>
                        <TableCell>{b.batchNo ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPaise(b.unitCostPaise)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{b.qtyRemaining}</TableCell>
                        <TableCell>
                          <Input
                            inputMode="numeric"
                            value={qty}
                            onChange={(e) =>
                              setQtyByBatch((prev) => ({ ...prev, [b.id]: e.target.value }))
                            }
                            className={over ? "border-destructive" : undefined}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!batches.isLoading && batches.data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No stock available for this part.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mechanic</label>
            <Select value={mechanicId} onValueChange={setMechanicId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select mechanic" />
              </SelectTrigger>
              <SelectContent>
                {mechanics.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={1} className="resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
