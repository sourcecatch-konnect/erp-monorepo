"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PERMS } from "@skerp/types";
import type { LRGroupListItem } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { IconFileText, IconPlus, IconReceipt } from "@tabler/icons-react";
import LRFromOrderPickerDialog from "./components/LRFromOrderPickerDialog";

import { useCan } from "@/features/auth";
import { useTablePrefs } from "@/features/table-prefs";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { useDebouncedValue } from "../masters/_shared/hooks/useDebouncedValue";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import type { ListQuery } from "../masters/_shared/master-api";

import { lrGroupApi } from "./lr-group.service";
import { lrGroupKeys } from "./lr-group.keys";
import { lrGroupDisplay } from "./lorry-receipt-ui";
import LRTable, { DEFAULT_LR_COLUMN_ORDER } from "./components/LRTable";

export default function LRListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
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
      toast.success(
        cancelGroup && lrGroupDisplay(cancelGroup).isSingleton
          ? "LR cancelled"
          : "Group cancelled",
      );
      setCancelGroup(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancelDisplay = cancelGroup ? lrGroupDisplay(cancelGroup) : null;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconReceipt size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Lorry Receipts
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Track every consignment from draft and dispatch through delivery
              and POD acknowledgement.
            </p>
          </div>
        </div>
        {canCreate ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              onClick={() => setOrderPickerOpen(true)}
            >
              <IconFileText size={17} /> Create from Order
            </Button>
            <Button
              size="lg"
              onClick={() => router.push("/lorry-receipts/new")}
            >
              <IconPlus size={17} /> Create Instant LR
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
          router.push(
            `/lorry-receipts/${encodeURIComponent(lrGroupDisplay(g).title)}`,
          )
        }
      />

      <ReasonDialog
        open={Boolean(cancelGroup)}
        onOpenChange={(open) => !open && setCancelGroup(null)}
        title={
          cancelDisplay?.isSingleton
            ? `Cancel LR ${cancelDisplay.title}`
            : `Cancel group ${cancelGroup?.groupNumber ?? ""}`
        }
        description={
          cancelDisplay?.isSingleton
            ? "This cancels the LR and frees up the truck slot."
            : `This cancels the group and all its ${cancelDisplay?.lrCount ?? ""} LRs, and frees up the truck slot.`
        }
        confirmLabel={cancelDisplay?.isSingleton ? "Cancel LR" : "Cancel group"}
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
