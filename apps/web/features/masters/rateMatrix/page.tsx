"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { RateMatrix, CreateRateMatrixBody } from "@skerp/types";
import type { AgreementWithRelations } from "@skerp/types";
import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { rateMatrixApi } from "./rateMatrix.service";
import { rateMatrixKeys } from "./rateMatrix.key";
import { rateMatrixColumns } from "./rateMatrixTable";

import RateMatrixForm from "./rateMatrixForm";
import RateMatrixDetailDialog from "./rateMatrixDialog";

import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

import { agreementApi } from "../Agreements/agreements.service";
import { routeApi } from "../routes/routes.service";

/* ================= CSV TYPE ================= */
type CreateRateMatrixCsvRow = {
  agreementId: string;
  routeId: string;
  rate: string;
  transitDays?: string;
  remarks?: string;
};

export default function RateMatrixPage() {
  const queryClient = useQueryClient();

  /* ================= UI STATE ================= */
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<RateMatrix | null>(null);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const size = 25;
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(() => {
    return {
      page,
      size,
      sort: "rate:asc",
      ...(debouncedSearch.trim()
        ? { search: debouncedSearch.trim() }
        : {}),
    };
  }, [page, size, debouncedSearch]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  /* ================= LIST ================= */
  const rateMatrix = useQuery({
    queryKey: rateMatrixKeys.list(listQuery),
    queryFn: () => rateMatrixApi.list(listQuery),
  });

  /* ================= DETAIL ================= */
  const rateMatrixDetail = useQuery({
    queryKey: detailId
      ? rateMatrixKeys.detail(detailId)
      : ["rateMatrix-detail-empty"],
    queryFn: () => rateMatrixApi.detail(detailId as string),
    enabled: Boolean(detailOpen && detailId),
  });

  /* ================= MASTER DATA ================= */
  const agreements = useQuery({
    queryKey: ["agreements"],
    queryFn: () => agreementApi.list(),
  });

  const routes = useQuery({
    queryKey: ["routes"],
    queryFn: () => routeApi.list(),
  });

  /* ================= MUTATIONS ================= */
  const { create, update, remove } = useMasterMutations({
    api: rateMatrixApi,
    queryKey: rateMatrixKeys.all,
    entityName: "Rate Matrix",
    
  });

console.log("RATE MATRIX RESPONSE:", rateMatrix.data);
console.log("RATE MATRIX LIST:", rateMatrix.data?.data);
console.log("RATE MATRIX ERROR:", rateMatrix.error);
  const bulkDeleteMutation = React.useMemo(
    () => ({
      mutateAsync: async (ids: string[]) => {
        await rateMatrixApi.bulkRemove(ids);
        queryClient.invalidateQueries({ queryKey: rateMatrixKeys.all });
        setSelectedIds([]);
      },
      isPending: false,
    }),
    [queryClient]
  );

  const bulkImportMutation = React.useMemo(
    () => ({
      mutateAsync: async (rows: CreateRateMatrixBody[]) => {
        await rateMatrixApi.bulkImport(rows);
        queryClient.invalidateQueries({ queryKey: rateMatrixKeys.all });
      },
      isPending: false,
    }),
    [queryClient]
  );

  const exportMutation = React.useMemo(
    () => ({
      mutate: (query: ListQuery) => {
        rateMatrixApi.export(query).then((blob) => {
          downloadBlob(blob, "rate-matrix.csv");
        });
      },
      isPending: false,
    }),
    []
  );

  /* ================= SUBMIT ================= */
  const handleSubmit = async (data: CreateRateMatrixBody) => {
    if (selected) {
      await update.mutateAsync({ id: selected.id, data });
    } else {
      await create.mutateAsync(data);
    }

    setOpen(false);
    setSelected(null);
  };

  /* ================= IMPORT ================= */
  const handleImport = async (file: File) => {
    const text = await file.text();

    const rows = parseCsvRows<CreateRateMatrixCsvRow>(text);

    const parsedRows: CreateRateMatrixBody[] = rows.map((row) => ({
      agreementId: row.agreementId,
      routeId: row.routeId,
      rate: Number(row.rate),
      transitDays: row.transitDays ? Number(row.transitDays) : undefined,
      remarks: row.remarks || undefined,
    }));

    await bulkImportMutation.mutateAsync(parsedRows);
  };

  /* ================= UI ================= */
  return (
    <MasterListPage
      title="Rate Matrix"
      data={rateMatrix.data?.data ?? []}
      columns={rateMatrixColumns}
      isLoading={rateMatrix.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={rateMatrix.data?.meta?.total ?? 0}
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
      onDelete={(id) => remove.mutateAsync(id)}
      onBulkDelete={() => bulkDeleteMutation.mutateAsync(selectedIds)}
      onImport={handleImport}
      onExport={() => exportMutation.mutate(listQuery)}
      isBulkDeleting={bulkDeleteMutation.isPending}
      isImporting={bulkImportMutation.isPending}
      isExporting={exportMutation.isPending}
    >
      <RateMatrixDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={rateMatrixDetail.data}
        isLoading={rateMatrixDetail.isLoading}
      />

      <RateMatrixForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
  onSubmit={handleSubmit}
  isSubmitting={create.isPending || update.isPending}
agreements={
  ((agreements.data?.data ?? []) as AgreementWithRelations[]).map((a) => ({
    id: a.id,
    name: `${a.company?.name ?? "-"} - ${a.client?.name ?? "-"}`,
  }))
}
routes={
  routes.data?.data.map((r) => ({
    id: r.id,
    name: `${r.sourceCity?.name ?? "-"} to ${r.destinationCity?.name ?? "-"}`,
  })) ?? []
}
/>
    </MasterListPage>
  );
}