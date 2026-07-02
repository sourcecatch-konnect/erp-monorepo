"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { GRN } from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { IconPlus } from "@tabler/icons-react";

import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { useCan } from "@/features/auth";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";
import type { ListQuery } from "@/features/masters/_shared/master-api";

import GRNTable from "./GRNTable";
import {
  useCancelGRN,
  useDeleteGRN,
  useGRNs,
  useGRNStatusCounts,
  useSubmitGRN,
} from "./hook/useGrn";

export function GRNListPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [submitGRN, setSubmitGRN] = React.useState<GRN | null>(null);
  const [cancelGRN, setCancelGRN] = React.useState<GRN | null>(null);
  const [deleteGRN, setDeleteGRN] = React.useState<GRN | null>(null);

  const canCreate = useCan(PERMS.GRN.CREATE);
  const canSubmit = useCan(PERMS.GRN.SUBMIT);
  const canCancel = useCan(PERMS.GRN.CANCEL);
  const canDelete = useCan(PERMS.GRN.DELETE);
  const canCreateVPLoading = useCan(PERMS.VP_LOADING.CREATE);

  const debouncedSearch = useDebouncedValue(search);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter]);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(statusFilter !== "ALL" ? { filter: { status: statusFilter } } : {}),
    }),
    [page, size, debouncedSearch, statusFilter],
  );

  const grns = useGRNs(listQuery);
  const counts = useGRNStatusCounts();
  const submitMutation = useSubmitGRN();
  const cancelMutation = useCancelGRN();
  const deleteMutation = useDeleteGRN();

  const handleSizeChange = (nextSize: number) => {
    setSize(nextSize);
    setPage(0);
  };

  const handleView = (grn: GRN) => {
    toast.info(`${grn.grnNumber} detail screen is coming next`);
  };

  const handleCreateVPLoading = (grn: GRN) => {
    toast.info(`${grn.grnNumber} is ready for VP Loading`);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">GRN</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage goods received notes for rail-head unloading.
          </p>
        </div>

        {canCreate ? (
          <Button onClick={() => router.push("/vp-management/grn/new")}>
            <IconPlus size={16} className="mr-1" />
            Add GRN
          </Button>
        ) : null}
      </div>

      <GRNTable
        data={grns.data?.data ?? []}
        total={grns.data?.meta?.total ?? 0}
        page={page}
        size={size}
        search={search}
        statusFilter={statusFilter}
        counts={counts.data ?? {}}
        isLoading={grns.isLoading}
        canSubmit={canSubmit}
        canCancel={canCancel}
        canDelete={canDelete}
        canCreateVPLoading={canCreateVPLoading}
        onPageChange={setPage}
        onSizeChange={handleSizeChange}
        onSearchChange={setSearch}
        onStatusFilterChange={setStatusFilter}
        onView={handleView}
        onSubmit={setSubmitGRN}
        onCancel={setCancelGRN}
        onDelete={setDeleteGRN}
        onCreateVPLoading={handleCreateVPLoading}
      />

      <ConfirmDialog
        open={Boolean(submitGRN)}
        onOpenChange={(open) => !open && setSubmitGRN(null)}
        title={`Submit GRN ${submitGRN?.grnNumber ?? ""}`}
        description="Submitted GRNs are ready for VP Loading and cannot be edited as drafts."
        confirmLabel="Submit GRN"
        pendingLabel="Submitting..."
        isPending={submitMutation.isPending}
        onConfirm={() => {
          if (!submitGRN) return;

          submitMutation.mutate(
            {
              id: submitGRN.id,
              body: { version: submitGRN.version },
            },
            {
              onSuccess: () => {
                toast.success("GRN submitted");
                setSubmitGRN(null);
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          );
        }}
      />

      <ReasonDialog
        open={Boolean(cancelGRN)}
        onOpenChange={(open) => !open && setCancelGRN(null)}
        title={`Cancel GRN ${cancelGRN?.grnNumber ?? ""}`}
        description="This keeps the GRN record but stops it from being used for new VP Loading."
        confirmLabel="Cancel GRN"
        destructive
        isPending={cancelMutation.isPending}
        onConfirm={(reason) => {
          if (!cancelGRN) return;

          cancelMutation.mutate(
            {
              id: cancelGRN.id,
              body: { reason, version: cancelGRN.version },
            },
            {
              onSuccess: () => {
                toast.success("GRN cancelled");
                setCancelGRN(null);
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          );
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteGRN)}
        onOpenChange={(open) => !open && setDeleteGRN(null)}
        title={`Delete GRN ${deleteGRN?.grnNumber ?? ""}`}
        description="Use this only for wrong or duplicate draft/cancelled GRNs."
        confirmLabel="Delete GRN"
        pendingLabel="Deleting..."
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteGRN) return;

          deleteMutation.mutate(deleteGRN.id, {
            onSuccess: () => {
              toast.success("GRN deleted");
              setDeleteGRN(null);
            },
            onError: (error) => toast.error(getErrorMessage(error)),
          });
        }}
      />
    </div>
  );
}
