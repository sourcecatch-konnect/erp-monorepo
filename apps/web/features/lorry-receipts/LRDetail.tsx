"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import type { FinaliseLRBody } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { IconArrowLeft, IconBan, IconCheck } from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { formatDate, formatMoney } from "@/lib/format";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { lorryReceiptApi } from "./lorry-receipt.service";
import { lrKeys } from "./lorry-receipt.keys";
import { LRStatusBadge, SOURCE_LABELS } from "./lorry-receipt-ui";
import FinaliseDialog from "./components/FinaliseDialog";
import EwayBillSection from "./components/EwayBillSection";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function LRDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [finaliseOpen, setFinaliseOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const canApprove = useCan(PERMS.LORRY_RECEIPT.APPROVE);
  const canCancel = useCan(PERMS.LORRY_RECEIPT.CANCEL);
  const canUpdate = useCan(PERMS.LORRY_RECEIPT.UPDATE);

  const lr = useQuery({
    queryKey: lrKeys.detail(id),
    queryFn: () => lorryReceiptApi.detail(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: lrKeys.all });
    queryClient.invalidateQueries({ queryKey: lrKeys.detail(id) });
  };

  const finalise = useMutation({
    mutationFn: (body: FinaliseLRBody) => lorryReceiptApi.finalise(id, body),
    onSuccess: () => {
      toast.success("LR finalised");
      setFinaliseOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) =>
      lorryReceiptApi.cancel(id, { cancelReason: reason }),
    onSuccess: () => {
      toast.success("LR cancelled");
      setCancelOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (lr.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!lr.data) {
    return (
      <div className="p-6 text-muted-foreground text-sm">Lorry receipt not found.</div>
    );
  }

  const data = lr.data;
  const isDraft = data.status === "DRAFT";
  const baseFreight = data.charges.find((c) => c.chargeType === "BASE_FREIGHT");

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push("/lorry-receipts")}
              aria-label="Back"
            >
              <IconArrowLeft size={16} />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">{data.lrNumber}</h1>
                <LRStatusBadge status={data.status} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {SOURCE_LABELS[data.source]}
                {data.order ? ` · Order ${data.order.orderNumber}` : ""}
                {" · "}Created {formatDate(data.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {canApprove && isDraft && (
              <Button onClick={() => setFinaliseOpen(true)}>
                <IconCheck size={16} className="mr-1" /> Finalise
              </Button>
            )}
            {canCancel && isDraft && (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <IconBan size={16} className="mr-1" /> Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Parties & Route */}
      <div className="rounded-lg border bg-background p-4">
        <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
          Parties & Route
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Consignor" value={data.consignor?.name} />
          <Field label="Consignee" value={data.consignee?.name} />
          <Field label="Origin branch" value={data.originBranch?.name} />
          <Field label="Destination branch" value={data.destinationBranch?.name} />
          <Field
            label="Transport type"
            value={
              data.transportType === "RoadAndRail"
                ? "Road & Rail"
                : data.transportType
            }
          />
          <Field
            label="Trip leg"
            value={
              data.tripLegType === "DIRECT"
                ? "Direct"
                : data.tripLegType === "TO_HUB"
                ? "To Hub"
                : "From Hub"
            }
          />
          {data.hub && <Field label="Railhead hub" value={data.hub.name} />}
          <Field label="Priority" value={data.priority} />
        </div>
      </div>

      {/* Vehicle */}
      <div className="rounded-lg border bg-background p-4">
        <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Vehicle</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Transport by"
            value={data.isMarketVehicle ? "Market vehicle" : "Own vehicle"}
          />
          {data.isMarketVehicle ? (
            <>
              <Field label="Vehicle number" value={data.marketVehicleNumber} />
              <Field label="Driver" value={data.marketDriverName} />
            </>
          ) : (
            <>
              {data.primaryTrip && (
                <Field
                  label="Primary trip"
                  value={`${data.primaryTrip.tripNumber} — ${data.primaryTrip.tripName}`}
                />
              )}
              {data.secondaryTrip && (
                <Field
                  label="Secondary trip"
                  value={`${data.secondaryTrip.tripNumber} — ${data.secondaryTrip.tripName}`}
                />
              )}
              {data.primaryTrip?.vehicle && (
                <Field label="Vehicle" value={data.primaryTrip.vehicle.vehicleNumber} />
              )}
              {data.primaryTrip?.driver && (
                <Field label="Driver" value={data.primaryTrip.driver.name} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Invoice */}
      {(data.invoiceNumber || data.invoiceAmount != null) && (
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Invoice</p>
          <div className="grid gap-4 md:grid-cols-2">
            {data.invoiceNumber && (
              <Field label="Invoice number" value={data.invoiceNumber} />
            )}
            {data.invoiceAmount != null && (
              <Field label="Invoice amount" value={formatMoney(data.invoiceAmount)} />
            )}
          </div>
        </div>
      )}

      {/* Freight */}
      <div className="rounded-lg border bg-background p-4">
        <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
          Freight & Finalisation
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Base freight"
            value={baseFreight ? formatMoney(baseFreight.amount) : isDraft ? "Not set yet" : "—"}
          />
          {data.sealNumber && <Field label="Seal number" value={data.sealNumber} />}
          {data.finalisedAt && (
            <Field label="Finalised on" value={formatDate(data.finalisedAt)} />
          )}
          {data.finalisedBy && (
            <Field
              label="Finalised by"
              value={`${data.finalisedBy.firstName} ${data.finalisedBy.lastName}`}
            />
          )}
        </div>
      </div>

      {/* Goods */}
      <div className="rounded-lg border bg-background p-4">
        <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Goods</p>
        {data.goods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goods lines.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase text-muted-foreground">
                  <th className="pb-2 text-left">Name</th>
                  <th className="pb-2 text-left">Description</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-left">Unit</th>
                  <th className="pb-2 text-right">Weight</th>
                </tr>
              </thead>
              <tbody>
                {data.goods.map((g) => (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="py-2">{g.name}</td>
                    <td className="py-2 text-muted-foreground">{g.description ?? "—"}</td>
                    <td className="py-2 text-right">{g.quantity}</td>
                    <td className="py-2">{g.unit}</td>
                    <td className="py-2 text-right">
                      {g.weight ? `${g.weight} kg` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* E-way bills */}
      <div className="rounded-lg border bg-background p-4">
        <EwayBillSection
          lrId={id}
          ewayBills={data.ewayBills}
          canAdd={canUpdate && data.status !== "CANCELLED"}
        />
      </div>

      {/* Cancel info */}
      {data.cancelReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="font-medium">Cancelled: </span>
          {data.cancelReason}
        </div>
      )}

      {/* Dialogs */}
      <FinaliseDialog
        open={finaliseOpen}
        onOpenChange={setFinaliseOpen}
        lrNumber={data.lrNumber}
        isPending={finalise.isPending}
        onConfirm={(body) => finalise.mutate(body)}
      />

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel LR ${data.lrNumber}`}
        description="This can't be undone. The truck slot will be freed."
        confirmLabel="Cancel LR"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />
    </div>
  );
}
