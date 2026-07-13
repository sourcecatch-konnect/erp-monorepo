"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateWagonBody, Wagon } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import { downloadBlob, ListQuery, parseCsvRows } from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import getErrorMessage, {
  useMasterMutations,
} from "../_shared/hooks/useMasterMutation";

import { toast } from "sonner";

import { wagonApi } from "./wagon.service";
import { wagonKeys } from "./wagon.key";
import { wagonColumns } from "./wagonTable";
import WagonForm from "./wagonForm";
import WagonDetailDialog from "./wagonDialog";
type WagonCsvRow = Record<"name" | "height" | "width" | "weight", string>;

export default function WagonPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Wagon | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [size, setSize] = React.useState(10);
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "name:asc",
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [debouncedSearch, page, size],
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, size]);

  const wagons = useQuery({
    queryKey: wagonKeys.list(listQuery),
    queryFn: () => wagonApi.list(listQuery),
  });

  const { remove } = useMasterMutations({
    api: wagonApi,
    queryKey: wagonKeys.all,
    entityName: "Wagon",
  });

  const bulkRemove = useMutation({
    mutationFn: wagonApi.bulkRemove,
    onSuccess: () => {
      toast.success("Selected wagons deleted successfully");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: wagonKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const bulkImport = useMutation({
    mutationFn: wagonApi.bulkImport,
    onSuccess: () => {
      toast.success("Wagons imported successfully");
      queryClient.invalidateQueries({ queryKey: wagonKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const exportWagons = useMutation({
    mutationFn: wagonApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "wagons.csv");
      toast.success("Wagons exported successfully");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  return (
    <MasterListPage
      title="Wagons"
      data={wagons.data?.data ?? []}
      columns={wagonColumns}
      isLoading={wagons.isLoading}
      defaultHiddenColumns={[]}
      search={search}
      onSizeChange={setSize}
      onSearchChange={setSearch}
      page={page}
      size={size}
      onView={(row) => {
        setDetailId(row.id);
        setDetailOpen(true);
      }}
      total={wagons.data?.meta?.total ?? 0}
      onPageChange={setPage}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      onAdd={() => {
        setSelected(null);
        setOpen(true);
      }}
      onEdit={(row) => {
        setSelected(row);
        setOpen(true);
      }}
      onDelete={(id) => remove.mutateAsync(id)}
      onBulkDelete={() => bulkRemove.mutateAsync(selectedIds)}
      onImport={async (file) => {
        const text = await file.text();
        const rows = parseCsvRows<WagonCsvRow>(text);

        const payload: CreateWagonBody[] = rows.map((item) => ({
          name: item.name,
          height: Number(item.height),
          width: Number(item.width),
          weight: Number(item.weight),
          totalCft: null,
          capacityMt: null,
        }));
        await bulkImport.mutateAsync(payload);
      }}
      onExport={() => exportWagons.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportWagons.isPending}
    >
      <WagonDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        id={detailId}
      />
      <WagonForm open={open} onOpenChange={setOpen} row={selected} />
    </MasterListPage>
  );
}
