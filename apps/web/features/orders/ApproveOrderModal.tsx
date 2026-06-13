"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";

import { useAppSelector } from "@/store/hooks";
import { orderApi, type OrderDetail } from "./order.service";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import { formatMoney, formatMoneyFromPaise } from "./order-ui";
import { paiseToRupees } from "@/lib/money";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDetail;
  onApproved?: () => void;
};

export default function ApproveOrderModal({
  open,
  onOpenChange,
  order,
  onApproved,
}: Props) {
  console.log(order, "orders")
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const disallow = Boolean(
    (order.customer as { disallowNewLRBooking?: boolean } | undefined)
      ?.disallowNewLRBooking
  );
  const selfApprove = order.createdById === currentUserId;

  const prefill =
    order.bookingFreightAmount != null
      ? paiseToRupees(Number(order.bookingFreightAmount))
      : order.freightPreview?.amount ?? null;

  const [freight, setFreight] = React.useState<string>(
    prefill != null ? String(prefill) : ""
  );
  const [overrideReason, setOverrideReason] = React.useState("");
  const [ack, setAck] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setFreight(prefill != null ? String(prefill) : "");
      setOverrideReason("");
      setAck(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const routeLabel =
    order.route?.sourceCity?.name && order.route?.destinationCity?.name
      ? `${order.route.sourceCity.name} → ${order.route.destinationCity.name}`
      : "—";

  const branchLabel =
    order.fromBranch?.shortCode && order.toBranch?.shortCode
      ? `${order.fromBranch.shortCode} → ${order.toBranch.shortCode}`
      : "—";

  const autoFreight =
    order.freightPreview?.matched && order.freightPreview.amount != null
      ? Number(order.freightPreview.amount)
      : null;

  const enteredFreight =
    freight.trim() === "" || Number.isNaN(Number(freight))
      ? null
      : Number(freight);

  const freightEdited =
    autoFreight != null &&
    enteredFreight != null &&
    enteredFreight !== autoFreight;

  const changed = freightEdited;


  const blockedByDisallow = disallow && !ack;

  const freightDiff =
    autoFreight != null && enteredFreight != null
      ? enteredFreight - autoFreight
      : 0;

  const rateMatrix = order.freightPreview?.rateMatrix;


  const rateMatrixRoute =
    rateMatrix?.route?.sourceCity?.name &&
      rateMatrix?.route?.destinationCity?.name
      ? `${rateMatrix.route.sourceCity.name} → ${rateMatrix.route.destinationCity.name}`
      : routeLabel;




  const handleApprove = async () => {
    setPending(true);
    try {
      await orderApi.approve(order.id, {
        bookingFreightAmount: freight.trim() === "" ? undefined : Number(freight),
        freightOverrideReason:
          changed && overrideReason.trim()
            ? overrideReason.trim()
            : undefined,
        acknowledgeDisallow: ack,
      });
      toast.success(`Order ${order.orderNumber} confirmed`);
      onOpenChange(false);
      onApproved?.();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[35vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Order {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Review and set the freight, then confirm this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <dl className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Customer</dt>
              <dd>{order.customer?.name ?? "—"}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Route</dt>
              <dd className="font-medium">{routeLabel}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Branch</dt>
              <dd>{branchLabel}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Type</dt>
              <dd>
                {order.orderType === "Truck"
                  ? `${order.truckQuantity ?? ""} × ${order.vehicleType?.name ?? "Truck"
                  }`
                  : `${order.items?.length ?? 0} item(s)`}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Auto freight</dt>
              <dd className="font-medium">
                {autoFreight != null ? formatMoney(autoFreight) : "No rate matched"}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Rate source</dt>
              <dd>{order.freightPreview?.source ?? "—"}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Matrix rate</dt>
              <dd>
                {rateMatrix?.rate != null ? formatMoneyFromPaise(rateMatrix.rate) : "—"}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">Agreement client</dt>
              <dd>{rateMatrix?.agreement?.client?.name ?? "—"}</dd>
            </div>
          </dl>




          {disallow ? (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700 ring-1 ring-red-200">
              <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                <p>
                  This customer is flagged <strong>disallow new booking</strong>.
                </p>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={ack}
                    onCheckedChange={(v) => setAck(Boolean(v))}
                  />
                  Proceed anyway
                </label>
              </div>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Booking freight (₹)
              </label>

              {freightEdited && autoFreight != null && enteredFreight != null ? (
                <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                  Edited · {freightDiff > 0 ? "+" : ""}
                  {formatMoney(freightDiff)}
                </span>
              ) : null}
            </div>

            {freightEdited && autoFreight != null && enteredFreight != null ? (
              <p className="text-[11px] text-orange-700">
                Auto {formatMoney(autoFreight)} → New {formatMoney(enteredFreight)}
              </p>
            ) : null}

            <Input
              type="number"
              min={0}
              step="0.01"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
              placeholder={
                order.orderType === "Item"
                  ? "Enter freight manually"
                  : "Auto-calculated; editable"
              }
            />
          </div>

          {changed ? (
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Override reason <span className="text-muted-foreground">(optional)</span>
              </label>

              <Textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Add reason for freight change, if needed"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || blockedByDisallow}
            onClick={handleApprove}
          >
            {pending ? "Confirming…" : "Approve & Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
