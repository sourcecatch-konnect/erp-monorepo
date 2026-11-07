"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { DetentionSlab } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import type { ListQuery } from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

import { detentionSlabApi } from "./detention-slab.service";
import { detentionSlabKeys } from "./detention-slab.keys";
import { detentionSlabColumns } from "./DetentionSlabTable";
import DetentionSlabForm from "./DetentionSlabForm";

/**
 * Broker detention slabs (DC / LDC). The server orders active, high-priority
 * slabs first by default, so no sort is sent. No import/export or bulk delete:
 * a slab carries nested rate bands that a flat CSV cannot express.
 */
export default function DetentionSlabPage() {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<DetentionSlab | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [debouncedSearch, page, size],
  );

  React.useEffect(() => setPage(0), [debouncedSearch, size]);

  const list = useQuery({
    queryKey: detentionSlabKeys.list(listQuery),
    queryFn: () => detentionSlabApi.list(listQuery),
  });

  const { remove } = useMasterMutations({
    api: detentionSlabApi,
    queryKey: detentionSlabKeys.all,
    entityName: "Detention slab",
  });

  return (
    <MasterListPage
      title="Detention Slabs"
      data={list.data?.data ?? []}
      columns={detentionSlabColumns}
      isLoading={list.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={list.data?.meta?.total ?? 0}
      onPageChange={setPage}
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
    >
      <DetentionSlabForm open={open} onOpenChange={setOpen} row={selected} />
    </MasterListPage>
  );
}
