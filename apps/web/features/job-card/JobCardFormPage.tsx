"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus, IconTrash, IconFileInvoice } from "@tabler/icons-react";
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
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Combobox } from "@skerp/ui/components/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { useCan } from "@/features/auth";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { jobCardApi, type JobCard, type TruckLocationStatus } from "./api/job-card.service";
import { jobCardKeys } from "./api/job-card.keys";
import type { PartLineDraft, ServiceLineDraft } from "./line-drafts";
import { AddPartDialog } from "./components/AddPartDialog";
import { AddServiceDialog } from "./components/AddServiceDialog";

const toDatetimeLocal = (iso?: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16);

export function JobCardFormPage({ jobCardId }: { jobCardId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.JOBCARD_MANAGE);
  const canFinalise = useCan(PERMS.WORKSHOP.JOBCARD_FINALISE);

  const existing = useQuery({
    queryKey: jobCardKeys.detail(jobCardId ?? ""),
    queryFn: () => jobCardApi.get(jobCardId!),
    enabled: Boolean(jobCardId),
  });

  // Single-workshop-at-HO: this is always the same one branch, so cache it
  // indefinitely instead of refetching on every screen open.
  const headOfficeBranch = useQuery({
    queryKey: jobCardKeys.branches,
    queryFn: jobCardApi.headOfficeBranch,
    staleTime: Infinity,
  });
  const vehicles = useQuery({ queryKey: jobCardKeys.vehicles, queryFn: jobCardApi.vehicles });
  const drivers = useQuery({ queryKey: jobCardKeys.drivers, queryFn: jobCardApi.drivers });
  // Mechanics are a small, workshop-owned staff list — cache generously
  // instead of refetching on every screen open.
  const mechanics = useQuery({
    queryKey: jobCardKeys.mechanics,
    queryFn: jobCardApi.mechanics,
    staleTime: 5 * 60 * 1000,
  });

  const [branchId, setBranchId] = React.useState("");
  const [vehicleId, setVehicleId] = React.useState("");
  const [driverId, setDriverId] = React.useState("");
  const [truckStatus, setTruckStatus] = React.useState<TruckLocationStatus>("AT_HO");
  const [inDateTime, setInDateTime] = React.useState(toDatetimeLocal());
  const [openingKm, setOpeningKm] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [partLines, setPartLines] = React.useState<PartLineDraft[]>([]);
  const [addPartOpen, setAddPartOpen] = React.useState(false);
  const [addServiceOpen, setAddServiceOpen] = React.useState(false);
  const [serviceLines, setServiceLines] = React.useState<ServiceLineDraft[]>([]);

  React.useEffect(() => {
    if (headOfficeBranch.data && !branchId) setBranchId(headOfficeBranch.data.id);
  }, [headOfficeBranch.data, branchId]);

  const [outDateTime, setOutDateTime] = React.useState(toDatetimeLocal());
  const [closingKm, setClosingKm] = React.useState("");

  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const voucher = useQuery({
    queryKey: ["ledger", "voucher", existing.data?.journalEntry?.id],
    queryFn: () => ledgerApi.voucher(existing.data!.journalEntry!.id),
    enabled: voucherOpen && Boolean(existing.data?.journalEntry),
  });

  const jc: JobCard | undefined = existing.data;
  const isDraft = !jc || jc.status === "DRAFT";

  React.useEffect(() => {
    if (!jc) return;
    setBranchId(jc.branchId);
    setVehicleId(jc.vehicleId);
    setDriverId(jc.driverId);
    setTruckStatus(jc.truckStatus);
    setInDateTime(toDatetimeLocal(jc.inDateTime));
    setOpeningKm(String(jc.openingKm));
    setRemarks(jc.remarks ?? "");
    setPartLines(
      jc.partLines.map((l) => ({
        key: l.id,
        sparePartId: l.sparePartId,
        sparePartName: l.sparePart.name,
        batchId: l.batchId,
        batchNo: l.batch.batchNo ?? l.batch.id.slice(0, 6),
        sourceInvoiceNumber: null,
        unitCostPaise: l.unitCostPaise,
        mechanicId: l.mechanicId ?? "",
        qty: String(l.qty),
        description: l.description ?? "",
      })),
    );
    setServiceLines(
      jc.serviceLines.map((l) => ({
        key: l.id,
        serviceProviderId: l.serviceProviderId,
        serviceProviderName: l.serviceProvider.name,
        sparePartId: l.sparePartId,
        serviceName: l.sparePart.name,
        mechanicId: l.mechanicId ?? "",
        qty: String(l.qty),
        rate: String(Number(l.ratePaise) / 100),
        description: l.description ?? "",
      })),
    );
  }, [jc]);

  const buildBody = () => ({
    branchId,
    vehicleId,
    driverId,
    truckStatus,
    inDateTime: new Date(inDateTime).toISOString(),
    openingKm: Number(openingKm) || 0,
    remarks: remarks.trim() || undefined,
    partLines: partLines
      .filter((l) => l.sparePartId && l.batchId && Number(l.qty) > 0)
      .map((l) => ({
        sparePartId: l.sparePartId,
        batchId: l.batchId,
        mechanicId: l.mechanicId || undefined,
        qty: Number(l.qty),
        description: l.description.trim() || undefined,
      })),
    serviceLines: serviceLines
      .filter((l) => l.serviceProviderId && l.sparePartId && Number(l.qty) > 0 && Number(l.rate) > 0)
      .map((l) => ({
        serviceProviderId: l.serviceProviderId,
        sparePartId: l.sparePartId,
        mechanicId: l.mechanicId || undefined,
        qty: Number(l.qty),
        ratePaise: rupeesToPaise(Number(l.rate) || 0),
        description: l.description.trim() || undefined,
      })),
  });

  // A service line with a provider/service/qty but no rate would silently
  // save as ₹0 — block Save instead of accepting it.
  const hasIncompleteServiceLine = serviceLines.some(
    (l) => l.serviceProviderId && l.sparePartId && Number(l.qty) > 0 && !(Number(l.rate) > 0),
  );

  const canSave =
    Boolean(branchId) && Boolean(vehicleId) && Boolean(driverId) && Boolean(inDateTime) &&
    Boolean(openingKm) && !hasIncompleteServiceLine;

  const save = useMutation({
    mutationFn: () => (jobCardId ? jobCardApi.update(jobCardId, buildBody()) : jobCardApi.create(buildBody())),
    onSuccess: (saved) => {
      toast.success(jobCardId ? "Job card saved" : `Job card created — ${saved.jobCardNumber}`);
      queryClient.invalidateQueries({ queryKey: jobCardKeys.all });
      if (!jobCardId) router.push(`/workshop/job-cards/${saved.id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  // On a brand-new job card there's no id yet — create it first, then
  // finalise immediately, so the whole thing is one click instead of
  // "Save, wait, then Finalise on a second screen."
  const finalise = useMutation({
    mutationFn: async () => {
      const id = jobCardId ?? (await jobCardApi.create(buildBody())).id;
      return jobCardApi.finalise(id, {
        outDateTime: new Date(outDateTime).toISOString(),
        closingKm: Number(closingKm) || 0,
      });
    },
    onSuccess: (result) => {
      toast.success("Job card finalised — parts issued and posted");
      queryClient.invalidateQueries({ queryKey: jobCardKeys.all });
      if (!jobCardId) router.push(`/workshop/job-cards/${result.id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not finalise"),
  });

  const cancel = useMutation({
    mutationFn: () => jobCardApi.cancel(jobCardId!, "Cancelled by user"),
    onSuccess: () => {
      toast.success("Job card cancelled");
      queryClient.invalidateQueries({ queryKey: jobCardKeys.all });
      router.push("/workshop/job-cards");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not cancel"),
  });

  const undoFinalise = useMutation({
    mutationFn: (reason: string) => jobCardApi.undoFinalise(jobCardId!, reason),
    onSuccess: () => {
      toast.success("Finalise undone — stock and the voucher have been reversed");
      queryClient.invalidateQueries({ queryKey: jobCardKeys.all });
      queryClient.invalidateQueries({ queryKey: jobCardKeys.detail(jobCardId!) });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not undo finalise"),
  });

  // Server is the real gate (billing/removed-parts checks); this is just to
  // avoid offering a button that will predictably 400.
  const canUndoFinalise =
    jc?.status === "FINALISED" && jc.serviceLines.every((l) => !l.billedInServiceBillId);

  const handleUndoFinalise = () => {
    if (!jobCardId) return;
    const reason = window.prompt(
      "This reverses the stock issued and the posted voucher for this job card. Enter a reason to continue:",
    );
    if (!reason || !reason.trim()) return;
    if (!window.confirm("Undo finalise for this job card? This cannot be undone.")) return;
    undoFinalise.mutate(reason.trim());
  };

  if (jobCardId && existing.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {jobCardId ? jc?.jobCardNumber ?? "Job Card" : "New Job Card"}
          </h1>
          {jc && <p className="text-sm text-muted-foreground">Status: {jc.status}</p>}
        </div>
        <div className="flex gap-2">
          {jc?.journalEntry && (
            <Button variant="outline" onClick={() => setVoucherOpen(true)}>
              <IconFileInvoice size={15} className="mr-1" /> Voucher
            </Button>
          )}
          {isDraft && canManage && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={!jobCardId || cancel.isPending}
              onClick={() => jobCardId && cancel.mutate()}
            >
              Cancel job card
            </Button>
          )}
          {canUndoFinalise && canFinalise && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={undoFinalise.isPending}
              onClick={handleUndoFinalise}
            >
              {undoFinalise.isPending ? "Undoing..." : "Undo Finalise"}
            </Button>
          )}
        </div>
      </div>

      <fieldset disabled={!isDraft} className="space-y-4 disabled:opacity-70">
        <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Branch</label>
            <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
              {headOfficeBranch.data?.name ?? "—"}{" "}
              <span className="ml-1 text-xs">(single workshop — fixed)</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Truck status</label>
            <Select value={truckStatus} onValueChange={(v) => setTruckStatus(v as TruckLocationStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AT_HO">At HO</SelectItem>
                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Vehicle</label>
            <Combobox
              options={(vehicles.data ?? []).map((v) => ({ value: v.value, label: v.label }))}
              value={vehicleId}
              onChange={(v) => {
                setVehicleId(v);
                const picked = vehicles.data?.find((x) => x.value === v);
                if (picked) setOpeningKm(String(picked.currentKm));
              }}
              placeholder="Search vehicle number..."
              searchPlaceholder="Type to search..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Driver</label>
            <Combobox
              options={drivers.data ?? []}
              value={driverId}
              onChange={setDriverId}
              placeholder="Search driver name..."
              searchPlaceholder="Type to search..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">In date/time</label>
            <Input type="datetime-local" value={inDateTime} onChange={(e) => setInDateTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Opening KM</label>
            <Input inputMode="numeric" value={openingKm} onChange={(e) => setOpeningKm(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Out date/time <span className="text-muted-foreground">(for Finalise)</span>
            </label>
            <Input type="datetime-local" value={outDateTime} onChange={(e) => setOutDateTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Closing KM <span className="text-muted-foreground">(for Finalise)</span>
            </label>
            <Input inputMode="numeric" value={closingKm} onChange={(e) => setClosingKm(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <label className="text-sm font-medium">
              Remarks <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="resize-none" />
          </div>
        </div>

        <div className="rounded-md border">
          <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">Part List</div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">SN</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Batch No</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Mechanic</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {partLines.map((line, i) => (
                <TableRow key={line.key}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{line.sourceInvoiceNumber ?? "—"}</TableCell>
                  <TableCell>{line.sparePartName}</TableCell>
                  <TableCell>{line.batchNo || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.qty}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(line.unitCostPaise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(Number(line.unitCostPaise) * (Number(line.qty) || 0))}
                  </TableCell>
                  <TableCell>{mechanics.data?.find((m) => m.value === line.mechanicId)?.label ?? "—"}</TableCell>
                  <TableCell>{line.description || "—"}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPartLines((p) => p.filter((l) => l.key !== line.key))}
                      title="Remove part"
                    >
                      <IconTrash size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {partLines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">
                    No parts added yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="border-t bg-muted/20 px-3 py-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!branchId}
              onClick={() => setAddPartOpen(true)}
            >
              <IconPlus size={15} className="mr-1" />
              Add Part
            </Button>
          </div>
        </div>

        <AddPartDialog
          open={addPartOpen}
          onOpenChange={setAddPartOpen}
          branchId={branchId}
          mechanics={mechanics.data ?? []}
          onAdd={(lines) => setPartLines((prev) => [...prev, ...lines])}
        />

        <div className="rounded-md border">
          <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">
            Services{" "}
            <span className="font-normal text-muted-foreground">(outside / sublet work)</span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">SN</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Mechanic</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceLines.map((line, i) => (
                <TableRow key={line.key}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{line.serviceProviderName}</TableCell>
                  <TableCell>{line.serviceName}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.qty}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(rupeesToPaise(Number(line.rate) || 0))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(rupeesToPaise(Number(line.rate) || 0) * (Number(line.qty) || 0))}
                  </TableCell>
                  <TableCell>{mechanics.data?.find((m) => m.value === line.mechanicId)?.label ?? "—"}</TableCell>
                  <TableCell>{line.description || "—"}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setServiceLines((p) => p.filter((l) => l.key !== line.key))}
                      title="Remove service"
                    >
                      <IconTrash size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {serviceLines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                    No outside services added.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="border-t bg-muted/20 px-3 py-2.5">
            <Button type="button" variant="outline" size="sm" onClick={() => setAddServiceOpen(true)}>
              <IconPlus size={15} className="mr-1" />
              Add Service
            </Button>
          </div>
        </div>

        <AddServiceDialog
          open={addServiceOpen}
          onOpenChange={setAddServiceOpen}
          mechanics={mechanics.data ?? []}
          onAdd={(line) => setServiceLines((prev) => [...prev, line])}
        />

        {canManage && (
          <div className="flex items-center justify-end gap-2">
            <p className="mr-auto text-xs text-muted-foreground">
              Save keeps it a draft — nothing moves yet. Finalise issues the parts above from
              stock and posts the voucher; needs Closing KM and Out date/time filled in above.
            </p>
            <Button variant="outline" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
            {canFinalise && (
              <Button
                disabled={!canSave || !outDateTime || !closingKm || finalise.isPending}
                onClick={() => finalise.mutate()}
              >
                {finalise.isPending ? "Finalising..." : "Finalise"}
              </Button>
            )}
          </div>
        )}
      </fieldset>

      {jc?.journalEntry && (
        <VoucherDialog
          open={voucherOpen}
          onOpenChange={setVoucherOpen}
          voucher={voucher.data}
          isLoading={voucher.isLoading}
          isError={voucher.isError}
          errorMessage={voucher.error instanceof Error ? voucher.error.message : undefined}
        />
      )}
    </div>
  );
}

