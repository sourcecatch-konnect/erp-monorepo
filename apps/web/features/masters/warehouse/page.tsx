"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WarehouseWithRelations } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { warehouseApi } from "./warehouse.service";
import { warehouseKeys } from "./warehouse.key";

import WarehouseForm from "./warehouseForm";
import { createWarehouseSchema } from "@skerp/validators";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { warehouseColumns } from "./warehouseTable";
import WarehouseDetailDialog from "./warehouseDialog";
/* -----------------------------
   CSV TYPE
------------------------------ */
type WarehouseCsvRow = Record<
  | "name"
  | "type"
  | "address"
  | "country"
  | "stateId"
  | "cityId"
  | "branchId"
  | "contactName"
  | "contactPhone"
  | "monthlyRent"
  | "securityDeposit"
  | "length"
  | "width"
  | "breadth"
  | "gateNo"
  | "storageCapacity",
  string
>;

export default function WarehousePage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
const [selected, setSelected] = React.useState<WarehouseWithRelations | null>(null);
  const [size, setSize] = React.useState(10);
  const debouncedSearch = useDebouncedValue(search);
const [detailOpen, setDetailOpen] = React.useState(false);
const [detailId, setDetailId] = React.useState<string | null>(null);
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
const warehouses = useQuery({
  queryKey: warehouseKeys.list(listQuery),
  queryFn: () => warehouseApi.list(listQuery),
});
  /* -----------------------------
     LIST
  ------------------------------ */
const { remove } = useMasterMutations({
  api: warehouseApi,
  queryKey: warehouseKeys.all,
});

  /* -----------------------------
     BULK DELETE
  ------------------------------ */
  const bulkRemove = useMutation({
    mutationFn: warehouseApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    },
  });

  /* -----------------------------
     BULK IMPORT
  ------------------------------ */
  const bulkImport = useMutation({
    mutationFn: warehouseApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    },
  });

  /* -----------------------------
     EXPORT
  ------------------------------ */
  const exportWarehouses = useMutation({
    mutationFn: warehouseApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "warehouses.csv");
    },
  });

  /* -----------------------------
     SUBMIT
  ------------------------------ */

  return (
    <MasterListPage
      title="Warehouses"
      data={warehouses.data?.data ?? []}
      columns={warehouseColumns}
      isLoading={warehouses.isLoading}
      defaultHiddenColumns={[
        "address",
        "contactPhone",
        "securityDeposit",
        "length",
        "width",
        "breadth",
        "gateNo",
      ]}
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      onSizeChange={setSize}
      total={warehouses.data?.meta?.total ?? 0}
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

        const rows = parseCsvRows<WarehouseCsvRow>(text);

        const parsedRows = rows.map((row) =>
          createWarehouseSchema.parse({
            ...row,
            monthlyRent: row.monthlyRent || undefined,
            securityDeposit: row.securityDeposit || undefined,
            length: row.length || undefined,
            width: row.width || undefined,
            breadth: row.breadth || undefined,
            storageCapacity: row.storageCapacity || undefined,
          })
        );

        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportWarehouses.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportWarehouses.isPending}
    >
  <WarehouseDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  id={detailId}
/>

<WarehouseForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
/>
    </MasterListPage>
  );
}