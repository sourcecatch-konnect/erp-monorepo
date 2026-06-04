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
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import type { ListQuery } from "../masters/_shared/master-api";

import { orderApi } from "./order.service";
import { orderKeys } from "./order.keys";
import OrderTable from "./OrderTable";
import OrderQuickViewModal from "./OrderQuickViewModal";
import ApproveOrderModal from "./ApproveOrderModal";
import ReasonDialog from "./ReasonDialog";

export default function OrdersListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const debouncedSearch = useDebouncedValue(search);
  const size = 25;

  const [quickViewId, setQuickViewId] = React.useState<string | null>(null);
  const [approveId, setApproveId] = React.useState<string | null>(null);
  const [rejectOrder, setRejectOrder] = React.useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = React.useState<Order | null>(null);

  const canCreate = useCan(PERMS.ORDER.CREATE);
  const canApprove = useCan(PERMS.ORDER.APPROVE);
  const canReject = useCan(PERMS.ORDER.REJECT);
  const canCancel = useCan(PERMS.ORDER.CANCEL);
  const canUpdate = useCan(PERMS.ORDER.UPDATE);

  React.useEffect(() => setPage(0), [debouncedSearch, statusFilter]);

  const listQuery = React.useMemo<ListQuery>(
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
  });

  const counts = useQuery({
    queryKey: orderKeys.statusCounts,
    queryFn: orderApi.statusCounts,
  });

  const approveDetail = useQuery({
    queryKey: approveId ? orderKeys.detail(approveId) : ["order-approve-empty"],
    queryFn: () => orderApi.detail(approveId as string),
    enabled: Boolean(approveId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: orderKeys.all });
  };

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

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Orders</h1>
        {canCreate ? (
          <Button onClick={() => router.push("/orders/new")}>
            <IconPlus size={16} className="mr-1" /> New Order
          </Button>
        ) : null}
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
        canCancel={canCancel}
        canUpdate={canUpdate}
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

      <ReasonDialog
        open={Boolean(cancelOrder)}
        onOpenChange={(open) => !open && setCancelOrder(null)}
        title={`Cancel order ${cancelOrder?.orderNumber ?? ""}`}
        description="This can't be undone."
        confirmLabel="Cancel order"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => {
          if (cancelOrder) cancel.mutate({ id: cancelOrder.id, reason });
        }}
      />
    </div>
  );
}
