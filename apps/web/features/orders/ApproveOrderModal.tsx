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
import { formatMoney } from "./order-ui";

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
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const disallow = Boolean(
    (order.customer as { disallowNewLRBooking?: boolean } | undefined)
      ?.disallowNewLRBooking
  );
  const selfApprove = order.createdById === currentUserId;

  const prefill =
    order.bookingFreightAmount != null
      ? Number(order.bookingFreightAmount)
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

  const changed =
    prefill == null ? freight.trim() !== "" : Number(freight) !== prefill;
  const needsReason = changed && overrideReason.trim().length === 0;
  const blockedByDisallow = disallow && !ack;

  const handleApprove = async () => {
    setPending(true);
    try {
      await orderApi.approve(order.id, {
        bookingFreightAmount: freight.trim() === "" ? undefined : Number(freight),
        freightOverrideReason: changed ? overrideReason.trim() : undefined,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Order {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Review and set the freight, then confirm this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Customer</dt>
              <dd>{order.customer?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Route</dt>
              <dd>
                {order.fromBranch?.shortCode} → {order.toBranch?.shortCode}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Type</dt>
              <dd>
                {order.orderType === "Truck"
                  ? `${order.truckQuantity ?? ""} × ${order.vehicleType?.name ?? "Truck"}`
                  : `${order.items?.length ?? 0} item(s)`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Auto freight</dt>
              <dd>
                {order.freightPreview?.matched
                  ? formatMoney(order.freightPreview.amount)
                  : "No rate matched"}
              </dd>
            </div>
          </dl>

          {selfApprove ? (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 ring-1 ring-amber-200">
              <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
              You are approving your own order. This will be recorded in the
              timeline.
            </div>
          ) : null}

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
            <label className="text-xs font-medium text-muted-foreground">
              Booking freight (₹)
            </label>
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
                Override reason <span className="text-red-600">*</span>
              </label>
              <Textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why is the freight different from the matrix?"
                aria-invalid={needsReason}
              />
              {needsReason ? (
                <p className="text-xs text-red-600">
                  A reason is required when changing the freight.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || needsReason || blockedByDisallow}
            onClick={handleApprove}
          >
            {pending ? "Confirming…" : "Approve & Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
