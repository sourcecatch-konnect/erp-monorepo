"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateWarehouseBody, Warehouse } from "@skerp/types";

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
import { stateApi } from "../state/state.service";
import { cityApi } from "../city/city.service";
import { branchApi } from "../branch/branch.service";
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
  const [selected, setSelected] = React.useState<Warehouse | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const size = 25;
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
    [debouncedSearch, page]
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  /* -----------------------------
     LIST
  ------------------------------ */
  const warehouses = useQuery({
    queryKey: warehouseKeys.list(listQuery),
    queryFn: () => warehouseApi.list(listQuery),
  });

  const statesQuery = useQuery({
  queryKey: ["states"],
  queryFn: () => stateApi.list(),
});

const citiesQuery = useQuery({
  queryKey: ["cities"],
  queryFn: () => cityApi.list(),
});

const branchesQuery = useQuery({
  queryKey: ["branches"],
  queryFn: () => branchApi.list(),
});
  const { create, update, remove } = useMasterMutations({
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
  const handleSubmit = async (data: CreateWarehouseBody) => {
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
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
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
      <WarehouseForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
  cities={citiesQuery.data?.data ?? []}
  states={statesQuery.data?.data ?? []}
  branches={branchesQuery.data?.data ?? []}
  onSubmit={handleSubmit}
  isSubmitting={create.isPending || update.isPending}
/>
    </MasterListPage>
  );
}