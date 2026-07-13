"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTransportBody, Transport } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";




import { transportApi } from "./transport.service";
import { transportKeys } from "./transport.key";
import TransportForm from "./transportForm";
import { transportColumns } from "./transportTable";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import TransportDetailDialog from "./transportDialog";

export default function TransportPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Transport | null>(null);
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

  const transports = useQuery({
    queryKey: transportKeys.list(listQuery),
    queryFn: () => transportApi.list(listQuery),
  });



  const {  remove } = useMasterMutations({
   api: transportApi,
   queryKey: transportKeys.all,
 });

  const bulkRemove = useMutation({
    mutationFn: transportApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: transportKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: transportApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transportKeys.all });
    },
  });

  const exportTransports = useMutation({
    mutationFn: transportApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "transports.csv");
    },
  });



  return (
    <MasterListPage
      title="Transports"
      data={transports.data?.data ?? []}
      columns={transportColumns}
      isLoading={transports.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
      total={transports.data?.meta?.total ?? 0}
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
        const rows = parseCsvRows<CreateTransportBody>(text);
        await bulkImport.mutateAsync(rows);
      }}
      onExport={() => exportTransports.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportTransports.isPending}
    >
<TransportDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  id={detailId}
/>
      <TransportForm
        open={open}
        onOpenChange={setOpen}
        row={selected}

      />
    </MasterListPage>
  );
}