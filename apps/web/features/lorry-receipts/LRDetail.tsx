"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  IconArrowLeft,
  IconTruck,
  IconUsers,
  IconCoin,
  IconRouteOff,
  IconPlus,
  IconPencil,
  IconTrash,
  IconAlertTriangle,
  IconCircleCheck,
} from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { attachmentApi } from "@/features/attachments/attachment.client";
import { formatPaise, paiseToRupees } from "@/lib/money";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { lrGroupApi } from "./lr-group.service";
import { lrGroupKeys } from "./lr-group.keys";
import { lorryReceiptApi } from "./lorry-receipt.service";
import { LRStatusBadge, SOURCE_LABELS, daysSince } from "./lorry-receipt-ui";
import FinaliseDialog from "./components/FinaliseDialog";
import SplitAtHubDialog from "./components/SplitAtHubDialog";
import EwayBillSection from "./components/EwayBillSection";
import EditGroupDialog from "./components/EditGroupDialog";
import LRLineDialog, { type LinePayload } from "./components/LRLineDialog";
import DeliverDialog from "./components/DeliverDialog";
import BulkDeliverDialog from "./components/BulkDeliverDialog";
import AcknowledgeDialog from "./components/AcknowledgeDialog";
import DeliverySection, {
  DELIVERY_POD_ENTITY,
  ACK_SCAN_ENTITY,
} from "./components/DeliverySection";
import LRTimeline from "./components/LRTimeline";
import type {
  LRGroup,
  LorryReceipt,
  DeliverLRFormInput,
  AcknowledgeLRFormInput,
  DeliverGroupFormInput,
} from "@skerp/types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}
function getMissingLRFields(lr: LorryReceipt): string[] {
  const missing: string[] = [];

  if (!lr.loadingLocationId) missing.push("Loading point");
  if (!lr.unloadingLocationId) missing.push("Unloading point");
  if (lr.goods.length === 0) missing.push("Goods");
  if (lr.totalWeight == null) missing.push("Total weight");
  if (!lr.unit) missing.push("Weight unit");

  return missing;
}
export default function LRDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [finaliseOpen, setFinaliseOpen] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [editGroupOpen, setEditGroupOpen] = React.useState(false);
  const [addLineOpen, setAddLineOpen] = React.useState(false);
  const [editLine, setEditLine] = React.useState<
    LRGroup["lorryReceipts"][number] | null
  >(null);
  const [bulkDeliverOpen, setBulkDeliverOpen] = React.useState(false);
  const [deliverLr, setDeliverLr] = React.useState<LorryReceipt | null>(null);
  const [editDeliveryLr, setEditDeliveryLr] =
    React.useState<LorryReceipt | null>(null);
  const [ackLr, setAckLr] = React.useState<LorryReceipt | null>(null);
  const [editAckLr, setEditAckLr] = React.useState<LorryReceipt | null>(null);

  const canApprove = useCan(PERMS.LORRY_RECEIPT.APPROVE);
  const canCancel = useCan(PERMS.LORRY_RECEIPT.CANCEL);
  const canUpdate = useCan(PERMS.LORRY_RECEIPT.UPDATE);
  const canDeliver = useCan(PERMS.LORRY_RECEIPT.DELIVER);
  const canAcknowledge = useCan(PERMS.LORRY_RECEIPT.ACKNOWLEDGE);

  const group = useQuery({
    queryKey: lrGroupKeys.detail(id),
    queryFn: () => lrGroupApi.detail(id),
  });
  const actionGroupId = group.data?.id ?? id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: lrGroupKeys.detail(id) });
    if (actionGroupId !== id) {
      queryClient.invalidateQueries({
        queryKey: lrGroupKeys.detail(actionGroupId),
      });
    }
    queryClient.invalidateQueries({ queryKey: lrGroupKeys.all });
  };

  const finalise = useMutation({
    mutationFn: (body: Parameters<typeof lrGroupApi.finalise>[1]) =>
      lrGroupApi.finalise(actionGroupId, body),
    onSuccess: () => {
      toast.success("Group finalised");
      setFinaliseOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const holdAtHub = useMutation({
    mutationFn: () => lrGroupApi.holdAtHub(actionGroupId),
    onSuccess: () => {
      toast.success("Group held at hub — leg-1 trip can now be closed");
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const dispatchFromHub = useMutation({
    mutationFn: (secondaryTripId: string) =>
      lrGroupApi.dispatchFromHub(actionGroupId, { secondaryTripId }),
    onSuccess: () => {
      toast.success("Leg 2 trip attached");
      setSplitOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uploadFiles = async (
    entityType: string,
    entityId: string,
    files: File[],
  ) => {
    if (files.length === 0) return;
    try {
      await Promise.all(
        files.map((file) =>
          attachmentApi.upload(
            {
              entityType,
              entityId,
              originalName: file.name,
              mime: file.type || "application/octet-stream",
              sizeBytes: file.size,
            },
            file,
          ),
        ),
      );
    } catch (err) {
      toast.error(
        `Record saved, but a file upload failed: ${getErrorMessage(err)}`,
      );
    }
  };

  const deliver = useMutation({
    mutationFn: async (vars: {
      lrId: string;
      values: DeliverLRFormInput;
      podFiles: File[];
    }) => {
      const delivery = await lorryReceiptApi.deliver(vars.lrId, vars.values);
      await uploadFiles(DELIVERY_POD_ENTITY, delivery.id, vars.podFiles);
      return delivery;
    },
    onSuccess: () => {
      toast.success("LR marked delivered");
      setDeliverLr(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateDelivery = useMutation({
    mutationFn: (vars: { lrId: string; values: DeliverLRFormInput }) =>
      lorryReceiptApi.updateDelivery(vars.lrId, vars.values),
    onSuccess: () => {
      toast.success("Delivery updated");
      setEditDeliveryLr(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const undoDelivery = useMutation({
    mutationFn: (lrId: string) => lorryReceiptApi.undoDelivery(lrId),
    onSuccess: () => {
      toast.success("Delivery undone");
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const acknowledge = useMutation({
    mutationFn: async (vars: {
      lrId: string;
      values: AcknowledgeLRFormInput;
      scanFiles: File[];
    }) => {
      const ack = await lorryReceiptApi.acknowledge(vars.lrId, vars.values);
      await uploadFiles(ACK_SCAN_ENTITY, ack.id, vars.scanFiles);
      return ack;
    },
    onSuccess: () => {
      toast.success("POD acknowledged");
      setAckLr(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateAcknowledgement = useMutation({
    mutationFn: (vars: { lrId: string; values: AcknowledgeLRFormInput }) =>
      lorryReceiptApi.updateAcknowledgement(vars.lrId, vars.values),
    onSuccess: () => {
      toast.success("Acknowledgement updated");
      setEditAckLr(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const undoAcknowledgement = useMutation({
    mutationFn: (lrId: string) => lorryReceiptApi.undoAcknowledgement(lrId),
    onSuccess: () => {
      toast.success("Acknowledgement undone");
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deliverAll = useMutation({
    mutationFn: (values: DeliverGroupFormInput) =>
      lrGroupApi.deliverAll(actionGroupId, values),
    onSuccess: () => {
      toast.success("LRs marked delivered");
      setBulkDeliverOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) =>
      lrGroupApi.cancel(actionGroupId, { cancelReason: reason }),
    onSuccess: () => {
      toast.success("Group cancelled");
      setCancelOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateGroup = useMutation({
    mutationFn: (body: Parameters<typeof lrGroupApi.update>[1]) =>
      lrGroupApi.update(actionGroupId, body),
    onSuccess: () => {
      toast.success("Group updated");
      setEditGroupOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addLine = useMutation({
    mutationFn: (payload: LinePayload) =>
      lrGroupApi.addLorryReceipt(actionGroupId, {
        loadingLocationId: payload.loadingLocationId,
        unloadingLocationId: payload.unloadingLocationId,
        totalWeight: payload.totalWeight,
        totalWeightUnit: payload.totalWeightUnit,
        goods: payload.goods,
      }),
    onSuccess: () => {
      toast.success("LR added");
      setAddLineOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateLine = useMutation({
    mutationFn: (vars: { lrId: string; payload: LinePayload }) =>
      lorryReceiptApi.update(vars.lrId, {
        loadingLocationId: vars.payload.loadingLocationId,
        unloadingLocationId: vars.payload.unloadingLocationId,
        totalWeight: vars.payload.totalWeight,
        totalWeightUnit: vars.payload.totalWeightUnit,
        goods: vars.payload.goods,
        invoiceNumber: vars.payload.invoiceNumber,
        invoiceAmount: vars.payload.invoiceAmount,
      }),
    onSuccess: () => {
      toast.success("LR updated");
      setEditLine(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const removeLine = useMutation({
    mutationFn: (lrId: string) => lorryReceiptApi.remove(lrId),
    onSuccess: () => {
      toast.success("LR removed");
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (group.isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!group.data) {
    return (
      <div className="flex flex-col items-center gap-2 p-16 text-muted-foreground">
        <IconRouteOff size={24} />
        <p className="text-sm">LR group not found.</p>
        <Button
          variant="outline"
          onClick={() => router.push("/lorry-receipts")}
        >
          Back to list
        </Button>
      </div>
    );
  }

  const g = group.data;
  const hasNoLrs = g.lorryReceipts.length === 0;
  const hasDeliveredLr = g.lorryReceipts.some((lr) => Boolean(lr.delivery));

const incompleteLrs = g.lorryReceipts
  .map((lr) => ({
    id: lr.id,
    lrNumber: lr.lrNumber,
    missingFields: getMissingLRFields(lr),
  }))
  .filter((lr) => lr.missingFields.length > 0);

const hasIncompleteLr = incompleteLrs.length > 0;
const cannotFinalise = hasNoLrs || hasIncompleteLr;

const finaliseTitle = hasNoLrs
  ? "Add at least one consignment LR before finalising."
  : incompleteLrs
      .map(
        (lr) => `${lr.lrNumber}: ${lr.missingFields.join(", ")}`,
      )
      .join(" | ");
  const vehicle = g.isMarketVehicle
    ? (g.marketVehicleNumber ?? "Market vehicle")
    : (g.primaryTrip?.vehicle?.vehicleNumber ?? "—");

  const pendingLrs = g.lorryReceipts.filter((lr) => lr.status === "FINALISED");
  const heldAtHub =
    g.status === "FINALISED" &&
    Boolean(g.hubId) &&
    !g.secondaryTripId &&
    !hasDeliveredLr;
  const canHoldAtHub =
    g.status === "FINALISED" &&
    !hasDeliveredLr &&
    !g.hubId &&
    !g.secondaryTripId;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => router.push("/lorry-receipts")}
          >
            <IconArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{g.groupNumber}</h1>
              <LRStatusBadge status={g.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {SOURCE_LABELS[g.source]} · {g.lorryReceipts.length} LR
              {g.lorryReceipts.length === 1 ? "" : "s"}
              {g.order ? ` · ${g.order.orderNumber}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {g.status === "DRAFT" && canUpdate && (
            <Button variant="outline" onClick={() => setEditGroupOpen(true)}>
              Edit group
            </Button>
          )}
          {g.status === "DRAFT" && canApprove && (
            <Button
              onClick={() => setFinaliseOpen(true)}
       
              title={finaliseTitle}
            >
              Finalise group
            </Button>
          )}
          {g.status === "FINALISED" && canDeliver && pendingLrs.length > 0 && (
            <Button onClick={() => setBulkDeliverOpen(true)}>
              Deliver all
            </Button>
          )}
          {g.status === "FINALISED" && canApprove && canHoldAtHub && (
            <Button
              variant="outline"
              disabled={holdAtHub.isPending}
              onClick={() => holdAtHub.mutate()}
            >
              {holdAtHub.isPending ? "Holding…" : "Hold at hub"}
            </Button>
          )}
          {g.status === "FINALISED" && canApprove && heldAtHub && (
            <Button variant="outline" onClick={() => setSplitOpen(true)}>
              Dispatch from hub
            </Button>
          )}
          {g.status === "DRAFT" && canCancel && (
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setCancelOpen(true)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

     {cannotFinalise && (
  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    <IconAlertTriangle size={17} className="mt-0.5 shrink-0" />

    <div className="space-y-1">
      {hasNoLrs ? (
        <p>Add at least one consignment LR before finalising this group.</p>
      ) : (
        <>
          <p className="font-medium">
            The following LR information is missing:
          </p>

          <ul className="list-disc space-y-1 pl-5">
            {incompleteLrs.map((lr) => (
              <li key={lr.id}>
                <span className="font-semibold">{lr.lrNumber}</span>
                {" — "}
                {lr.missingFields.join(", ")}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  </div>
)}
      {g.status === "DELIVERED" && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <IconCircleCheck size={17} className="mt-0.5 shrink-0" />
          <p>
            All {g.lorryReceipts.length} LR
            {g.lorryReceipts.length === 1 ? " is" : "s are"} delivered. This
            group is complete and can no longer be held at or dispatched from a
            hub.
          </p>
        </div>
      )}

      {heldAtHub && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <IconTruck size={17} className="mt-0.5 shrink-0" />
          <p>
            Lying at hub {g.hub?.name ? `(${g.hub.name})` : ""}
            {g.hubArrivalAt
              ? ` since ${new Date(g.hubArrivalAt).toLocaleDateString()} — ${daysSince(g.hubArrivalAt)} day(s)`
              : ""}
            . Awaiting leg-2 dispatch to{" "}
            {g.destinationBranch?.name ?? "destination"}.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <IconUsers size={13} /> Parties
          </p>
          <div className="space-y-3">
            <Field label="Consignor" value={g.consignor?.name} />
            <Field label="Consignee" value={g.consignee?.name} />
            <Field
              label="Route"
              value={`${g.originBranch?.name ?? "—"} → ${g.destinationBranch?.name ?? "—"}`}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <IconTruck size={13} /> Vehicle & transport
          </p>
          <div className="space-y-3">
            <Field label="Vehicle" value={vehicle} />
            <Field label="Transport" value={g.transportType} />
            <Field label="Trip" value={g.primaryTrip?.tripName} />
            {g.secondaryTrip && (
              <Field label="Leg 2 trip" value={g.secondaryTrip.tripName} />
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <IconCoin size={13} /> Freight & seal
          </p>
          <div className="space-y-3">
            <Field
              label="Base freight"
              value={
                g.baseFreightAmount != null
                  ? formatPaise(g.baseFreightAmount)
                  : "—"
              }
            />
            <Field label="Seal number" value={g.sealNumber} />
            <Field label="Priority" value={g.priority} />
          </div>
        </div>
      </div>

      {/* Lorry receipts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Lorry receipts</p>
          {g.status === "DRAFT" && canUpdate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddLineOpen(true)}
            >
              <IconPlus size={14} className="mr-1" /> Add consignment LR
            </Button>
          )}
        </div>
        {g.lorryReceipts.map((lr) => (
          <div key={lr.id} className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{lr.lrNumber}</p>
                  {lr.status !== g.status && (
                    <LRStatusBadge status={lr.status} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {lr.loadingLocation?.name ?? "—"} →{" "}
                  {lr.unloadingLocation?.name ?? "—"}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-right text-xs text-muted-foreground">
                  {lr.invoiceNumber ? <p>Invoice {lr.invoiceNumber}</p> : null}
                  {lr.invoiceAmount != null ? (
                    <p>{formatPaise(lr.invoiceAmount)}</p>
                  ) : null}
                </div>
                {g.status === "DRAFT" && canUpdate && (
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Edit LR"
                      onClick={() => setEditLine(lr)}
                    >
                      <IconPencil size={15} />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove LR"
                      className="text-red-600 hover:bg-red-50"
                      disabled={
                        removeLine.isPending || g.lorryReceipts.length <= 1
                      }
                      onClick={() => removeLine.mutate(lr.id)}
                    >
                      <IconTrash size={15} />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {g.status !== "DRAFT" && <LRTimeline lr={lr} group={g} />}

            {lr.goods.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {lr.goods.map((gd) => (
                  <span
                    key={gd.id}
                    className="rounded-sm bg-muted px-2 py-0.5 text-xs"
                  >
                    {gd.name} · Qty {gd.quantity}
                  </span>
                ))}
              </div>
            )}
            {(!lr.loadingLocationId ||
              !lr.unloadingLocationId ||
              lr.goods.length === 0 ||
              lr.totalWeight == null ||
              !lr.unit) && (
              <div className="mb-3 flex w-fit flex-wrap items-center gap-1 rounded-sm bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                <IconAlertTriangle size={13} />
                Complete before finalise:
                {!lr.loadingLocationId ? " loading point" : ""}
                {!lr.unloadingLocationId ? " unloading point" : ""}
                {lr.goods.length === 0 ? " goods" : ""}
                {lr.totalWeight == null ? " total weight" : ""}
                {!lr.unit ? " unit" : ""}
              </div>
            )}

            <EwayBillSection
              lrId={lr.id}
              groupId={g.id}
              ewayBill={lr.ewayBill}
              canAdd={canUpdate && g.status !== "CANCELLED"}
            />

            <DeliverySection
              lr={lr}
              canDeliver={canDeliver}
              canAcknowledge={canAcknowledge}
              onDeliver={() => setDeliverLr(lr)}
              onEditDelivery={() => setEditDeliveryLr(lr)}
              onUndoDelivery={() => undoDelivery.mutate(lr.id)}
              onAcknowledge={() => setAckLr(lr)}
              onEditAcknowledgement={() => setEditAckLr(lr)}
              onUndoAcknowledgement={() => undoAcknowledgement.mutate(lr.id)}
            />
          </div>
        ))}
      </div>

      <FinaliseDialog
  open={finaliseOpen}
  onOpenChange={setFinaliseOpen}
  groupNumber={g.groupNumber}
  lrs={g.lorryReceipts.map((lr) => ({
    id: lr.id,
    lrNumber: lr.lrNumber,
    loadingLocation: lr.loadingLocation,
    unloadingLocation: lr.unloadingLocation,
    invoiceNumber: lr.invoiceNumber,
    invoiceAmount: lr.invoiceAmount,
    ewayBill: lr.ewayBill,
    missingFields: getMissingLRFields(lr),
  }))}
  defaultFreight={
    g.order?.bookingFreightAmount != null
      ? paiseToRupees(g.order.bookingFreightAmount)
      : null
  }
  isPending={finalise.isPending}
  onConfirm={(data) => finalise.mutate(data)}
/>

      <SplitAtHubDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        lrNumber={g.groupNumber}
        primaryTripId={g.primaryTripId}
        consignorId={g.consignorId}
        isPending={dispatchFromHub.isPending}
        onConfirm={(secondaryTripId) => dispatchFromHub.mutate(secondaryTripId)}
      />

      <DeliverDialog
        open={Boolean(deliverLr)}
        onOpenChange={(o) => !o && setDeliverLr(null)}
        lrNumber={deliverLr?.lrNumber ?? ""}
        mode="deliver"
        isPending={deliver.isPending}
        onConfirm={(values, podFiles) =>
          deliverLr && deliver.mutate({ lrId: deliverLr.id, values, podFiles })
        }
      />

      <DeliverDialog
        open={Boolean(editDeliveryLr)}
        onOpenChange={(o) => !o && setEditDeliveryLr(null)}
        lrNumber={editDeliveryLr?.lrNumber ?? ""}
        mode="edit"
        initial={editDeliveryLr?.delivery ?? null}
        isPending={updateDelivery.isPending}
        onConfirm={(values) =>
          editDeliveryLr &&
          updateDelivery.mutate({ lrId: editDeliveryLr.id, values })
        }
      />

      <BulkDeliverDialog
        open={bulkDeliverOpen}
        onOpenChange={setBulkDeliverOpen}
        groupNumber={g.groupNumber}
        lrs={pendingLrs}
        isPending={deliverAll.isPending}
        onConfirm={(values) => deliverAll.mutate(values)}
      />

      <AcknowledgeDialog
        open={Boolean(ackLr)}
        onOpenChange={(o) => !o && setAckLr(null)}
        lrNumber={ackLr?.lrNumber ?? ""}
        goods={ackLr?.goods ?? []}
        mode="acknowledge"
        isPending={acknowledge.isPending}
        onConfirm={(values, scanFiles) =>
          ackLr && acknowledge.mutate({ lrId: ackLr.id, values, scanFiles })
        }
      />

      <AcknowledgeDialog
        open={Boolean(editAckLr)}
        onOpenChange={(o) => !o && setEditAckLr(null)}
        lrNumber={editAckLr?.lrNumber ?? ""}
        goods={editAckLr?.goods ?? []}
        mode="edit"
        initial={editAckLr?.acknowledgement ?? null}
        isPending={updateAcknowledgement.isPending}
        onConfirm={(values) =>
          editAckLr &&
          updateAcknowledgement.mutate({ lrId: editAckLr.id, values })
        }
      />

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel group ${g.groupNumber}`}
        description="This cancels the group and all its LRs, and frees up the truck slot."
        confirmLabel="Cancel group"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />

      <EditGroupDialog
        open={editGroupOpen}
        onOpenChange={setEditGroupOpen}
        group={g}
        isPending={updateGroup.isPending}
        onConfirm={(data) => updateGroup.mutate(data)}
      />

      <LRLineDialog
        open={addLineOpen}
        onOpenChange={setAddLineOpen}
        mode="add"
        consignorId={g.consignorId}
        consigneeId={g.consigneeId}
        isPending={addLine.isPending}
        onSubmit={(payload) => addLine.mutate(payload)}
      />

      <LRLineDialog
        open={Boolean(editLine)}
        onOpenChange={(o) => !o && setEditLine(null)}
        mode="edit"
        consignorId={g.consignorId}
        consigneeId={g.consigneeId}
        initial={
          editLine
            ? {
                loadingLocationId: editLine.loadingLocationId ?? undefined,
                unloadingLocationId: editLine.unloadingLocationId ?? undefined,
                totalWeight:
                  editLine.totalWeight != null
                    ? String(editLine.totalWeight)
                    : "",
                totalWeightUnit: editLine.unit ?? "MT",
                goods: editLine.goods.map((goods) => ({
                  name: goods.name,
                  quantity:
                    goods.quantity != null ? String(goods.quantity) : "",
                })),
                invoiceNumber: editLine.invoiceNumber ?? "",
                invoiceAmount:
                  editLine.invoiceAmount != null
                    ? String(paiseToRupees(editLine.invoiceAmount))
                    : "",
              }
            : undefined
        }
        isPending={updateLine.isPending}
        onSubmit={(payload) =>
          editLine && updateLine.mutate({ lrId: editLine.id, payload })
        }
      />
    </div>
  );
}
