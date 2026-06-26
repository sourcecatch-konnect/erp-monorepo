"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Creditor } from "@skerp/types";
import { createCreditorSchema } from "@skerp/validators";

import MasterListPage from "../_shared/MasterListPage";
import { downloadBlob, ListQuery, parseCsvRows } from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

import { creditorApi } from "./creditor.service";
import { creditorKeys } from "./creditor.keys";
import { creditorColumns } from "./creditorTable";
import CreditorForm from "./CreditorForm";

type CreditorCsvRow = Record<string, string>;

export default function CreditorPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Creditor | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
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

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, size]);

  const creditors = useQuery({
    queryKey: creditorKeys.list(listQuery),
    queryFn: () => creditorApi.list(listQuery),
  });

  const { remove } = useMasterMutations({
    api: creditorApi,
    queryKey: creditorKeys.all,
    entityName: "Creditor",
  });

  const bulkRemove = useMutation({
    mutationFn: creditorApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: creditorKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: creditorApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creditorKeys.all });
    },
  });

  const exportCreditors = useMutation({
    mutationFn: creditorApi.export,
    onSuccess: (blob) => downloadBlob(blob, "creditors.csv"),
  });

  return (
    <MasterListPage
      title="Creditors"
      data={creditors.data?.data ?? []}
      columns={creditorColumns}
      isLoading={creditors.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={creditors.data?.meta?.total ?? 0}
      onPageChange={setPage}
      onSizeChange={setSize}
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
        const rows = parseCsvRows<CreditorCsvRow>(text);
        const parsedRows = rows.map((row) =>
          createCreditorSchema.parse({
            ...row,
            category: row.category || "OTHER",
            isActive: row.isActive ? row.isActive === "true" : true,
          }),
        );
        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportCreditors.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportCreditors.isPending}
    >
      <CreditorForm open={open} onOpenChange={setOpen} row={selected} />
    </MasterListPage>
  );
}
