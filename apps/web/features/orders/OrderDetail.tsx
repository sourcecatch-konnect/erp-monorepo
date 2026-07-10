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
import {
  IconCheck,
  IconX,
  IconBan,
  IconEdit,
  IconArrowLeft,
  IconDownload,
  IconCopy,
  IconMail,
  IconAlertCircle,
  IconCircleCheck,
  IconClock,
  IconCircleDot,
  IconLoader2,
  IconArrowRight,
  IconPackage,
} from "@tabler/icons-react";
import { useCan } from "@/features/auth";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import { orderApi } from "./order.service";
import { orderKeys } from "./order.keys";
import { lrGroupApi } from "@/features/lorry-receipts/lr-group.service";
import { lrGroupKeys } from "@/features/lorry-receipts/lr-group.keys";
import { StatusBadge, formatDate, formatDateTime } from "./order-ui";
import { formatRupees, formatPaise, paiseToRupees } from "@/lib/money";
import OrderTimeline from "./OrderTimeline";
import ApproveOrderModal from "./ApproveOrderModal";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { IconFileText } from "@tabler/icons-react";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">
        {value ?? <span className="text-muted-foreground/50">—</span>}
      </dd>
    </div>
  );
}
function CardSection({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b pb-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-4 py-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-medium leading-none">
        {value}
        {sub && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </p>
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
  const canCreateLR = useCan(PERMS.LORRY_RECEIPT.CREATE);

  const { data: order, isLoading } = useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => orderApi.detail(orderId),
  });

  const lrCountsQuery = useQuery({
    queryKey: [...lrGroupKeys.all, "order-counts", order?.id ?? orderId],
    queryFn: () =>
      lrGroupApi.list({ size: 1, filter: { orderId: order?.id ?? "" } }),
    enabled: Boolean(
      order?.id &&
      order?.orderType === "Truck" &&
      (order?.status === "Confirmed" || order?.status === "LRCreated"),
    ),
    select: (res) => res.meta?.total ?? 0,
  });

  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);
  const handleDownloadOrderPdf = async (orderIdOrNumber: string) => {
    try {
      setIsDownloadingPdf(true);
      const encodedId = encodeURIComponent(orderIdOrNumber);

      const API_URL =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

      const response = await fetch(`${API_URL}/orders/${encodedId}/pdf`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        console.log("PDF error:", response.status, text);
        throw new Error("Failed to download PDF");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `order-${orderIdOrNumber}.pdf`;
      document.body.appendChild(a);
      a.click();

      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Unable to download PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };
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
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-5 w-32" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-56 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }
  const itemCount =
    order.orderType === "Truck"
      ? (order.truckQuantity ?? 0)
      : (order.items?.length ?? 0);

  const totalWeight =
    order.orderType === "Truck"
      ? (order.consignments?.reduce((sum, consignment) => {
          const lineWeight = Number(consignment.totalWeight ?? 0);
          if (!Number.isNaN(lineWeight) && lineWeight > 0) {
            return sum + lineWeight;
          }

          const goodsWeight =
            consignment.goods?.reduce((goodsSum, item) => {
              const weight = Number(item.weight ?? 0);
              return goodsSum + (Number.isNaN(weight) ? 0 : weight);
            }, 0) ?? 0;

          return sum + goodsWeight;
        }, 0) ?? 0)
      : (order.items?.reduce((sum, item) => {
          const weight = Number(item.weight ?? 0);
          return sum + (Number.isNaN(weight) ? 0 : weight);
        }, 0) ?? 0);

      const weightUnits =
  order.orderType === "Truck"
    ? Array.from(
        new Set(
          (order.consignments ?? [])
            .map((c) => c.unit)
            .filter((u): u is string => Boolean(u)),
        ),
      )
    : [];

const totalWeightUnit =
  weightUnits.length === 1
    ? weightUnits[0]
    : weightUnits.length > 1
      ? "Mixed"
      : undefined;
  const autoFreight =
    order.freightPreview?.matched && order.freightPreview.amount != null
      ? Number(order.freightPreview.amount)
      : null;

  const approvedFreight =
    order.bookingFreightAmount != null
      ? paiseToRupees(Number(order.bookingFreightAmount))
      : null;
  const hasApprovedFreight = approvedFreight != null;
  const displayedFreight =
    hasApprovedFreight && order.bookingFreightAmount != null
      ? formatPaise(order.bookingFreightAmount)
      : autoFreight != null
        ? formatRupees(autoFreight)
        : "-";

  const freightWasEdited =
    approvedFreight != null &&
    autoFreight != null &&
    approvedFreight !== autoFreight;

  const freightDifference =
    approvedFreight != null && autoFreight != null
      ? approvedFreight - autoFreight
      : 0;

  const isPending = order.status === "PendingApproval";
  const editable =
    order.status === "PendingApproval" ||
    order.status === "Rejected" ||
    order.status === "Confirmed";
  const cancellable =
    order.status === "PendingApproval" || order.status === "Confirmed";

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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {order.orderNumber}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(order.createdAt)}
            {order.pickupDate
              ? ` · Pickup ${formatDate(order.pickupDate)}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && editable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(
                  `/orders/${encodeURIComponent(order.orderNumber)}/edit`,
                )
              }
            >
              <IconEdit size={14} className="mr-1.5" /> Edit
            </Button>
          )}
          {canReject && isPending && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectOpen(true)}
            >
              <IconX size={14} className="mr-1.5" /> Reject
            </Button>
          )}
          {canCancel && cancellable && (
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
              onClick={() => setCancelOpen(true)}
            >
              <IconBan size={14} className="mr-1.5" /> Cancel
            </Button>
          )}
          {canApprove && isPending && (
            <Button size="sm" onClick={() => setApproveOpen(true)}>
              <IconCheck size={14} className="mr-1.5" /> Approve
            </Button>
          )}
        </div>
      </div>
      {order.status === "Rejected" && order.rejectionReason && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong className="font-medium">Rejection reason: </strong>
            {order.rejectionReason}
          </div>
        </div>
      )}
      {order.status === "Cancelled" && order.cancelReason && (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <IconBan size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong className="font-medium text-foreground">Cancelled: </strong>
            {order.cancelReason}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <CardSection title="Customer & Route">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Customer" value={order.customer?.name} />
              <Field label="From branch" value={order.fromBranch?.name} />
              <Field label="To branch" value={order.toBranch?.name} />
              <Field label="Pickup date" value={formatDate(order.pickupDate)} />
              {order.orderType !== "Truck" && (
                <Field
                  label="Pickup location"
                  value={
                    order.customerLocation?.name ?? order.pickupAddressOverride
                  }
                />
              )}
              <Field
                label="Order type"
                value={
                  order.orderType === "Truck" ? "Truck hire" : "Goods transport"
                }
              />
            </dl>
          </CardSection>

          <CardSection
            title="Order Items"
            action={
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            }
          >
            {order.orderType === "Truck" ? (
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Vehicle type" value={order.vehicleType?.name} />
                <Field label="Truck quantity" value={order.truckQuantity} />
                {(order.status === "Confirmed" ||
                  order.status === "LRCreated") &&
                  order.truckQuantity != null && (
                    <Field
                      label="LRs created"
                      value={
                        <span
                          className={`font-medium ${
                            (lrCountsQuery.data ?? 0) >= order.truckQuantity
                              ? "text-red-600"
                              : "text-foreground"
                          }`}
                        >
                          {lrCountsQuery.data ?? "—"} / {order.truckQuantity}
                          {(lrCountsQuery.data ?? 0) >= order.truckQuantity && (
                            <span className="ml-1.5 rounded-sm bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                              Full
                            </span>
                          )}
                        </span>
                      }
                    />
                  )}
              </dl>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs uppercase">Goods</TableHead>
                      <TableHead className="text-xs uppercase">Qty</TableHead>
                      <TableHead className="text-xs uppercase">Unit</TableHead>
                      <TableHead className="text-xs uppercase">
                        Weight
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items?.map(
                      (i: {
                        id: string;
                        goods?: { name: string } | null;
                        quantity: number;
                        unit: string;
                        weight?: string | null;
                      }) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">
                            {i.goods?.name ?? "—"}
                          </TableCell>
                          <TableCell>{i.quantity}</TableCell>
                          <TableCell>{i.unit}</TableCell>
                          <TableCell>{i.weight ?? "—"}</TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Freight total */}
            <div className="mt-4 rounded-lg border bg-muted/40 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total booking freight
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                    {order.status === "PendingApproval"
                      ? `Order not confirmed yet`
                      : ` ${formatPaise(order.bookingFreightAmount)} `}
                  </p>
                </div>

                {!hasApprovedFreight && autoFreight != null ? (
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Auto Preview
                  </span>
                ) : !hasApprovedFreight ? (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    No Rate
                  </span>
                ) : freightWasEdited ? (
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                    Edited
                  </span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                    Auto Rate
                  </span>
                )}
              </div>

              {freightWasEdited &&
              autoFreight != null &&
              approvedFreight != null ? (
                <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <p className="text-orange-700/70">Auto freight</p>
                      <p className="font-medium">{formatRupees(autoFreight)}</p>
                    </div>

                    <div>
                      <p className="text-orange-700/70">Approved freight</p>
                      <p className="font-medium">
                        {formatRupees(approvedFreight)}
                      </p>
                    </div>

                    <div>
                      <p className="text-orange-700/70">Difference</p>
                      <p className="font-semibold">
                        {freightDifference > 0 ? "+" : ""}
                        {formatRupees(freightDifference)}
                      </p>
                    </div>
                  </div>

                  {order.freightOverrideReason ? (
                    <p className="mt-2">
                      <span className="font-semibold">Reason:</span>{" "}
                      {order.freightOverrideReason}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!freightWasEdited && autoFreight != null ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {hasApprovedFreight
                    ? "Freight matched with rate matrix and was approved without manual change."
                    : "Freight matched with rate matrix. It will be saved when the order is approved."}
                </p>
              ) : null}
            </div>
          </CardSection>

          {order.orderType === "Truck" &&
          (order.consignments?.length ?? 0) > 0 ? (
            <CardSection
              title="Consignment Lines"
              icon={<IconPackage size={14} />}
              action={
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {order.consignments!.length}{" "}
                  {order.consignments!.length === 1 ? "line" : "lines"}
                </span>
              }
            >
              <div className="space-y-3">
                {order.consignments!.map((c, idx) => (
                  <div key={c.id} className="rounded-lg border bg-muted/20 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        LR {idx + 1}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Truck #{c.truckIndex}
                      </span>
                      <div className="ml-auto flex items-center gap-2 text-sm">
                        <span className="font-medium">
                          {c.loadingLocation?.name ?? (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </span>
                        <IconArrowRight
                          size={15}
                          className="shrink-0 text-muted-foreground"
                        />
                        <span className="font-medium">
                          {c.unloadingLocation?.name ?? (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border bg-card">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableHead className="text-xs uppercase">
                              Goods
                            </TableHead>
                            <TableHead className="text-xs uppercase">
                              Qty
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(c.goods ?? []).map((g) => (
                            <TableRow key={g.id}>
                              <TableCell className="font-medium">
                                {g.goods?.name ?? "—"}
                              </TableCell>
                              <TableCell>{g.quantity}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            </CardSection>
          ) : null}

          <CardSection title="Contact & Freight Details">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Contact person" value={order.contactPersonName} />
              <Field label="Mobile" value={order.contactMobile} />
              <Field label="Email" value={order.contactEmail} />
              <Field
                label="Approved by"
                value={
                  order.approvedBy
                    ? `${order.approvedBy.firstName} ${order.approvedBy.lastName}`
                    : null
                }
              />
              <Field
                label="Approval date"
                value={
                  order.approvedAt ? formatDateTime(order.approvedAt) : null
                }
              />
              {order.freightOverrideReason && (
                <Field
                  label="Freight override"
                  value={order.freightOverrideReason}
                />
              )}
            </dl>

            {order.specialInstructions && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="mb-1 text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">
                  Special Instructions
                </p>
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  {order.specialInstructions}
                </p>
              </div>
            )}
          </CardSection>
        </div>

        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Total weight"
              value={totalWeight.toLocaleString()}
            sub={totalWeightUnit}
            />
            <StatCard label="Items" value={itemCount} />
          </div>

          {/* Timeline */}
          <CardSection title="Timeline">
            <OrderTimeline events={order.events ?? []} />
          </CardSection>

          {/* Quick actions */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
              Quick actions
            </p>
            <div className="flex flex-col gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start gap-2 text-sm font-normal"
                disabled={isDownloadingPdf}
                onClick={() => handleDownloadOrderPdf(order.id)}
              >
                {isDownloadingPdf ? (
                  <IconLoader2 size={14} className="animate-spin" />
                ) : (
                  <IconDownload size={14} />
                )}

                {isDownloadingPdf ? "Downloading..." : "Download PDF"}
              </Button>

              {canCreateLR &&
                order.orderType === "Truck" &&
                order.status === "Confirmed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start gap-2 text-sm font-normal"
                    onClick={() =>
                      router.push(`/lorry-receipts/new?orderId=${order.id}`)
                    }
                  >
                    <IconFileText size={14} /> Create LR
                  </Button>
                )}
            </div>
          </section>
        </div>
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
