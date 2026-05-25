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

import { stateApi } from "../state/state.service";
import { stateKeys } from "../state/state.keys";

import { cityApi } from "../city/city.service";
import { cityKeys } from "../city/city.keys";


import { transportApi } from "./transport.service";
import { transportKeys } from "./transport.key";
import TransportForm from "./transportForm";
import { transportColumns } from "./transportTable";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

export default function TransportPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Transport | null>(null);
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

  const transports = useQuery({
    queryKey: transportKeys.list(listQuery),
    queryFn: () => transportApi.list(listQuery),
  });

  const states = useQuery({
    queryKey: stateKeys.list(),
    queryFn: () => stateApi.list(),
  });

  const cities = useQuery({
    queryKey: cityKeys.list(),
    queryFn: () => cityApi.list(),
  });

  const { create, update, remove } = useMasterMutations({
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

  const handleSubmit = async (data: CreateTransportBody) => {
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
      title="Transports"
      data={transports.data?.data ?? []}
      columns={transportColumns}
      isLoading={transports.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={transports.data?.meta?.total ?? 0}
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
        const rows = parseCsvRows<CreateTransportBody>(text);
        await bulkImport.mutateAsync(rows);
      }}
      onExport={() => exportTransports.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportTransports.isPending}
    >
      <TransportForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        states={states.data?.data ?? []}
        cities={cities.data?.data ?? []}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
    </MasterListPage>
  );
}