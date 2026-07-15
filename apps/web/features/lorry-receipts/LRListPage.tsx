"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import type { LRGroupListItem } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { IconFileText } from "@tabler/icons-react";
import LRFromOrderPickerDialog from "./components/LRFromOrderPickerDialog";

import { useCan } from "@/features/auth";
import { useTablePrefs } from "@/features/table-prefs";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import type { ListQuery } from "../masters/_shared/master-api";

import { lrGroupApi } from "./lr-group.service";
import { lrGroupKeys } from "./lr-group.keys";
import LRTable, { DEFAULT_LR_COLUMN_ORDER } from "./components/LRTable";

export default function LRListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(25);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [sort, setSort] = React.useState("createdAt:desc");
  const debouncedSearch = useDebouncedValue(search);

  const [cancelGroup, setCancelGroup] = React.useState<LRGroupListItem | null>(
    null,
  );
  const [orderPickerOpen, setOrderPickerOpen] = React.useState(false);

  const canCreate = useCan(PERMS.LORRY_RECEIPT.CREATE);
  const canCancel = useCan(PERMS.LORRY_RECEIPT.CANCEL);

  // Per-user layout, persisted server-side (follows the account, not the
  // browser). Defaults render until the saved layout loads.
  const { columnVisibility, setColumnVisibility, columnOrder, setColumnOrder } =
    useTablePrefs("lr-groups", DEFAULT_LR_COLUMN_ORDER);

  React.useEffect(
    () => setPage(0),
    [debouncedSearch, statusFilter, sort, size],
  );

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(statusFilter !== "ALL" ? { filter: { status: statusFilter } } : {}),
    }),
    [page, size, sort, debouncedSearch, statusFilter],
  );

  const groupList = useQuery({
    queryKey: lrGroupKeys.list(listQuery),
    queryFn: () => lrGroupApi.list(listQuery),
  });

  const counts = useQuery({
    queryKey: lrGroupKeys.statusCounts,
    queryFn: lrGroupApi.statusCounts,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: lrGroupKeys.all });

  const cancel = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      lrGroupApi.cancel(vars.id, { cancelReason: vars.reason }),
    onSuccess: () => {
      toast.success("Group cancelled");
      setCancelGroup(null);
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
              <IconFileText size={16} className="mr-1" /> Create from Order
            </Button>
            <Button onClick={() => router.push("/lorry-receipts/new")}>
              Create Instant Group
            </Button>
          </div>
        ) : null}
      </div>

      <LRTable
        data={groupList.data?.data ?? []}
        total={groupList.data?.meta?.total ?? 0}
        page={page}
        size={size}
        onPageChange={setPage}
        onSizeChange={setSize}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sort={sort}
        onSortChange={setSort}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        counts={counts.data ?? {}}
        isLoading={groupList.isLoading}
        canCancel={canCancel}
        onCancel={(g) => setCancelGroup(g)}
        onRowClick={(g) =>
          router.push(`/lorry-receipts/${encodeURIComponent(g.groupNumber)}`)
        }
      />

      <ReasonDialog
        open={Boolean(cancelGroup)}
        onOpenChange={(open) => !open && setCancelGroup(null)}
        title={`Cancel group ${cancelGroup?.groupNumber ?? ""}`}
        description="This cancels the group and all its LRs, and frees up the truck slot."
        confirmLabel="Cancel group"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => {
          if (cancelGroup) cancel.mutate({ id: cancelGroup.id, reason });
        }}
      />

      <LRFromOrderPickerDialog
        open={orderPickerOpen}
        onOpenChange={setOrderPickerOpen}
      />
    </div>
  );
}
