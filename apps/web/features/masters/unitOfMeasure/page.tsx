"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UnitOfMeasure } from "@skerp/types";
import { createUnitOfMeasureSchema } from "@skerp/validators";
import MasterListPage from "../_shared/MasterListPage";
import { downloadBlob, ListQuery, parseCsvRows } from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import UnitOfMeasureDetailDialog from "./unitOfMeasureDialog";
import UnitOfMeasureForm from "./unitOfMeasureForm";
import { unitOfMeasureApi } from "./unitOfMeasure.service";
import { unitOfMeasureKeys } from "./unitOfMeasure.key";
import { unitOfMeasureColumns } from "./unitOfMeasureTable";

type UnitOfMeasureCsvRow = Record<
  | "code"
  | "name"
  | "category"
  | "conversionToBase"
  | "baseUnitCode"
  | "description"
  | "isActive",
  string
>;

export default function UnitOfMeasurePage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<UnitOfMeasure | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [size, setSize] = React.useState(10);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "name:asc",
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [debouncedSearch, page, size],
  );

  React.useEffect(() => setPage(0), [debouncedSearch, size]);

  const list = useQuery({
    queryKey: unitOfMeasureKeys.list(listQuery),
    queryFn: () => unitOfMeasureApi.list(listQuery),
  });


  const { remove } = useMasterMutations({
    api: unitOfMeasureApi,
    queryKey: unitOfMeasureKeys.all,
    entityName: "Unit of measure",
  });

  const bulkRemove = useMutation({
    mutationFn: unitOfMeasureApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: unitOfMeasureKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: unitOfMeasureApi.bulkImport,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: unitOfMeasureKeys.all }),
  });

  const exportData = useMutation({
    mutationFn: unitOfMeasureApi.export,
    onSuccess: (blob) => downloadBlob(blob, "unit-of-measures.csv"),
  });

  return (
    <MasterListPage
      title="Units of Measure"
      data={list.data?.data ?? []}
      columns={unitOfMeasureColumns}
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
      onView={(row) => {
        setDetailId(row.id);
        setDetailOpen(true);
      }}
      onEdit={(row) => {
        setSelected(row);
        setOpen(true);
      }}
      onDelete={(id) => remove.mutateAsync(id)}
      onBulkDelete={() => bulkRemove.mutateAsync(selectedIds)}
      onImport={async (file) => {
        const text = await file.text();
        const rows = parseCsvRows<UnitOfMeasureCsvRow>(text);
        const parsed = rows.map((row) => createUnitOfMeasureSchema.parse(row));
        await bulkImport.mutateAsync(parsed);
      }}
      onExport={() => exportData.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportData.isPending}
    >
      <UnitOfMeasureForm open={open} onOpenChange={setOpen} row={selected} />
      <UnitOfMeasureDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        id={detailId}
      />
    </MasterListPage>
  );
}
