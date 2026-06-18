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
import getErrorMessage, { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import StateDetailDialog from "./stateDialog";
import { toast } from "sonner";

export default function StatePage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<State | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [detailOpen, setDetailOpen] = React.useState(false);
const [detailId, setDetailId] = React.useState<string | null>(null);
 const [size, setSize] = React.useState(30); 
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
    [debouncedSearch, page,size]
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, size]);

  const states = useQuery({
    queryKey: stateKeys.list(listQuery),
    queryFn: () => stateApi.list(listQuery),
  });
const { remove } = useMasterMutations({
  api: stateApi,
  queryKey: stateKeys.all,
  entityName: "State",
});

const bulkRemove = useMutation({
  mutationFn: stateApi.bulkRemove,
  onSuccess: (result) => {
    toast.success("Selected states deleted successfully");
    setSelectedIds([]);
    queryClient.invalidateQueries({ queryKey: stateKeys.all });
  },
  onError: (error) => {
    toast.error(getErrorMessage(error));
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
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
  
}}
onSizeChange={setSize}
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
 
      />
     <StateDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  stateId={detailId}
/>
    </MasterListPage>
  );
}


