"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { VehicleType, CreateVehicleTypeBody } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import { downloadBlob, ListQuery, parseCsvRows } from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { createVehicleTypeSchema } from "@skerp/validators";

import { vehicleTypeApi } from "./vehicleType.service";
import { vehicleTypeKeys } from "./vehicleType.key";
import { vehicleTypeColumns } from "./vehicleTypeTable";
import VehicleTypeForm from "./vehicleTypeForm";

type VehicleTypeCsvRow = Record<
  "code" | "name" | "freightRangeFrom" | "freightRangeTo",
  string
>;

export default function VehicleTypePage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<VehicleType | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [size, setSize] = React.useState(10);

  const debouncedSearch = useDebouncedValue(search);
  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "name:asc",
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [debouncedSearch, page, size]
  );

  React.useEffect(() => setPage(0), [debouncedSearch, size]);

  const list = useQuery({
    queryKey: vehicleTypeKeys.list(listQuery),
    queryFn: () => vehicleTypeApi.list(listQuery),
  });

  const { create, update, remove } = useMasterMutations({
    api: vehicleTypeApi,
    queryKey: vehicleTypeKeys.all,
    entityName: "Vehicle type",
  });

  const bulkRemove = useMutation({
    mutationFn: vehicleTypeApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: vehicleTypeKeys.all });
    },
  });
  const bulkImport = useMutation({
    mutationFn: vehicleTypeApi.bulkImport,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: vehicleTypeKeys.all }),
  });
  const exportData = useMutation({
    mutationFn: vehicleTypeApi.export,
    onSuccess: (blob) => downloadBlob(blob, "vehicle-types.csv"),
  });

  const handleSubmit = async (data: CreateVehicleTypeBody) => {
    if (selected) await update.mutateAsync({ id: selected.id, data });
    else await create.mutateAsync(data);
    setOpen(false);
    setSelected(null);
  };

  return (
    <MasterListPage
      title="Vehicle Types"
      data={list.data?.data ?? []}
      columns={vehicleTypeColumns}
      isLoading={list.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={list.data?.meta?.total ?? 0}
      onPageChange={setPage}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      onSizeChange={setSize}
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
        const rows = parseCsvRows<VehicleTypeCsvRow>(text);
        const parsed = rows.map((r) => createVehicleTypeSchema.parse(r));
        await bulkImport.mutateAsync(parsed);
      }}
      onExport={() => exportData.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportData.isPending}
    >
      <VehicleTypeForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
    </MasterListPage>
  );
}
