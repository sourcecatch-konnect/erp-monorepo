"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconFileInvoice,
  IconEdit,
  IconPlus,
} from "@tabler/icons-react";
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
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";
import { DetailSection } from "@/features/masters/_shared/DetailSection";
import { jobCardApi, type RemovedPartCondition } from "./api/job-card.service";
import { jobCardKeys } from "./api/job-card.keys";
import { JobCardStatusBadge } from "./jobCardStatusBadge";
import { useRemovedParts } from "./useRemovedParts";
import { RemovedPartActions } from "./components/RemovedPartActions";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";

const CONDITION_LABELS: Record<RemovedPartCondition, string> = {
  REUSABLE: "Reusable",
  REPAIRABLE: "Repairable",
  SCRAP: "Scrap",
};

type RemovedPartDraft = {
  custodyLocation: string;
  provenanceReference: string;
  sparePartId: string;
  sparePartLabel: string;
  relatedPartLineId: string;
  qty: string;
  condition: RemovedPartCondition;
  unitCost: string;
  remarks: string;
};

/** Job Card detail — a proper read-only summary with its own action buttons,
 *  the same pattern every other workshop module (Purchase Order, Service
 *  Bill, Supplier Replacement) already has. A DRAFT job card still routes to
 *  the editable form instead (see the [id] page) — this page is for once
 *  there's something real to look at: FINALISED or CANCELLED. */
