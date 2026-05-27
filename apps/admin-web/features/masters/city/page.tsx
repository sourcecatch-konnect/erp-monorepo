"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { City, CreateCityBody } from "@skerp/types";
import MasterListPage from "../_shared/MasterListPage";
import { useMasterPagination } from "../_shared/masterPagination";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { stateApi } from "../state/state.service";
import { stateKeys } from "../state/state.keys";
import CityForm from "./CityForm";
import { cityColumns } from "./CityTable";
import { cityKeys } from "./city.keys";
import { cityApi } from "./city.service";
import getErrorMessage, { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import CityDetailDialog from "./cityDialog";
import { toast } from "sonner";

export default function CityPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<City | null>(null);
  const { search, setSearch, page, setPage, size } = useMasterPagination();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "name:asc",
      ...(search.trim()
        ? { search: search.trim() }
        : {}),
    }),
    [search, page, size]
  );

  const cities = useQuery({
    queryKey: cityKeys.list(listQuery),
    queryFn: () => cityApi.list(listQuery),
  });
  const cityDetail = useQuery({
    queryKey: detailId ? cityKeys.detail(detailId) : ["city-detail-empty"],
    queryFn: () => cityApi.detail(detailId!),
    enabled: Boolean(detailOpen && detailId),
  });
  const states = useQuery({
    queryKey: stateKeys.list(),
    queryFn: () => stateApi.list(),
  });

const { create, update, remove } = useMasterMutations({
  api: cityApi,
  queryKey: cityKeys.all,
  entityName: "City",
});
const bulkRemove = useMutation({
  mutationFn: cityApi.bulkRemove,
onSuccess: () => {
  toast.success("Selected cities deleted successfully");
  setSelectedIds([]);
  queryClient.invalidateQueries({ queryKey: cityKeys.all });
},
onError: (error) => {
  toast.error(getErrorMessage(error));
},
});

const bulkImport = useMutation({
  mutationFn: cityApi.bulkImport,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: cityKeys.all });
  },
});

const exportCities = useMutation({
  mutationFn: cityApi.export,
  onSuccess: (blob) => {
    downloadBlob(blob, "cities.csv");
  },
});

  const handleSubmit = async (data: CreateCityBody) => {
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
      title="Cities"
      data={cities.data?.data ?? []}
      columns={cityColumns}
      isLoading={cities.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={cities.data?.meta?.total ?? 0}
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
       onView={(row) => {
        setDetailId(row.id);
        setDetailOpen(true);
      }}
      onDelete={(id) => remove.mutateAsync(id)}
      onBulkDelete={() => bulkRemove.mutateAsync(selectedIds)}
      onImport={async (file) => {
        const text = await file.text();
        const rows = parseCsvRows<CreateCityBody>(text);
        await bulkImport.mutateAsync(rows);
      }}
      onExport={() => exportCities.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportCities.isPending}
    >
      <CityForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        states={states.data?.data ?? []}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
      
    <CityDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  data={cityDetail.data}
  isLoading={cityDetail.isLoading}
/>
    </MasterListPage>
  );
}
