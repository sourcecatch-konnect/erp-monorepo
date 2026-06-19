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
} from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { formatMoney } from "@/lib/format";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { lrGroupApi } from "./lr-group.service";
import { lrGroupKeys } from "./lr-group.keys";
import { LRStatusBadge, SOURCE_LABELS } from "./lorry-receipt-ui";
import FinaliseDialog from "./components/FinaliseDialog";
import SplitAtHubDialog from "./components/SplitAtHubDialog";
import EwayBillSection from "./components/EwayBillSection";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export default function LRDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [finaliseOpen, setFinaliseOpen] = React.useState(false);
  const [splitOpen, setSplitOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const canApprove = useCan(PERMS.LORRY_RECEIPT.APPROVE);
  const canCancel = useCan(PERMS.LORRY_RECEIPT.CANCEL);
  const canUpdate = useCan(PERMS.LORRY_RECEIPT.UPDATE);

  const group = useQuery({
    queryKey: lrGroupKeys.detail(id),
    queryFn: () => lrGroupApi.detail(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: lrGroupKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: lrGroupKeys.all });
  };

  const finalise = useMutation({
    mutationFn: (body: Parameters<typeof lrGroupApi.finalise>[1]) =>
      lrGroupApi.finalise(id, body),
    onSuccess: () => {
      toast.success("Group finalised");
      setFinaliseOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const split = useMutation({
    mutationFn: (secondaryTripId: string) => lrGroupApi.splitAtHub(id, { secondaryTripId }),
    onSuccess: () => {
      toast.success("Leg 2 trip attached");
      setSplitOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => lrGroupApi.cancel(id, { cancelReason: reason }),
    onSuccess: () => {
      toast.success("Group cancelled");
      setCancelOpen(false);
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
        <Button variant="outline" onClick={() => router.push("/lorry-receipts")}>
          Back to list
        </Button>
      </div>
    );
  }

  const g = group.data;
  const vehicle = g.isMarketVehicle
    ? g.marketVehicleNumber ?? "Market vehicle"
    : g.primaryTrip?.vehicle?.vehicleNumber ?? "—";

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button size="icon-sm" variant="ghost" onClick={() => router.push("/lorry-receipts")}>
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
          {g.status === "DRAFT" && canApprove && (
            <Button onClick={() => setFinaliseOpen(true)}>Finalise group</Button>
          )}
          {g.status === "FINALISED" && canApprove && (
            <Button variant="outline" onClick={() => setSplitOpen(true)}>
              Split at hub
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
            {g.secondaryTrip && <Field label="Leg 2 trip" value={g.secondaryTrip.tripName} />}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <IconCoin size={13} /> Freight & seal
          </p>
          <div className="space-y-3">
            <Field
              label="Base freight"
              value={g.baseFreightAmount != null ? formatMoney(g.baseFreightAmount) : "—"}
            />
            <Field label="Seal number" value={g.sealNumber} />
            <Field label="Priority" value={g.priority} />
          </div>
        </div>
      </div>

      {/* Lorry receipts */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Lorry receipts</p>
        {g.lorryReceipts.map((lr) => (
          <div key={lr.id} className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{lr.lrNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {lr.loadingLocation?.name ?? "—"} → {lr.unloadingLocation?.name ?? "—"}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {lr.invoiceNumber ? <p>Invoice {lr.invoiceNumber}</p> : null}
                {lr.invoiceAmount != null ? <p>{formatMoney(lr.invoiceAmount)}</p> : null}
              </div>
            </div>

            {lr.goods.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {lr.goods.map((gd) => (
                  <span key={gd.id} className="rounded-sm bg-muted px-2 py-0.5 text-xs">
                    {gd.name} · {gd.quantity} {gd.unit}
                  </span>
                ))}
              </div>
            )}

            <EwayBillSection
              lrId={lr.id}
              ewayBills={lr.ewayBills}
              canAdd={canUpdate && g.status !== "CANCELLED"}
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
        }))}
        defaultFreight={null}
        isPending={finalise.isPending}
        onConfirm={(data) => finalise.mutate(data)}
      />

      <SplitAtHubDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        lrNumber={g.groupNumber}
        primaryTripId={g.primaryTripId}
        isPending={split.isPending}
        onConfirm={(secondaryTripId) => split.mutate(secondaryTripId)}
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
    </div>
  );
}