export function JobCardDetailPage({ jobCardId }: { jobCardId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManage = useCan(PERMS.WORKSHOP.JOBCARD_MANAGE);
  const canFinalise = useCan(PERMS.WORKSHOP.JOBCARD_FINALISE);

  const jc = useQuery({
    queryKey: jobCardKeys.detail(jobCardId),
    queryFn: () => jobCardApi.get(jobCardId),
  });

  const {
    query: removedParts,
    search: returnSearch,
    setSearch: setReturnSearch,
    page: returnPage,
    setPage: setReturnPage,
    size: returnSize,
    setSize: setReturnSize,
  } = useRemovedParts(jobCardId);
  const removedRequestId = React.useRef<string | null>(null);

  const [voucherOpen, setVoucherOpen] = React.useState(false);
  const [voucherId, setVoucherId] = React.useState<string | null>(null);
  const voucher = useQuery({
    queryKey: ["ledger", "voucher", voucherId],
    queryFn: () => ledgerApi.voucher(voucherId!),
    enabled: voucherOpen && Boolean(voucherId),
  });

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const [removedPartOpen, setRemovedPartOpen] = React.useState(false);
  const [removedPartSearch, setRemovedPartSearch] = React.useState("");
  const debouncedRemovedPartSearch = useDebouncedValue(removedPartSearch, 300);
  const [removedPartDraft, setRemovedPartDraft] =
    React.useState<RemovedPartDraft>({
      custodyLocation: "",
      provenanceReference: "",
      sparePartId: "",
      sparePartLabel: "",
      relatedPartLineId: "",
      qty: "",
      condition: "REUSABLE",
      unitCost: "",
      remarks: "",
    });

  const sparePartOptions = useQuery({
    queryKey: ["job-card", "spare-parts-any", debouncedRemovedPartSearch],
    queryFn: () =>
      jobCardApi.spareParts({
        type: "Item",
        search: debouncedRemovedPartSearch,
        page: 0,
        size: 20,
      }),
    enabled: removedPartOpen,
  });

  const finalise = useMutation({
    mutationFn: () =>
      jobCardApi.finalise(jobCardId, {
        outDateTime: new Date().toISOString(),
        closingKm: jc.data?.openingKm ?? 0,
      }),
    onSuccess: () => {
      toast.success("Job card finalised — parts issued and posted");
      queryClient.invalidateQueries({ queryKey: jobCardKeys.all });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not finalise",
      ),
  });

  const cancel = useMutation({
    mutationFn: () => jobCardApi.cancel(jobCardId, cancelReason.trim()),
    onSuccess: () => {
      toast.success("Job card cancelled");
      queryClient.invalidateQueries({ queryKey: jobCardKeys.all });
      setCancelOpen(false);
      setCancelReason("");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not cancel"),
  });

  const undoFinalise = useMutation({
    mutationFn: (reason: string) => jobCardApi.undoFinalise(jobCardId, reason),
    onSuccess: () => {
      toast.success(
        "Finalise undone — stock and the voucher have been reversed",
      );
      queryClient.invalidateQueries({ queryKey: jobCardKeys.all });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not undo finalise",
      ),
  });

  const resetRemovedPartForm = () => {
    removedRequestId.current = null;
    setRemovedPartSearch("");
    setRemovedPartDraft({
      custodyLocation: "",
      provenanceReference: "",
      sparePartId: "",
      sparePartLabel: "",
      relatedPartLineId: "",
      qty: "",
      condition: "REUSABLE",
      unitCost: "",
      remarks: "",
    });
  };

  const addRemovedPart = useMutation({
    mutationFn: () =>
      jobCardApi.addRemovedPart(jobCardId, {
        clientRequestId: (removedRequestId.current ??= crypto.randomUUID()),
        sparePartId: removedPartDraft.sparePartId,
        custodyLocation: removedPartDraft.custodyLocation.trim(),
        provenanceReference: removedPartDraft.provenanceReference.trim(),
        relatedPartLineId: removedPartDraft.relatedPartLineId || undefined,
        qty: Number(removedPartDraft.qty),
        condition: removedPartDraft.condition,
        unitCostPaise:
          removedPartDraft.condition === "REUSABLE" && removedPartDraft.unitCost
            ? rupeesToPaise(Number(removedPartDraft.unitCost))
            : undefined,
        remarks: removedPartDraft.remarks.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Removed part logged");
      setReturnPage(0);
      queryClient.invalidateQueries({
        queryKey: jobCardKeys.removedParts(jobCardId),
      });
      queryClient.invalidateQueries({ queryKey: jobCardKeys.all });
      setRemovedPartOpen(false);
      resetRemovedPartForm();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not log part",
      ),
  });

  const canAddRemovedPart =
    jc.data?.status === "FINALISED" &&
    Boolean(removedPartDraft.sparePartId) &&
    Boolean(removedPartDraft.custodyLocation.trim()) && Boolean(removedPartDraft.provenanceReference.trim()) &&
    Number.isInteger(Number(removedPartDraft.qty)) &&
    Number(removedPartDraft.qty) > 0 &&
    (removedPartDraft.condition !== "REUSABLE" ||
      (removedPartDraft.unitCost.trim()
        ? Number(removedPartDraft.unitCost) > 0
        : Boolean(
            jc.data.partLines.find(
              (line) =>
                line.id === removedPartDraft.relatedPartLineId &&
                BigInt(line.unitCostPaise) > 0n,
            ),
          )));

  if (jc.isLoading) {
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

  if (!jc.data) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/workshop/job-cards")}
        >
          <IconArrowLeft size={15} className="mr-1" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Job card not found.</p>
      </div>
    );
  }

  const card = jc.data;
  const canFinaliseNow =
    card.status === "DRAFT" &&
    (card.partLines.length > 0 || card.serviceLines.length > 0) &&
    canFinalise;
  const canCancel = card.status === "DRAFT" && canManage;
  const canUndoFinalise =
    card.status === "FINALISED" &&
    card.serviceLines.every((l) => !l.billedInServiceBillId) &&
    canFinalise;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/workshop/job-cards")}
          >
            <IconArrowLeft size={15} className="mr-1" /> Back to list
          </Button>
          <p className="text-xs font-medium text-muted-foreground">Job Card</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {card.jobCardNumber ?? "Job Card"}
            </h1>
            <JobCardStatusBadge status={card.status} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{card.vehicle.vehicleNumber}</span>
            <span>·</span>
            <span>{card.driver.name}</span>
            <span>·</span>
            <span>{new Date(card.inDateTime).toLocaleString("en-IN")}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {card.journalEntry && (
            <Button
              variant="outline"
              onClick={() => {
                setVoucherId(card.journalEntry!.id);
                setVoucherOpen(true);
              }}
            >
              <IconFileInvoice size={15} className="mr-1" /> Voucher
            </Button>
          )}
          {card.status === "DRAFT" && canManage && (
            <Button variant="outline" asChild>
              <Link href={`/workshop/job-cards/${card.id}/edit`}>
                <IconEdit size={15} className="mr-1" /> Edit
              </Link>
            </Button>
          )}
          {canFinaliseNow && (
            <Button
              disabled={finalise.isPending}
              onClick={() => finalise.mutate()}
            >
              {finalise.isPending ? "Finalising..." : "Finalise"}
            </Button>
          )}
          {canUndoFinalise && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={undoFinalise.isPending}
              onClick={() => {
                const reason = window.prompt(
                  "This reverses the stock issued and the posted voucher for this job card. Enter a reason to continue:",
                );
                if (!reason || !reason.trim()) return;
                if (
                  !window.confirm(
                    "Undo finalise for this job card? This cannot be undone.",
                  )
                )
                  return;
                undoFinalise.mutate(reason.trim());
              }}
            >
              {undoFinalise.isPending ? "Undoing..." : "Undo Finalise"}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              Cancel job card
            </Button>
          )}
        </div>
      </div>

      <DetailSection
        title="Job Details"
        contentClassName="grid gap-4 p-4 sm:grid-cols-4"
      >
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Branch</p>
          <p className="text-sm">
            {card.branch.name}{" "}
            <span className="text-xs text-muted-foreground">(HO — fixed)</span>
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Vehicle</p>
          <p className="text-sm">{card.vehicle.vehicleNumber}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Driver</p>
          <p className="text-sm">{card.driver.name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Truck status
          </p>
          <p className="text-sm">
            {card.truckStatus === "AT_HO" ? "At HO" : "In Transit"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            In date/time
          </p>
          <p className="text-sm">
            {new Date(card.inDateTime).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Out date/time
          </p>
          <p className="text-sm text-muted-foreground">
            {card.outDateTime
              ? new Date(card.outDateTime).toLocaleString("en-IN")
              : "—"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Opening KM
          </p>
          <p className="text-sm">{card.openingKm.toLocaleString("en-IN")}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Closing KM
          </p>
          <p className="text-sm text-muted-foreground">
            {card.closingKm !== null
              ? card.closingKm.toLocaleString("en-IN")
              : "—"}
          </p>
        </div>
        {card.remarks && (
          <div className="space-y-1 sm:col-span-4">
            <p className="text-xs font-medium text-muted-foreground">Remarks</p>
            <p className="text-sm text-muted-foreground">{card.remarks}</p>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Part List">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">SN</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Mechanic</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {card.partLines.map((line, i) => (
                <TableRow key={line.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{line.sparePart.name}</TableCell>
                  <TableCell>
                    {line.batch.batchNo ?? line.batch.id.slice(0, 6)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.qty}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(line.unitCostPaise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(line.amountPaise)}
                  </TableCell>
                  <TableCell>{line.mechanic?.name ?? "—"}</TableCell>
                  <TableCell>{line.description ?? "—"}</TableCell>
                </TableRow>
              ))}
              {card.partLines.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    No parts on this job card.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {card.partLines.length > 0 && (
          <div className="flex justify-end border-t bg-muted/20 px-4 py-2.5 text-sm">
            Total parts{" "}
            <span className="ml-1 font-semibold tabular-nums">
              {formatPaise(card.totalPartsAmountPaise)}
            </span>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Services" contentClassName="">
        <div className="overflow-x-auto">
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
                <TableHead>Billed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {card.serviceLines.map((line, i) => (
                <TableRow key={line.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{line.serviceProvider.name}</TableCell>
                  <TableCell>
                    {line.sparePart.name}
                    {line.description && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({line.description})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.qty}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(line.ratePaise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(line.amountPaise)}
                  </TableCell>
                  <TableCell>{line.mechanic?.name ?? "—"}</TableCell>
                  <TableCell>
                    {line.billedInServiceBillId ? (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400">
                        Billed
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not billed
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {card.serviceLines.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    No outside services on this job card.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {card.serviceLines.length > 0 && (
          <div className="flex justify-end border-t bg-muted/20 px-4 py-2.5 text-sm">
            Total services{" "}
            <span className="ml-1 font-semibold tabular-nums">
              {formatPaise(card.totalServiceAmountPaise)}
            </span>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Removed Parts">
        <div className="border-b p-3">
          <Input
            aria-label="Search removed parts"
            value={returnSearch}
            maxLength={200}
            placeholder="Search part or remarks..."
            onChange={(event) => setReturnSearch(event.target.value)}
            className="max-w-sm"
          />
        </div>
        {card.status === "FINALISED" && canManage && (
          <div className="border-b px-4 py-2.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                resetRemovedPartForm();
                setRemovedPartOpen(true);
              }}
            >
              <IconPlus size={15} className="mr-1" /> Log Removed Part
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">SN</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Voucher</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {removedParts.data?.data.map((part, i) => (
                <TableRow key={part.id}>
                  <TableCell>{returnPage * returnSize + i + 1}</TableCell>
                  <TableCell>{part.sparePart.name}</TableCell>
                  <TableCell>{CONDITION_LABELS[part.condition]}<p className="text-xs text-muted-foreground">{part.lifecycleStatus.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{part.custodyLocation}</p></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {part.qty}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {part.unitCostPaise ? formatPaise(part.unitCostPaise) : "—"}
                  </TableCell>
                  <TableCell>{part.remarks ?? "—"}</TableCell>
                  <TableCell>
                    <RemovedPartActions jobCardId={jobCardId} part={part} />
                    {part.journalEntry && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setVoucherId(part.journalEntry!.id);
                          setVoucherOpen(true);
                        }}
                      >
                        Voucher
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!removedParts.isLoading &&
                !removedParts.isError &&
                (removedParts.data?.data.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      No parts removed from this vehicle recorded yet.
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </div>
        {removedParts.isLoading && (
          <p role="status" className="p-3 text-sm text-muted-foreground">
            Loading removed parts...
          </p>
        )}
        {removedParts.isError && (
          <p role="alert" className="p-3 text-sm text-destructive">
            Could not load removed parts.{" "}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void removedParts.refetch()}
            >
              Retry
            </Button>
          </p>
        )}
        {removedParts.data && (
          <TablePaginationFooter
            total={removedParts.data.meta?.total ?? 0}
            page={returnPage}
            size={returnSize}
            onPageChange={setReturnPage}
            onSizeChange={setReturnSize}
          />
        )}
      </DetailSection>

      {
        <VoucherDialog
          open={voucherOpen}
          onOpenChange={setVoucherOpen}
          voucher={voucher.data}
          isLoading={voucher.isLoading}
          isError={voucher.isError}
          errorMessage={
            voucher.error instanceof Error ? voucher.error.message : undefined
          }
        />
      }

      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => !open && setCancelOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {card.jobCardNumber}?</DialogTitle>
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

      <Dialog
        open={removedPartOpen}
        onOpenChange={(open) => {
          if (addRemovedPart.isPending) return;
          setRemovedPartOpen(open);
          if (!open) resetRemovedPartForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Removed Part</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            A part taken off this vehicle during the job — reusable parts go
            back to stock, repairable/scrap parts are recorded without changing
            usable stock or accounts.
          </p>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Part</label>
              <Combobox
                options={sparePartOptions.data?.data ?? []}
                value={removedPartDraft.sparePartId}
                onChange={(v) => {
                  const picked = sparePartOptions.data?.data.find(
                    (p) => p.value === v,
                  );
                  setRemovedPartDraft((prev) => ({
                    ...prev,
                    sparePartId: v,
                    sparePartLabel: picked?.label ?? "",
                    relatedPartLineId: "",
                  }));
                }}
                searchValue={removedPartSearch}
                onSearchChange={setRemovedPartSearch}
                placeholder="Search part..."
                searchPlaceholder="Type to search..."
                emptyText={
                  sparePartOptions.isLoading
                    ? "Loading parts..."
                    : "No parts found"
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Qty</label>
                <Input
                  inputMode="numeric"
                  value={removedPartDraft.qty}
                  onChange={(e) =>
                    setRemovedPartDraft((prev) => ({
                      ...prev,
                      qty: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Condition</label>
                <Select
                  value={removedPartDraft.condition}
                  onValueChange={(v) =>
                    setRemovedPartDraft((prev) => ({
                      ...prev,
                      condition: v as RemovedPartCondition,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REUSABLE">Reusable</SelectItem>
                    <SelectItem value="REPAIRABLE">Repairable</SelectItem>
                    <SelectItem value="SCRAP">Scrap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Original issue line (optional)
              </label>
              <Select
                value={removedPartDraft.relatedPartLineId || "NONE"}
                onValueChange={(value) =>
                  setRemovedPartDraft((previous) => ({
                    ...previous,
                    relatedPartLineId: value === "NONE" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No linked issue line</SelectItem>
                  {card.partLines
                    .filter(
                      (line) =>
                        line.sparePartId === removedPartDraft.sparePartId,
                    )
                    .map((line) => (
                      <SelectItem key={line.id} value={line.id}>
                        Batch {line.batch.batchNo ?? line.batchId} · Issued{" "}
                        {line.qty}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {removedPartDraft.condition === "REUSABLE" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Proposed recoverable value per unit (₹){" "}
                  <span className="text-muted-foreground">
                    (uses linked issue cost if blank)
                  </span>
                </label>
                <Input
                  inputMode="decimal"
                  value={removedPartDraft.unitCost}
                  onChange={(e) =>
                    setRemovedPartDraft((prev) => ({
                      ...prev,
                      unitCost: e.target.value,
                    }))
                  }
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Logging does not add usable stock. A separate approver must confirm recoverable value before stock and the return voucher are posted.</p>
            <label className="space-y-1.5 text-sm font-medium">Current custody location<Input maxLength={200} value={removedPartDraft.custodyLocation} onChange={(event) => setRemovedPartDraft((old) => ({ ...old, custodyLocation: event.target.value }))} /></label>
            <label className="space-y-1.5 text-sm font-medium">Provenance / inspection reference<Input maxLength={500} value={removedPartDraft.provenanceReference} onChange={(event) => setRemovedPartDraft((old) => ({ ...old, provenanceReference: event.target.value }))} /></label>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Remarks{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                rows={2}
                value={removedPartDraft.remarks}
                onChange={(e) =>
                  setRemovedPartDraft((prev) => ({
                    ...prev,
                    remarks: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetRemovedPartForm();
                setRemovedPartOpen(false);
              }}
            >
              Back
            </Button>
            <Button
              disabled={!canAddRemovedPart || addRemovedPart.isPending}
              onClick={() => addRemovedPart.mutate()}
            >
              {addRemovedPart.isPending ? "Saving..." : "Log part"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
