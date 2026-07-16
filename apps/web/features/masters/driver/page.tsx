"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Driver } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { driverApi } from "./driver.service";
import { driverKeys } from "./driver.key";
import { driverColumns } from "./driverTable";
import DriverForm from "./driverForm";
import { createDriverSchema } from "@skerp/validators";
import DriverDetailDialog from "./driverDialog";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";


type DriverCsvRow = Record<string, string>;

export default function DriverPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Driver | null>(null);
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

  const drivers = useQuery({
    queryKey: driverKeys.list(listQuery),
    queryFn: () => driverApi.list(listQuery),
  });






const { remove } = useMasterMutations({
  api: driverApi,
  queryKey: driverKeys.all,
  entityName: "Driver",
});

  const bulkRemove = useMutation({
    mutationFn: driverApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: driverApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });

  const exportDrivers = useMutation({
    mutationFn: driverApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "drivers.csv");
    },
  });


  return (
    <MasterListPage
      title="Drivers"
      data={drivers.data?.data ?? []}
      columns={driverColumns}
      isLoading={drivers.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
      total={drivers.data?.meta?.total ?? 0}
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
        const rows = parseCsvRows<DriverCsvRow>(text);

        const parsedRows = rows.map((row) =>
          createDriverSchema.parse({
            ...row,
            status: row.status || "AVAILABLE",
            type: row.type || "Permanent",
            onLeave: row.onLeave === "true",
            blackListed: row.blackListed === "true",
          })
        );

        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportDrivers.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportDrivers.isPending}
    >
   <DriverDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  id={detailId}
/>

<DriverForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
/>
    </MasterListPage>
  );
}
