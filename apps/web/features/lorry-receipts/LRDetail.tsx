"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
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
  IconChevronDown,
  IconDownload,
  IconEye,
  IconFileDescription,
  IconLoader2,
  IconPackage,
  IconPrinter,
  IconStack2,
} from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { attachmentApi } from "@/features/attachments/attachment.client";
import { formatPaise, paiseToRupees } from "@/lib/money";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { lrGroupApi } from "./lr-group.service";
import { lrGroupKeys } from "./lr-group.keys";
import {
  lorryReceiptApi,
  lrLookups,
  lrLookupKeys,
} from "./lorry-receipt.service";
import {
  LRStatusBadge,
  SOURCE_LABELS,
  daysSince,
  lrGroupDisplay,
  RouteInline,
} from "./lorry-receipt-ui";
import { cn } from "@/lib/utils";
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
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold leading-6 text-foreground">
        {value ?? "—"}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon size={17} />
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
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
  const [pdfBusyId, setPdfBusyId] = React.useState<string | null>(null);

  const handleLrPdf = async (
    lr: { id: string; lrNumber: string },
    action: "download" | "print",
    withLetterhead: boolean,
  ) => {
    try {
      setPdfBusyId(lr.id);
      const blob = await lorryReceiptApi.downloadPdf(lr.id, withLetterhead);
      const url = window.URL.createObjectURL(blob);

      if (action === "download") {
        const suffix = withLetterhead ? "" : "-plain";
        const a = document.createElement("a");
        a.href = url;
        a.download = `${lr.lrNumber.replaceAll("/", "-")}${suffix}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return;
      }

      // Print: load the PDF into a hidden iframe and invoke the browser's
      // print dialog directly, instead of forcing a save-to-disk step.
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };
      document.body.appendChild(iframe);
      setTimeout(() => {
        iframe.remove();
        window.URL.revokeObjectURL(url);
      }, 60_000);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPdfBusyId(null);
    }
  };

  const openLrPreview = (
    lr: { id: string },
    withLetterhead: boolean,
  ) => {
    window.open(
      `/api/lorry-receipts/${encodeURIComponent(lr.id)}/print-preview?letterhead=${withLetterhead}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

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

  // Multi-truck orders create one LRGroup per truck. These two queries — the
  // same ones LRForm uses to build its truck dropdown — let us tell whether
  // this order still has trucks with consignment lines that haven't been
  // turned into an LR yet. Driven entirely by the freshly-loaded group's own
  // order.id, not by anything passed through routing, so it stays correct on
  // refresh, back-navigation, or landing here from a different flow.
  const orderId = group.data?.order?.id;
  const orderContext = useQuery({
    queryKey: lrLookupKeys.orderContext(orderId ?? ""),
    queryFn: () => lrLookups.orderContext(orderId as string),
    enabled: Boolean(orderId),
  });
  const orderGroups = useQuery({
    queryKey: ["lr-groups", "by-order", orderId ?? ""] as const,
    queryFn: () => lrGroupApi.list({ filter: { orderId: orderId as string } }),
    enabled: Boolean(orderId),
  });
  // Every truck 1..truckQuantity minus whichever already have a live group —
  // not derived from consignment lines, since those no longer pre-exist on
  // the order (they're entered per truck, in the LR form, when that truck's
  // LR actually gets created).
  const ungroupedTrucks = React.useMemo(() => {
    const truckQuantity = orderContext.data?.truckQuantity ?? 0;
    const taken = new Set(
      (orderGroups.data?.data ?? [])
        .filter((og) => og.status !== "CANCELLED")
        .map((og) => og.truckIndex),
    );
    return Array.from({ length: truckQuantity }, (_, i) => i + 1).filter(
      (truckIndex) => !taken.has(truckIndex),
    );
  }, [orderContext.data, orderGroups.data]);

  // The page may have been opened via an LR number (deep link); when the
  // group holds several LRs, highlight the one the user came for.
  const requestedIdentifier = decodeURIComponent(id).trim();

  // LR-first toast copy — reads the loaded group at call time because the
  // mutations are declared before the query resolves.
  const isSingleton = () =>
    group.data ? lrGroupDisplay(group.data).isSingleton : false;

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
      toast.success(isSingleton() ? "LR finalised" : "Group finalised");
      setFinaliseOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const holdAtHub = useMutation({
    mutationFn: () => lrGroupApi.holdAtHub(actionGroupId),
    onSuccess: () => {
      toast.success(
        isSingleton()
          ? "LR held at hub — leg-1 trip can now be closed"
          : "Group held at hub — leg-1 trip can now be closed",
      );
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
      toast.success(isSingleton() ? "LR cancelled" : "Group cancelled");
      setCancelOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateGroup = useMutation({
    mutationFn: (body: Parameters<typeof lrGroupApi.update>[1]) =>
      lrGroupApi.update(actionGroupId, body),
    onSuccess: () => {
      toast.success(isSingleton() ? "LR updated" : "Group updated");
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
        invoiceRemark: vars.payload.invoiceRemark,
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
  const display = lrGroupDisplay(g);
  const hasNoLrs = g.lorryReceipts.length === 0;
  const hasDeliveredLr = g.lorryReceipts.some((lr) => Boolean(lr.delivery));
  const deliveredCount = g.lorryReceipts.filter((lr) =>
    Boolean(lr.delivery),
  ).length;
  // Deep link by LR number: highlight the LR the user came for when the
  // truckload holds several.
  const focusedLrNumber =
    !display.isSingleton &&
      g.lorryReceipts.some((lr) => lr.lrNumber === requestedIdentifier)
      ? requestedIdentifier
      : null;

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
      .map((lr) => `${lr.lrNumber}: ${lr.missingFields.join(", ")}`)
      .join(" | ");
  const vehicle = g.isMarketVehicle
    ? (g.marketVehicle?.vehicleNumber ??
      g.marketVehicleNumber ??
      "Market vehicle")
    : (g.primaryTrip?.vehicle?.vehicleNumber ?? "—");
  const marketAdvanceTotal =
    Number(g.marketAdvanceAmount ?? 0) +
    Number(g.marketCommissionAmount ?? 0) +
    Number(g.marketHamaliAmount ?? 0) +
    Number(g.marketTdsAmount ?? 0);
  const marketNetBalance =
    Number(g.marketFreightAmount ?? 0) - marketAdvanceTotal;

  // bookingFreightAmount on the order is the TOTAL across every truck
  // (computeFreight multiplies the rate-matrix's per-truck rate by
  // truckQuantity when the order is confirmed) — not a per-truck figure.
  // Split it evenly across the order's trucks so defaulting it into each
  // truck's finalise dialog sums back to the real total instead of billing
  // the full amount once per truck. Any odd-paise remainder goes to truck 1.
  const orderTruckQuantity = g.order?.truckQuantity ?? 1;
  const defaultFreightPaise =
    g.order?.bookingFreightAmount != null
      ? (() => {
        const total = g.order!.bookingFreightAmount!;
        const perTruck = Math.floor(total / orderTruckQuantity);
        const remainder = total - perTruck * orderTruckQuantity;
        return perTruck + (g.truckIndex === 1 ? remainder : 0);
      })()
      : null;

  const pendingLrs = g.lorryReceipts.filter((lr) => lr.status === "FINALISED");
  const eligiblePendingLrs = pendingLrs.filter(
    (lr) => lr.deliveryEligibility?.eligible !== false,
  );
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
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Document header */}
      <header className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              size="icon-lg"
              variant="outline"
              aria-label="Back to lorry receipts"
              onClick={() => router.push("/lorry-receipts")}
            >
              <IconArrowLeft size={19} />
            </Button>
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <IconFileDescription size={16} />
                {display.isSingleton ? "Lorry receipt" : "LR truckload"}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="break-all font-mono text-xl font-semibold tracking-tight text-foreground">
                  {display.title}
                </h1>
                <LRStatusBadge status={display.status ?? g.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{SOURCE_LABELS[g.source]}</span>
                <span aria-hidden>·</span>
                <span>{display.subtitle}</span>
                {!display.isSingleton &&
                  deliveredCount > 0 &&
                  deliveredCount < display.lrCount ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      {deliveredCount} of {display.lrCount} delivered
                    </span>
                  </>
                ) : null}
                {g.order ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>Order {g.order.orderNumber}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {display.isSingleton && g.lorryReceipts.length === 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={pdfBusyId !== null}
                  >
                    {pdfBusyId ? (
                      <IconLoader2 size={16} className="animate-spin" />
                    ) : (
                      <IconDownload size={16} />
                    )}
                    {pdfBusyId ? "Preparing…" : "Print / PDF"}
                    <IconChevronDown size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Download</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      handleLrPdf(g.lorryReceipts[0]!, "download", true)
                    }
                  >
                    <IconDownload size={16} className="mr-2" /> With
                    letterhead
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleLrPdf(g.lorryReceipts[0]!, "download", false)
                    }
                  >
                    <IconDownload size={16} className="mr-2" /> Without
                    letterhead
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Print</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      handleLrPdf(g.lorryReceipts[0]!, "print", true)
                    }
                  >
                    <IconPrinter size={16} className="mr-2" /> With letterhead
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleLrPdf(g.lorryReceipts[0]!, "print", false)
                    }
                  >
                    <IconPrinter size={16} className="mr-2" /> Without
                    letterhead
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Preview</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => openLrPreview(g.lorryReceipts[0]!, true)}
                  >
                    <IconEye size={16} className="mr-2" /> With letterhead
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openLrPreview(g.lorryReceipts[0]!, false)}
                  >
                    <IconEye size={16} className="mr-2" /> Without letterhead
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {g.status === "DRAFT" && canUpdate && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setEditGroupOpen(true)}
              >
                {display.isSingleton ? "Edit LR" : "Edit group"}
              </Button>
            )}
            {g.status === "DRAFT" && canApprove && (
              <Button
                size="lg"
                onClick={() => setFinaliseOpen(true)}
                title={finaliseTitle}
              >
                {display.isSingleton
                  ? "Finalise LR"
                  : `Finalise ${display.lrCount} LRs`}
              </Button>
            )}
            {g.status === "FINALISED" &&
              canDeliver &&
              eligiblePendingLrs.length > 0 && (
                <Button size="lg" onClick={() => setBulkDeliverOpen(true)}>
                  {display.isSingleton
                    ? "Deliver LR"
                    : `Deliver ready (${eligiblePendingLrs.length})`}
                </Button>
              )}
            {g.status === "FINALISED" && canApprove && canHoldAtHub && (
              <Button
                variant="outline"
                size="lg"
                disabled={holdAtHub.isPending}
                onClick={() => holdAtHub.mutate()}
              >
                {holdAtHub.isPending ? "Holding…" : "Hold at hub"}
              </Button>
            )}
            {g.status === "FINALISED" && canApprove && heldAtHub && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setSplitOpen(true)}
              >
                Dispatch from hub
              </Button>
            )}
            {g.status === "DRAFT" && canCancel && (
              <Button
                size="lg"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-muted/30 px-5 py-4">
          <RouteInline
            from={g.originBranch?.name}
            to={g.destinationBranch?.name}
            className="text-base"
          />
        </div>
      </header>

      {cannotFinalise && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          <IconAlertTriangle size={19} className="mt-0.5 shrink-0" />

          <div className="space-y-1">
            {hasNoLrs ? (
              <p>
                Add at least one consignment LR before finalising this group.
              </p>
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
        <div className="flex items-start gap-3 rounded-lg border border-success/35 bg-success/10 px-4 py-3 text-sm text-foreground">
          <IconCircleCheck size={19} className="mt-0.5 shrink-0 text-success" />
          <p>
            {display.isSingleton
              ? "This LR is delivered. It can no longer be held at or dispatched from a hub."
              : `All ${display.lrCount} LRs are delivered. This truckload is complete and can no longer be held at or dispatched from a hub.`}
          </p>
        </div>
      )}

      {heldAtHub && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          <IconTruck size={19} className="mt-0.5 shrink-0 text-primary" />
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

      {g.order && ungroupedTrucks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          <div className="flex items-start gap-3">
            <IconStack2 size={19} className="mt-0.5 shrink-0 text-primary" />
            <p>
              Order {g.order.orderNumber} has {ungroupedTrucks.length} more
              truck{ungroupedTrucks.length === 1 ? "" : "s"} without an LR yet.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              router.push(`/lorry-receipts/new?orderId=${g.order!.id}`)
            }
          >
            Create LR for Truck #{ungroupedTrucks[0]!}
          </Button>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Parties & route" icon={IconUsers}>
          <Field label="Consignor" value={g.consignor?.name} />
          <Field label="Consignee" value={g.consignee?.name} />
          <Field
            label="Branch route"
            value={
              <RouteInline
                from={g.originBranch?.name}
                to={g.destinationBranch?.name}
              />
            }
          />
        </SummaryCard>

        <SummaryCard title="Vehicle & transport" icon={IconTruck}>
          {g.isMarketVehicle ? (
            <div className="space-y-3">
              <Field
                label="Vehicle"
                value={
                  <span className="font-mono text-base uppercase">
                    {vehicle}
                  </span>
                }
              />
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <Field label="Transporter" value={g.marketTransport?.name} />
                <Field label="Driver" value={g.marketDriverName} />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  Market Vehicle
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                  {g.transportType}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <Field
                    label="Vehicle"
                    value={
                      <span className="font-mono text-base uppercase">
                        {vehicle}
                      </span>
                    }
                  />
                </div>

                <Field label="Transport type" value={g.transportType} />

                <Field
                  label="Payment mode"
                  value={
                    g.paymentMode === "TO_PAY"
                      ? "To Pay (no GST)"
                      : "To be Billed"
                  }
                />

                <Field label="Transport by" value="Own Vehicle" />

                <Field label="Driver" value={g.primaryTrip?.driver?.name} />
              </div>

              {g.primaryTrip ? (
                <div className="min-w-0 border-t pt-3">
                  <Field
                    label="Primary trip"
                    value={
                      <span
                        className="block max-w-full whitespace-normal break-words text-xs font-medium leading-4"
                        title={g.primaryTrip.tripName}
                      >
                        {g.primaryTrip.tripName}
                      </span>
                    }
                  />
                </div>
              ) : null}

              {g.secondaryTrip ? (
                <div className="min-w-0 border-t pt-3">
                  <Field
                    label="Leg 2 trip"
                    value={
                      <span
                        className="block max-w-full whitespace-normal break-words text-xs font-medium leading-4"
                        title={g.secondaryTrip.tripName}
                      >
                        {g.secondaryTrip.tripName}
                      </span>
                    }
                  />
                </div>
              ) : null}
            </div>
          )}
          {g.transportType === "RoadAndRail" ? (
            <div className="grid grid-cols-1 gap-3 border-t pt-3">
              <Field
                label="Source railway branch"
                value={g.railheadBranch?.name}
              />

              <Field
                label="Source railhead"
                value={g.sourceRailheadArea?.name}
              />

              <Field
                label="Destination railhead"
                value={g.destinationRailheadArea?.name}
              />
            </div>
          ) : null}
        </SummaryCard>

        <SummaryCard title="Freight & handling" icon={IconCoin}>
          {g.isMarketVehicle ? (
            <div className="space-y-4">
              {/* Freight breakdown */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Freight amount</span>
                  <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">
                    {formatPaise(g.marketFreightAmount ?? 0)}
                  </span>
                </div>

                {[
                  ["Advance", g.marketAdvanceAmount],
                  ["Commission", g.marketCommissionAmount],
                  ["Hamali", g.marketHamaliAmount],
                  ["TDS", g.marketTdsAmount],
                ].map(([label, amount]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-muted-foreground">{label}</span>

                    <span className="shrink-0 whitespace-nowrap font-medium tabular-nums">
                      {formatPaise(amount ?? 0)}
                    </span>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-4 border-t pt-2.5">
                  <span className="font-medium text-muted-foreground">
                    Total deductions
                  </span>

                  <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">
                    {formatPaise(marketAdvanceTotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 border-t pt-3">
                  <span className="font-semibold">Balance payable</span>

                  <span className="shrink-0 whitespace-nowrap text-base font-bold tabular-nums text-emerald-700">
                    {formatPaise(marketNetBalance)}
                  </span>
                </div>
              </div>

              {/* Other details */}
              <div className="grid grid-cols-2 gap-x-6 border-t pt-3">
                <Field label="Seal number" value={g.sealNumber} />
                <Field label="Priority" value={g.priority} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Base freight</span>

                <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">
                  {g.baseFreightAmount != null
                    ? formatPaise(g.baseFreightAmount)
                    : "—"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 border-t pt-3">
                <Field label="Seal number" value={g.sealNumber} />
                <Field label="Priority" value={g.priority} />
              </div>
            </div>
          )}
        </SummaryCard>
      </div>

      {/* Lorry receipts — a singleton renders as the page's own consignment
          section; only true truckloads present a list of LR cards. */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <IconPackage size={19} className="text-primary" />
              {display.isSingleton ? "Consignment details" : "Lorry receipts"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {display.isSingleton
                ? "Goods, invoice, e-way bill and delivery record"
                : `${display.lrCount} consignments moving in this truckload`}
            </p>
          </div>
          {g.status === "DRAFT" && canUpdate && (
            <Button variant="outline" onClick={() => setAddLineOpen(true)}>
              <IconPlus size={16} /> Add consignment LR
            </Button>
          )}
        </div>
        {g.lorryReceipts.map((lr) => (
          <div
            key={lr.id}
            className={cn(
              "rounded-lg border border-border bg-card p-5 transition-colors",
              focusedLrNumber === lr.lrNumber &&
              "border-primary ring-2 ring-primary/15",
            )}
          >
            <div className="mb-5 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-base font-semibold text-foreground">
                    {lr.lrNumber}
                  </p>
                  {lr.status !== g.status && (
                    <LRStatusBadge status={lr.status} />
                  )}
                </div>
                <RouteInline
                  from={lr.loadingLocation?.name}
                  to={lr.unloadingLocation?.name}
                  className="mt-2 text-base"
                />
              </div>
              <div className="flex items-start justify-between gap-4 sm:justify-end">
                <div className="text-left text-sm sm:text-right">
                  <p className="text-xs font-medium text-muted-foreground">
                    Invoice
                  </p>
                  {lr.invoiceNumber ? (
                    <p className="mt-1 font-mono font-semibold">
                      {lr.invoiceNumber}
                    </p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">Not added</p>
                  )}
                  {lr.invoiceAmount != null ? (
                    <p className="mt-1 font-semibold tabular-nums">
                      {formatPaise(lr.invoiceAmount)}
                    </p>
                  ) : null}
                  {lr.invoiceRemark ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lr.invoiceRemark}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-1">

                  {g.status === "DRAFT" && canUpdate && (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Edit LR"
                        onClick={() => setEditLine(lr)}
                      >
                        <IconPencil size={15} />
                      </Button>
                      {g.lorryReceipts.length > 1 && (
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          aria-label="Remove LR"
                          disabled={removeLine.isPending}
                          onClick={() => removeLine.mutate(lr.id)}
                        >
                          <IconTrash size={15} />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {g.status !== "DRAFT" && <LRTimeline lr={lr} group={g} />}

            {lr.goods.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {lr.goods.map((gd) => (
                  <span
                    key={gd.id}
                    className="rounded-sm border border-border bg-muted/60 px-2.5 py-1 text-sm font-medium"
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
                <div className="mb-4 flex w-fit flex-wrap items-center gap-1 rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-medium text-warning-foreground">
                  <IconAlertTriangle size={16} />
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
              canEdit={canUpdate && g.status !== "CANCELLED"}
            />

            <DeliverySection
              lr={lr}
              isMarketVehicle={g.isMarketVehicle}
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
      </section>

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
          defaultFreightPaise != null ? paiseToRupees(defaultFreightPaise) : null
        }
        isPending={finalise.isPending}
        onConfirm={(data) => finalise.mutate(data)}
      />

      <SplitAtHubDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        lrNumber={display.title}
        primaryTripId={g.primaryTripId}
        consignorId={g.consignorId}
        isPending={dispatchFromHub.isPending}
        onConfirm={(secondaryTripId) => dispatchFromHub.mutate(secondaryTripId)}
      />

      <DeliverDialog
        open={Boolean(deliverLr)}
        onOpenChange={(o) => !o && setDeliverLr(null)}
        lrNumber={deliverLr?.lrNumber ?? ""}
        isMarketVehicle={g.isMarketVehicle}
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
        isMarketVehicle={g.isMarketVehicle}
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
        isMarketVehicle={g.isMarketVehicle}
        lrs={eligiblePendingLrs}
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
        title={
          display.isSingleton
            ? `Cancel LR ${display.title}`
            : `Cancel group ${g.groupNumber}`
        }
        description={
          display.isSingleton
            ? "This cancels the LR and frees up the truck slot."
            : `This cancels the group and all its ${display.lrCount} LRs, and frees up the truck slot.`
        }
        confirmLabel={display.isSingleton ? "Cancel LR" : "Cancel group"}
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
              invoiceRemark: editLine.invoiceRemark ?? "",
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
