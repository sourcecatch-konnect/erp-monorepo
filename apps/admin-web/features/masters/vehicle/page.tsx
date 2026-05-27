"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateVehicleBody, Vehicle } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { vehicleApi } from "./vehicle.service";
import { vehicleKeys } from "./vehicle.key";
import { vehicleColumns } from "./vehicleTable";
import VehicleForm from "./vehicleForm";
import { createVehicleSchema } from "@skerp/validators";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import MasterDetailDialog from "../_shared/MasterDetailDialog";
import VehicleDetailDialog from "./vehicleDialog";
type VehicleCsvRow = Record<
  | "vehicleNumber"
  | "chasisNumber"
  | "engineNumber"
  | "ownershipType"
  | "vehicleType"
  | "capacityMT"
  | "wheels"
  | "bodyType"
  | "lengthFeet"
  | "openingKM"
  | "currentKM"
  | "purchaseDate"
  | "insuranceNumber"
  | "insuranceCompany"
  | "insuranceIssueDate"
  | "insuranceDueDate"
  | "status",
  string
>;
export default function VehiclePage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Vehicle | null>(null);
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
      sort: "vehicleNumber:asc",
      ...(debouncedSearch.trim()
        ? { search: debouncedSearch.trim() }
        : {}),
    }),
    [debouncedSearch, page]
  );
const vehicleDetail = useQuery({
  queryKey: detailId
    ? vehicleKeys.detail(detailId)
    : ["vehicle-detail-empty"],
  queryFn: () => vehicleApi.detail(detailId!),
  enabled: Boolean(detailOpen && detailId),
});
  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const vehicles = useQuery({
    queryKey: vehicleKeys.list(listQuery),
    queryFn: () => vehicleApi.list(listQuery),
  });

    const { create, update, remove } = useMasterMutations({
     api: vehicleApi,
     queryKey: vehicleKeys.all,
   });

  const bulkRemove = useMutation({
    mutationFn: vehicleApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: vehicleApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
    },
  });

  const exportVehicles = useMutation({
    mutationFn: vehicleApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "vehicles.csv");
    },
  });

  const handleSubmit = async (data: CreateVehicleBody) => {
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
      title="Vehicles"
      data={vehicles.data?.data ?? []}
      columns={vehicleColumns}
      isLoading={vehicles.isLoading}
      defaultHiddenColumns={[
    "currentKM",
    "chasisNumber",
    "engineNumber",
    "wheels",
    "bodyType",
    "lengthFeet",
    "openingKM",
    "purchaseDate",
    "insuranceNumber",
    "insuranceCompany",
    "insuranceIssueDate",
    "insuranceDueDate",
  ]}
      search={search}
      onSearchChange={setSearch}
      page={page}
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
      size={size}
      total={vehicles.data?.meta?.total ?? 0}
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
        
        const rows = parseCsvRows<VehicleCsvRow>(text);

const parsedRows = rows.map((row) =>
  createVehicleSchema.parse({
    ...row,
    status: row.status || "AVAILABLE",
  })
);

await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportVehicles.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportVehicles.isPending}
    >
      <VehicleForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
<VehicleDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  data={vehicleDetail.data}
  isLoading={vehicleDetail.isLoading}
/>
    </MasterListPage>
  );
}