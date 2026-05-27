"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";

import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import getErrorMessage, {
  useMasterMutations,
} from "../_shared/hooks/useMasterMutation";

import { toast } from "sonner";

import type {
  RailwayFreightMatrix,
  CreateRailwayFreightMatrixBody,
} from "@skerp/types";
import { railwayFreightApi } from "./railwayfreight.service";
import { railwayFreightKeys } from "./railwayfreight.key";
import { railwayFreightColumns } from "./railwayfreightTable";
import RailwayFreightDetailDialog from "./railwayfreightDialog";
import RailwayFreightForm from "./railwayfreightForm";
import { cityKeys } from "../city/city.keys";
import { cityApi } from "../city/city.service";
import { wagonKeys } from "../wagon/wagon.key";
import { wagonApi } from "../wagon/wagon.service";





type RailwayFreightCsvRow = Record<
  "wagonType" | "sourceCityId" | "destinationCityId" | "freightAmount",
  string
>;

export default function RailwayFreightPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] =
    React.useState<RailwayFreightMatrix | null>(null);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const size = 25;
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "createdAt:desc",
      ...(debouncedSearch.trim()
        ? { search: debouncedSearch.trim() }
        : {}),
    }),
    [debouncedSearch, page]
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);
const cities = useQuery({
  queryKey: cityKeys.list(),
  queryFn: () => cityApi.list(),
});

const wagons = useQuery({
  queryKey: wagonKeys.list(),
  queryFn: () => wagonApi.list(),
});
  // LIST
  const railwayFreights = useQuery({
    queryKey: railwayFreightKeys.list(listQuery),
    queryFn: () => railwayFreightApi.list(listQuery),
  });

  // DETAIL
  const freightDetail = useQuery({
    queryKey: detailId
      ? railwayFreightKeys.detail(detailId)
      : ["railway-freight-empty"],
    queryFn: () => railwayFreightApi.detail(detailId!),
    enabled: Boolean(detailOpen && detailId),
  });

  // CRUD
  const { create, update, remove } = useMasterMutations({
    api: railwayFreightApi,
    queryKey: railwayFreightKeys.all,
    entityName: "Railway Freight",
  });

  // BULK DELETE
  const bulkRemove = useMutation({
    mutationFn: railwayFreightApi.bulkRemove,
    onSuccess: () => {
      toast.success("Selected freight records deleted successfully");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: railwayFreightKeys.all });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // IMPORT
  const bulkImport = useMutation({
    mutationFn: railwayFreightApi.bulkImport,
    onSuccess: () => {
      toast.success("Freight records imported successfully");
      queryClient.invalidateQueries({ queryKey: railwayFreightKeys.all });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // EXPORT
  const exportFreight = useMutation({
    mutationFn: railwayFreightApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "railway-freight.csv");
      toast.success("Export successful");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

 const handleSubmit = async (data: CreateRailwayFreightMatrixBody) => {
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
      title="Railway Freight"
      data={railwayFreights.data?.data ?? []}
      columns={railwayFreightColumns}
      isLoading={railwayFreights.isLoading}
      defaultHiddenColumns={["createdAt", "updatedAt"]}

      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={railwayFreights.data?.meta?.total ?? 0}
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
        const rows = parseCsvRows<RailwayFreightCsvRow>(text);

        await bulkImport.mutateAsync(rows as any);
      }}

      onExport={() => exportFreight.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportFreight.isPending}
    >
      {/* DETAIL */}
      <RailwayFreightDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={freightDetail.data}
        isLoading={freightDetail.isLoading}
      />

      {/* FORM */}
    <RailwayFreightForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
  cities={cities.data?.data ?? []}
  wagons={wagons.data?.data ?? []}
  onSubmit={handleSubmit}
  isSubmitting={create.isPending || update.isPending}
/>
    </MasterListPage>
  );
}