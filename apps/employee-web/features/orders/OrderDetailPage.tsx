"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from "@skerp/ui/components/table";
import { IconBan, IconEdit, IconArrowLeft, IconAlertCircle, IconCheck, IconX } from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import { orderApi } from "./order.service";
import { orderKeys } from "./order.keys";
import { StatusBadge, formatDate, formatMoney, formatDateTime } from "./order-ui";
import OrderTimeline from "./OrderTimeline";
import ReasonDialog from "./ReasonDialog";
import getErrorMessage from "./_shared/getErrorMessage";
import ApproveOrderModal from "./ApproveOrderModal";

const NO_ACCESS =
    "You don't have permission to perform this action. Contact your admin.";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {label}
            </dt>
            <dd className="text-sm text-foreground">
                {value ?? <span className="text-muted-foreground/50">—</span>}
            </dd>
        </div>
    );
}

function CardSection({
    title, children, action,
}: {
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </section>
    );
}

function StatCard({ label, value, sub }: {
    label: string; value: React.ReactNode; sub?: string;
}) {
    return (
        <div className="rounded-lg bg-muted/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-medium leading-none">
                {value}
                {sub && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{sub}</span>
                )}
            </p>
        </div>
    );
}

export default function OrderDetailPage({ orderId }: { orderId: string }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [cancelOpen, setCancelOpen] = React.useState(false);
    const [approveOpen, setApproveOpen] = React.useState(false);
    const [rejectOpen, setRejectOpen] = React.useState(false);

    const canUpdate = useCan(PERMS.ORDER.UPDATE);
    const canCancel = useCan(PERMS.ORDER.CANCEL);
    const canApprove = useCan(PERMS.ORDER.APPROVE);
    const canReject = useCan(PERMS.ORDER.REJECT);

    const { data: order, isLoading } = useQuery({
        queryKey: orderKeys.detail(orderId),
        queryFn: () => orderApi.detail(orderId),
        staleTime: 30 * 1000,
        placeholderData: (prev) => prev,
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
            <div className="mx-auto max-w-5xl space-y-4 p-6">
                <Skeleton className="h-5 w-32" />
                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                    <div className="space-y-4">
                        <Skeleton className="h-40 w-full rounded-xl" />
                        <Skeleton className="h-56 w-full rounded-xl" />
                        <Skeleton className="h-40 w-full rounded-xl" />
                    </div>
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-64 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    const itemCount =
        order.orderType === "Truck"
            ? order.truckQuantity ?? 0
            : order.items?.length ?? 0;

    const totalWeight =
        order.items?.reduce((sum, item) => {
            const w = Number(item.weight ?? 0);
            return sum + (Number.isNaN(w) ? 0 : w);
        }, 0) ?? 0;

    const isPending = order.status === "PendingApproval";
    const editable = order.status === "PendingApproval" || order.status === "Rejected";
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
                        {order.pickupDate ? ` · Pickup ${formatDate(order.pickupDate)}` : ""}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Edit — always visible, disabled + toast if no permission */}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!editable}
                        onClick={() => {
                            if (!canUpdate) { toast.error(NO_ACCESS); return; }
                            router.push(`/orders/${order.id}/edit`);
                        }}
                        className={!canUpdate ? "opacity-50 cursor-not-allowed" : ""}
                    >
                        <IconEdit size={14} className="mr-1.5" /> Edit
                    </Button>

                    {/* Cancel — always visible, disabled + toast if no permission */}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!cancellable}
                        className={
                            canCancel && cancellable
                                ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                : "opacity-50 cursor-not-allowed"
                        }
                        onClick={() => {
                            if (!canCancel) { toast.error(NO_ACCESS); return; }
                            setCancelOpen(true);
                        }}
                    >
                        <IconBan size={14} className="mr-1.5" /> Cancel
                    </Button>
                    {canReject && isPending && (
                        <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)}>
                            <IconX size={14} className="mr-1.5" /> Reject
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
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                        <strong className="font-medium">Rejection reason: </strong>
                        {order.rejectionReason}
                    </div>
                </div>
            )}
            {order.status === "Cancelled" && order.cancelReason && (
                <div className="flex items-start gap-3 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
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
                            <Field
                                label="Pickup location"
                                value={order.customerLocation?.name ?? order.pickupAddressOverride}
                            />
                            <Field
                                label="Order type"
                                value={order.orderType === "Truck" ? "Truck hire" : "Goods transport"}
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
                            </dl>
                        ) : (
                            <div className="overflow-hidden rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                                            <TableHead className="text-[11px] uppercase">Goods</TableHead>
                                            <TableHead className="text-[11px] uppercase">Qty</TableHead>
                                            <TableHead className="text-[11px] uppercase">Unit</TableHead>
                                            <TableHead className="text-[11px] uppercase">Weight</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {order.items?.map((i) => (
                                            <TableRow key={i.id}>
                                                <TableCell className="font-medium">{i.goods?.name ?? "—"}</TableCell>
                                                <TableCell>{i.quantity}</TableCell>
                                                <TableCell>{i.unit}</TableCell>
                                                <TableCell>{i.weight ?? "—"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                        <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                            <span className="text-sm text-muted-foreground">Total booking freight</span>
                            <span className="text-lg font-semibold tabular-nums text-blue-600">
                                {formatMoney(order.bookingFreightAmount)}
                            </span>
                        </div>
                    </CardSection>

                    <CardSection title="Contact & Notes">
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
                                value={order.approvedAt ? formatDateTime(order.approvedAt) : null}
                            />
                        </dl>
                        {order.specialInstructions && (
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                                    Special Instructions
                                </p>
                                <p className="text-sm text-amber-900">{order.specialInstructions}</p>
                            </div>
                        )}
                    </CardSection>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <StatCard label="Total weight" value={totalWeight.toLocaleString()} sub="kg" />
                        <StatCard label="Items" value={itemCount} />
                    </div>
                    <CardSection title="Timeline">
                        <OrderTimeline events={order.events ?? []} />
                    </CardSection>
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
        </div>
    );
}