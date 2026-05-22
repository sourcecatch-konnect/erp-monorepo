"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { City, CreateCityBody } from "@skerp/types";
import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import { stateApi } from "../state/state.service";
import { stateKeys } from "../state/state.keys";
import CityForm from "./CityForm";
import { cityColumns } from "./CityTable";
import { cityKeys } from "./city.keys";
import { cityApi } from "./city.service";

export default function CityPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<City | null>(null);
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

  const cities = useQuery({
    queryKey: cityKeys.list(listQuery),
    queryFn: () => cityApi.list(listQuery),
  });

  const states = useQuery({
    queryKey: stateKeys.list(),
    queryFn: () => stateApi.list(),
  });

  const create = useMutation({
    mutationFn: cityApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cityKeys.all });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateCityBody }) =>
      cityApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cityKeys.all });
    },
  });

  const remove = useMutation({
    mutationFn: cityApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cityKeys.all });
    },
  });

  const bulkRemove = useMutation({
    mutationFn: cityApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: cityKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: cityApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cityKeys.all });
    },
  });

  const exportCities = useMutation({
    mutationFn: cityApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "cities.csv");
    },
  });

  const handleSubmit = async (data: CreateCityBody) => {
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
      title="Cities"
      data={cities.data?.data ?? []}
      columns={cityColumns}
      isLoading={cities.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={cities.data?.meta?.total ?? 0}
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
        const rows = parseCsvRows<CreateCityBody>(text);
        await bulkImport.mutateAsync(rows);
      }}
      onExport={() => exportCities.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportCities.isPending}
    >
      <CityForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        states={states.data?.data ?? []}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
    </MasterListPage>
  );
}
