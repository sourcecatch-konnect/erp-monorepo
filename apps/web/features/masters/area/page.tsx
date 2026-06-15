"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Area, CreateAreaBody } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { cityApi } from "../city/city.service";
import { cityKeys } from "../city/city.keys";

import AreaForm from "./AreaForm";

import { areaApi } from "./area.service";
import { areaKeys } from "./area.key";
import { areaColumns } from "./areaTable";
import AreaDetailDialog from "./AreaDialog";
import getErrorMessage, { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { toast } from "sonner";

export default function AreaPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Area | null>(null);
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
      ...(debouncedSearch.trim()
        ? { search: debouncedSearch.trim() }
        : {}),
    }),
    [debouncedSearch, page, size]
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, size]);

  const areas = useQuery({
    queryKey: areaKeys.list(listQuery),
    queryFn: () => areaApi.list(listQuery),
  });
const areaDetail = useQuery({
  queryKey: detailId ? areaKeys.detail(detailId) : ["area-detail-empty"],
  queryFn: () => areaApi.detail(detailId!),
  enabled: Boolean(detailOpen && detailId),
});
  const cities = useQuery({
    queryKey: cityKeys.list(),
    queryFn: () => cityApi.list(),
  });

  const { create, update, remove } = useMasterMutations({
  api: areaApi,
  queryKey: areaKeys.all,
  entityName: "Area",
});

const bulkRemove = useMutation({
  mutationFn: areaApi.bulkRemove,
  onSuccess: () => {
    toast.success("Selected areas deleted successfully");
    setSelectedIds([]);
    queryClient.invalidateQueries({ queryKey: areaKeys.all });
  },
  onError: (error) => {
    toast.error(getErrorMessage(error));
  },
});

const bulkImport = useMutation({
  mutationFn: areaApi.bulkImport,
  onSuccess: () => {
    toast.success("Areas imported successfully");
    queryClient.invalidateQueries({ queryKey: areaKeys.all });
  },
  onError: (error) => {
    toast.error(getErrorMessage(error));
  },
});

const exportAreas = useMutation({
  mutationFn: areaApi.export,
  onSuccess: (blob) => {
    downloadBlob(blob, "areas.csv");
    toast.success("Areas exported successfully");
  },
  onError: (error) => {
    toast.error(getErrorMessage(error));
  },
});

  const handleSubmit = async (data: CreateAreaBody) => {
    if (selected) {
      await update.mutateAsync({ id: selected.id, data });
    } else {
      await create.mutateAsync(data);
    }

    setOpen(false);
    setSelected(null);
  };

  return (
    <MasterListPage
      title="Areas"
      data={areas.data?.data ?? []}
      columns={areaColumns}
      isLoading={areas.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
      total={areas.data?.meta?.total ?? 0}
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
      onSizeChange={setSize}
      onDelete={(id) => remove.mutateAsync(id)}
      onBulkDelete={() => bulkRemove.mutateAsync(selectedIds)}
      onImport={async (file) => {
        const text = await file.text();
        const rows = parseCsvRows<CreateAreaBody>(text);
        await bulkImport.mutateAsync(rows);
      }}
      onExport={() => exportAreas.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportAreas.isPending}
    >
<AreaDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  data={areaDetail.data}
  isLoading={areaDetail.isLoading}
/>
      <AreaForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        cities={cities.data?.data ?? []}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
    </MasterListPage>
  );
}