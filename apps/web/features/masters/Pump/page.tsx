"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Pump, CreatePumpBody } from "@skerp/types";

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

import { pumpApi } from "./pump.service";

import { pumpColumns } from "./pumpTable";

import PumpForm from "./pumpForm";
import PumpDetailDialog from "./pumpDialog";
import { pumpKeys } from "./pump.key";
import { stateKeys } from "../state/state.keys";
import { stateApi } from "../state/state.service";
import { cityKeys } from "../city/city.keys";
import { cityApi } from "../city/city.service";

type PumpCsvRow = Record<
  | "name"
  | "type"
  | "address"
  | "country"
  | "cityId"
  | "stateId"
  | "contactPerson"
  | "contactPhone"
  | "currentDieselRate"
  | "rateLastUpdated"
  | "gstIn"
  | "pan"
  | "creditLimit"
  | "isBlackListed",
  string
>;

export default function PumpPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Pump | null>(null);

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

  // LIST
  const pumps = useQuery({
    queryKey: pumpKeys.list(listQuery),
    queryFn: () => pumpApi.list(listQuery),
  });


  // CRUD
  const {  remove } = useMasterMutations({
    api: pumpApi,
    queryKey: pumpKeys.all,
    entityName: "Pump",
  });

  // BULK DELETE
  const bulkRemove = useMutation({
    mutationFn: pumpApi.bulkRemove,
    onSuccess: () => {
      toast.success("Selected pumps deleted successfully");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: pumpKeys.all });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // IMPORT
  const bulkImport = useMutation({
    mutationFn: pumpApi.bulkImport,
    onSuccess: () => {
      toast.success("Pumps imported successfully");
      queryClient.invalidateQueries({ queryKey: pumpKeys.all });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // EXPORT
  const exportPumps = useMutation({
    mutationFn: pumpApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "pumps.csv");
      toast.success("Pumps exported successfully");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });


  return (
    <MasterListPage
      title="Pumps"
      data={pumps.data?.data ?? []}
      columns={pumpColumns}
      isLoading={pumps.isLoading}
      defaultHiddenColumns={[
        "address",
        "contactPhone",
        "gstIn",
        "pan",
        "createdAt",
        "updatedAt",
      ]}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={pumps.data?.meta?.total ?? 0}
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
      onView={(row) => {
        setDetailId(row.id);
        setDetailOpen(true);
      }}
      onDelete={(id) => remove.mutateAsync(id)}
      onBulkDelete={() => bulkRemove.mutateAsync(selectedIds)}
      onImport={async (file) => {
        const text = await file.text();
        const rows = parseCsvRows<PumpCsvRow>(text);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await bulkImport.mutateAsync(rows as any);
      }}
      onExport={() => exportPumps.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportPumps.isPending}
    >
      {/* DETAIL */}
      <PumpDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
         id={detailId}
      />

      {/* FORM */}
      <PumpForm
  open={open}
  onOpenChange={setOpen}
  row={selected}

/>
    </MasterListPage>
  );
}