"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateStateBody, State } from "@skerp/types";
import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import StateForm from "./StateForm";
import { stateColumns } from "./StateTable";
import { stateKeys } from "./state.keys";
import { stateApi } from "./state.service";

export default function StatePage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<State | null>(null);
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

  const states = useQuery({
    queryKey: stateKeys.list(listQuery),
    queryFn: () => stateApi.list(listQuery),
  });

  const create = useMutation({
    mutationFn: stateApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stateKeys.all });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateStateBody }) =>
      stateApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stateKeys.all });
    },
  });

  const remove = useMutation({
    mutationFn: stateApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stateKeys.all });
    },
  });

  const bulkRemove = useMutation({
    mutationFn: stateApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: stateKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: stateApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stateKeys.all });
    },
  });

  const exportStates = useMutation({
    mutationFn: stateApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "states.csv");
    },
  });

  const handleSubmit = async (data: CreateStateBody) => {
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
      title="States"
      data={states.data?.data ?? []}
      columns={stateColumns}
      isLoading={states.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={states.data?.meta?.total ?? 0}
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
        const rows = parseCsvRows<CreateStateBody>(text);
        await bulkImport.mutateAsync(rows);
      }}
      onExport={() => exportStates.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportStates.isPending}
    >
      <StateForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
    </MasterListPage>
  );
}
