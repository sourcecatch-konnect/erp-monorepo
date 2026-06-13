"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateRouteBody, Route } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";


import { routeKeys } from "./route.key";
import { routeColumns } from "./routeTable";
import RouteForm from "./routeForm";

import { cityApi } from "../city/city.service";
import { cityKeys } from "../city/city.keys";

import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { routeApi } from "./routes.service";
import MasterDetailDialog from "../_shared/MasterDetailDialog";
import RouteDetailDialog from "./routeDialog";

type RouteCsvRow = Record<
  "sourceCityId" | "destinationCityId",
  string
>;

export default function RoutePage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Route | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
const [detailOpen, setDetailOpen] = React.useState(false);
const [detailId, setDetailId] = React.useState<string | null>(null);
  const size = 25;
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo(
    () => ({
      page,
      size,
      sort: "sourceCityId:asc",
      ...(debouncedSearch.trim()
        ? { search: debouncedSearch.trim() }
        : {}),
    }),
    [debouncedSearch, page]
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const routes = useQuery({
    queryKey: routeKeys.list(listQuery),
    queryFn: () => routeApi.list(listQuery),
  });

  const cities = useQuery({
    queryKey: cityKeys.list({ size: 1000 }),
    queryFn: () => cityApi.list({ size: 1000 }),
  });
const routeDetail = useQuery({
  queryKey: detailId ? routeKeys.detail(detailId) : ["route-detail-empty"],
  queryFn: () => routeApi.detail(detailId!),
  enabled: Boolean(detailOpen && detailId),
});

  const { create, update, remove } = useMasterMutations({
    api: routeApi,
    queryKey: routeKeys.all,
  });

  const bulkRemove = useMutation({
    mutationFn: routeApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: routeApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: routeKeys.all });
    },
  });

  const exportRoutes = useMutation({
    mutationFn: routeApi.export,
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "routes.csv";
      a.click();
    },
  });

  const handleSubmit = async (data: CreateRouteBody) => {
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
      title="Routes"
      data={routes.data?.data ?? []}
      columns={routeColumns}
      isLoading={routes.isLoading}
      defaultHiddenColumns={["rateMatrixEntries", "LorryReceipt", "VehicleTrip"]}
      search={search}
      onSearchChange={setSearch}
      page={page}
         onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
      size={size}
      total={routes.data?.meta?.total ?? 0}
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

        const rows = text
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [sourceCityId, destinationCityId] = line.split(",");

    if (!sourceCityId || !destinationCityId) {
      throw new Error(`Invalid row: ${line}`);
    }

    return {
      sourceCityId: sourceCityId.trim(),
      destinationCityId: destinationCityId.trim(),
    };
  });

        await bulkImport.mutateAsync(rows);
      }}
      onExport={() => exportRoutes.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportRoutes.isPending}
    >
  <RouteDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  data={routeDetail.data}
  isLoading={routeDetail.isLoading}
/>
      <RouteForm
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