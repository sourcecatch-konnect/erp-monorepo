"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateSparePartBody,
  SparePart,
} from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { sparePartKeys } from "./spare-parts.key";
import { sparePartApi } from "./spare-parts.service";
import SparePartForm from "./spare-partsForm";
import { sparePartColumns } from "./spare-partTable";
import { createSparePartSchema } from "@skerp/validators";

import { spareCategoryApi } from "../spare-category/spare-cateogry.service";
import { spareCategoryKeys } from "../spare-category/spare-category.key";

import { sparePartSupplierApi } from "../spare-partSuppiler/spare-partSupplier.service";
import { sparePartSupplierKeys } from "../spare-partSuppiler/spare-partSupplier.key";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import MasterDetailDialog from "../_shared/MasterDetailDialog";
import SparePartDetailDialog from "./spare-partDialog";
type SparePartCsvRow = Record<
  | "name"
  | "type"
  | "categoryId"
  | "supplierId"
  | "rate"
  | "minimumStock"
  | "unit"
  | "isRecyclable"
  | "isBatchTracked"
  | "description",
  string
>;

export default function SparePartPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SparePart | null>(null);
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

  const spareParts = useQuery({
    queryKey: sparePartKeys.list(listQuery),
    queryFn: () => sparePartApi.list(listQuery),
  });

  const categories = useQuery({
    queryKey: spareCategoryKeys.list(),
    queryFn: () => spareCategoryApi.list(),
  });

  const suppliers = useQuery({
    queryKey: sparePartSupplierKeys.list(),
    queryFn: () => sparePartSupplierApi.list(),
  });

const sparePartDetail = useQuery({
  queryKey: detailId
    ? sparePartKeys.detail(detailId)
    : ["spare-part-detail-empty"],
  queryFn: () => sparePartApi.detail(detailId!),
  enabled: Boolean(detailOpen && detailId),
});

 const { create, update, remove } = useMasterMutations({
  api: sparePartApi,
  queryKey: sparePartKeys.all,
});

  const bulkRemove = useMutation({
    mutationFn: sparePartApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: sparePartKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: sparePartApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sparePartKeys.all });
    },
  });

  const exportData = useMutation({
    mutationFn: sparePartApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "spare-parts.csv");
    },
  });

  const handleSubmit = async (data: CreateSparePartBody) => {
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
      title="Spare Parts"
      data={spareParts.data?.data ?? []}
      columns={sparePartColumns}
      defaultHiddenColumns={[
        "supplier",
        "isRecyclable",
        "isBatchTracked",
        "description",
        "createdAt",
        "updatedAt",
      ]}
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
      isLoading={spareParts.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={spareParts.data?.meta?.total ?? 0}
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
      onDelete={(id) => remove.mutateAsync(id)}
      onBulkDelete={() => bulkRemove.mutateAsync(selectedIds)}
      onImport={async (file) => {
        const text = await file.text();
        const rows = parseCsvRows<SparePartCsvRow>(text);

        const parsedRows = rows.map((row) =>
          createSparePartSchema.parse({
            ...row,
            isRecyclable: row.isRecyclable === "true",
            isBatchTracked: row.isBatchTracked === "true",
          })
        );

        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportData.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportData.isPending}
    >
      <SparePartForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        categories={categories.data?.data ?? []}
        suppliers={suppliers.data?.data ?? []}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
<SparePartDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  data={sparePartDetail.data}
  isLoading={sparePartDetail.isLoading}
/>
    </MasterListPage>
  );
}