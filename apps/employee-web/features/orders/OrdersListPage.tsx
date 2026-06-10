"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Order } from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { IconPlus } from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import { orderApi } from "./order.service";
import { orderKeys } from "./order.keys";
import OrderTable from "./OrderTable";
import OrderQuickViewModal from "./OrderQuickViewModal";
import ReasonDialog from "./ReasonDialog";
import getErrorMessage from "./_shared/getErrorMessage";
import ApproveOrderModal from "./ApproveOrderModal";

function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}


export default function OrdersListPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [page, setPage] = React.useState(0);
    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState("ALL");
    const debouncedSearch = useDebouncedValue(search);
    const size = 25;

    const [quickViewId, setQuickViewId] = React.useState<string | null>(null);
    const [cancelOrder, setCancelOrder] = React.useState<Order | null>(null);
    const [approveId, setApproveId] = React.useState<string | null>(null);
    const [rejectOrder, setRejectOrder] = React.useState<Order | null>(null);
    const canCreate = useCan(PERMS.ORDER.CREATE);
    const canUpdate = useCan(PERMS.ORDER.UPDATE);
    const canCancel = useCan(PERMS.ORDER.CANCEL);
    const canApprove = useCan(PERMS.ORDER.APPROVE);
    const canReject = useCan(PERMS.ORDER.REJECT);
    const canDelete = useCan(PERMS.ORDER.DELETE);

    React.useEffect(() => setPage(0), [debouncedSearch, statusFilter]);

    const listQuery = React.useMemo(
        () => ({
            page,
            size,
            ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
            ...(statusFilter !== "ALL" ? { filter: { status: statusFilter } } : {}),
        }),
        [page, debouncedSearch, statusFilter]
    );

    const orders = useQuery({
        queryKey: orderKeys.list(listQuery),
        queryFn: () => orderApi.list(listQuery),
        staleTime: 30 * 1000,
        placeholderData: (prev) => prev,
    });

    const counts = useQuery({
        queryKey: orderKeys.statusCounts,
        queryFn: orderApi.statusCounts,
        staleTime: 60 * 1000,
    });

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: orderKeys.all });

    const cancel = useMutation({
        mutationFn: (vars: { id: string; reason: string }) =>
            orderApi.cancel(vars.id, { reason: vars.reason }),
        onSuccess: () => {
            toast.success("Order cancelled");
            setCancelOrder(null);
            invalidate();
        },
        onError: (e) => toast.error(getErrorMessage(e)),
    });

    const approveDetail = useQuery({
        queryKey: approveId ? orderKeys.detail(approveId) : ["order-approve-empty"],
        queryFn: () => orderApi.detail(approveId as string),
        enabled: Boolean(approveId),
    });

    const reject = useMutation({
        mutationFn: (vars: { id: string; reason: string }) =>
            orderApi.reject(vars.id, { reason: vars.reason }),
        onSuccess: () => {
            toast.success("Order rejected");
            setRejectOrder(null);
            invalidate();
        },
        onError: (e) => toast.error(getErrorMessage(e)),
    });
    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold">Orders</h1>
                    <p className="text-sm text-muted-foreground">
                        View and manage your branch orders.
                    </p>
                </div>
                {/* New Order button — disabled with toast if no permission */}
                <Button
                    aria-disabled={!canCreate}
                    className={!canCreate ? "opacity-50 cursor-not-allowed" : ""}
                    onClick={() => {
                        if (!canCreate) {
                            toast.error("You don't have permission to create orders. Contact your admin.");
                            return;
                        }
                        router.push("/orders/new");
                    }}
                >
                    <IconPlus size={16} className="mr-1" /> New Order
                </Button>
            </div>

            <OrderTable
                data={orders.data?.data ?? []}
                total={orders.data?.meta?.total ?? 0}
                page={page}
                size={size}
                onPageChange={setPage}
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                counts={counts.data ?? {}}
                isLoading={orders.isLoading}
                canApprove={canApprove}
                canReject={canReject}
                canUpdate={canUpdate}
                canCancel={canCancel}
                onQuickView={(o) => setQuickViewId(o.id)}
                onApprove={(o) => setApproveId(o.id)}
                onReject={(o) => setRejectOrder(o)}
                onCancel={(o) => setCancelOrder(o)}
            />

            <OrderQuickViewModal
                orderId={quickViewId}
                open={Boolean(quickViewId)}
                onOpenChange={(open) => !open && setQuickViewId(null)}
            />

            {approveDetail.data ? (
                <ApproveOrderModal
                    order={approveDetail.data}
                    open={Boolean(approveId)}
                    onOpenChange={(open) => !open && setApproveId(null)}
                    onApproved={invalidate}
                />
            ) : null}

            <ReasonDialog
                open={Boolean(rejectOrder)}
                onOpenChange={(open) => !open && setRejectOrder(null)}
                title={`Reject order ${rejectOrder?.orderNumber ?? ""}`}
                description="The creator will be notified with this reason."
                confirmLabel="Reject order"
                destructive
                isPending={reject.isPending}
                onConfirm={(reason) => {
                    if (rejectOrder) reject.mutate({ id: rejectOrder.id, reason });
                }}
            />
        </div>
    );
}