"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { IconCheck, IconX, IconBan, IconEdit, IconArrowLeft } from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import { orderApi } from "./order.service";
import { orderKeys } from "./order.keys";
import {
  StatusBadge,
  formatDate,
  formatMoney,
  formatDateTime,
} from "./order-ui";
import OrderTimeline from "./OrderTimeline";
import ApproveOrderModal from "./ApproveOrderModal";
import ReasonDialog from "./ReasonDialog";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

export default function OrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const canApprove = useCan(PERMS.ORDER.APPROVE);
  const canReject = useCan(PERMS.ORDER.REJECT);
  const canCancel = useCan(PERMS.ORDER.CANCEL);
  const canUpdate = useCan(PERMS.ORDER.UPDATE);

  const { data: order, isLoading } = useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => orderApi.detail(orderId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orderKeys.all });

  const reject = useMutation({
    mutationFn: (reason: string) => orderApi.reject(orderId, { reason }),
    onSuccess: () => {
      toast.success("Order rejected");
      setRejectOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => orderApi.cancel(orderId, { reason }),
    onSuccess: () => {
      toast.success("Order cancelled");
      setCancelOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading || !order) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const isPending = order.status === "PendingApproval";
  const editable = order.status === "PendingApproval" || order.status === "Rejected" || order.status === "Confirmed";
  const cancellable = order.status === "PendingApproval" || order.status === "Confirmed";

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => router.push("/orders")}
      >
        <IconArrowLeft size={16} className="mr-1" /> Back to orders
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex gap-2">
          {canUpdate && editable ? (
            <Button
              variant="outline"
              onClick={() => router.push(`/orders/${order.id}/edit`)}
            >
              <IconEdit size={16} className="mr-1" /> Edit
            </Button>
          ) : null}
          {canApprove && isPending ? (
            <Button onClick={() => setApproveOpen(true)}>
              <IconCheck size={16} className="mr-1" /> Approve
            </Button>
          ) : null}
          {canReject && isPending ? (
            <Button variant="outline" onClick={() => setRejectOpen(true)}>
              <IconX size={16} className="mr-1" /> Reject
            </Button>
          ) : null}
          {canCancel && cancellable ? (
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setCancelOpen(true)}
            >
              <IconBan size={16} className="mr-1" /> Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {order.status === "Rejected" && order.rejectionReason ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          <strong>Rejected:</strong> {order.rejectionReason}
        </div>
      ) : null}
      {order.status === "Cancelled" && order.cancelReason ? (
        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700 ring-1 ring-gray-200">
          <strong>Cancelled:</strong> {order.cancelReason}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">Customer & Route</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Customer" value={order.customer?.name} />
              <Field
                label="From branch"
                value={order.fromBranch?.name}
              />
              <Field label="To branch" value={order.toBranch?.name} />
              <Field label="Pickup date" value={formatDate(order.pickupDate)} />
              <Field
                label="Pickup location"
                value={order.customerLocation?.name ?? order.pickupAddressOverride}
              />
            </dl>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">Order details</h2>
            {order.orderType === "Truck" ? (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Type" value="Truck hire" />
                <Field label="Vehicle type" value={order.vehicleType?.name} />
                <Field label="Truck quantity" value={order.truckQuantity} />
              </dl>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs uppercase">Goods</TableHead>
                      <TableHead className="text-xs uppercase">Qty</TableHead>
                      <TableHead className="text-xs uppercase">Unit</TableHead>
                      <TableHead className="text-xs uppercase">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items?.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{i.goods?.name ?? "—"}</TableCell>
                        <TableCell>{i.quantity}</TableCell>
                        <TableCell>{i.unit}</TableCell>
                        <TableCell>{i.weight ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">Contact & Freight</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Contact person" value={order.contactPersonName} />
              <Field label="Contact mobile" value={order.contactMobile} />
              <Field label="Contact email" value={order.contactEmail} />
              <Field
                label="Booking freight"
                value={formatMoney(order.bookingFreightAmount)}
              />
              {order.freightOverrideReason ? (
                <Field
                  label="Freight override reason"
                  value={order.freightOverrideReason}
                />
              ) : null}
              <Field
                label="Approved"
                value={
                  order.approvedBy
                    ? `${order.approvedBy.firstName} ${order.approvedBy.lastName} · ${formatDateTime(order.approvedAt)}`
                    : "—"
                }
              />
            </dl>
            {order.specialInstructions ? (
              <div className="mt-3">
                <Field
                  label="Special instructions"
                  value={order.specialInstructions}
                />
              </div>
            ) : null}
          </section>
        </div>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
          <OrderTimeline events={order.events ?? []} />
        </section>
      </div>

      <ApproveOrderModal
        order={order}
        open={approveOpen}
        onOpenChange={setApproveOpen}
        onApproved={invalidate}
      />
      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject order ${order.orderNumber}`}
        description="The creator will be notified with this reason."
        confirmLabel="Reject order"
        destructive
        isPending={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
      />
      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel order ${order.orderNumber}`}
        description="This can't be undone."
        confirmLabel="Cancel order"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />
    </div>
  );
}
