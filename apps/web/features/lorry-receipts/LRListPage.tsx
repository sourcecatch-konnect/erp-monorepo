"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import type { LRListItem } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { IconPlus, IconFileText } from "@tabler/icons-react";
import LRFromOrderPickerDialog from "./components/LRFromOrderPickerDialog";

import { useCan } from "@/features/auth";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import type { ListQuery } from "../masters/_shared/master-api";

import { lorryReceiptApi } from "./lorry-receipt.service";
import { lrKeys } from "./lorry-receipt.keys";
import LRTable from "./components/LRTable";

export default function LRListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const debouncedSearch = useDebouncedValue(search);
  const size = 25;

  const [cancelLR, setCancelLR] = React.useState<LRListItem | null>(null);
  const [orderPickerOpen, setOrderPickerOpen] = React.useState(false);

  const canCreate = useCan(PERMS.LORRY_RECEIPT.CREATE);
  const canCancel = useCan(PERMS.LORRY_RECEIPT.CANCEL);

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

  const lrList = useQuery({
    queryKey: lrKeys.list(listQuery),
    queryFn: () => lorryReceiptApi.list(listQuery),
  });

  const counts = useQuery({
    queryKey: lrKeys.statusCounts,
    queryFn: lorryReceiptApi.statusCounts,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: lrKeys.all });

  const cancel = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      lorryReceiptApi.cancel(vars.id, { cancelReason: vars.reason }),
    onSuccess: () => {
      toast.success("LR cancelled");
      setCancelLR(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lorry Receipts</h1>
        {canCreate ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOrderPickerOpen(true)}>
              <IconFileText size={16} className="mr-1" /> Create LR from Order
            </Button>
            <Button onClick={() => router.push("/lorry-receipts/new")}>
              <IconPlus size={16} className="mr-1" /> Create Instant LR
            </Button>
          </div>
        ) : null}
      </div>

      <LRTable
        data={lrList.data?.data ?? []}
        total={lrList.data?.meta?.total ?? 0}
        page={page}
        size={size}
        onPageChange={setPage}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        counts={counts.data ?? {}}
        isLoading={lrList.isLoading}
        canCancel={canCancel}
        onCancel={(lr) => setCancelLR(lr)}
      />

      <ReasonDialog
        open={Boolean(cancelLR)}
        onOpenChange={(open) => !open && setCancelLR(null)}
        title={`Cancel LR ${cancelLR?.lrNumber ?? ""}`}
        description="This can't be undone. A cancelled LR frees up the truck slot."
        confirmLabel="Cancel LR"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => {
          if (cancelLR) cancel.mutate({ id: cancelLR.id, reason });
        }}
      />

      <LRFromOrderPickerDialog
        open={orderPickerOpen}
        onOpenChange={setOrderPickerOpen}
      />
    </div>
  );
}
