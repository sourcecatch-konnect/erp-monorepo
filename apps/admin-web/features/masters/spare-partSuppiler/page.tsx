"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateSparePartSupplierBody,
  SparePartSupplier,
} from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { cityApi } from "../city/city.service";
import { cityKeys } from "../city/city.keys";

import { sparePartSupplierKeys } from "./spare-partSupplier.key";
import { sparePartSupplierApi } from "./spare-partSupplier.service";
import SparePartSupplierForm from "./spare-partSupplierForm";
import { sparePartSupplierColumns } from "./spare-partSupplierTable";
import { createSparePartSupplierSchema } from "@skerp/validators";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import MasterDetailDialog from "../_shared/MasterDetailDialog";
import SparePartSupplierDetailDialog from "./spare-partSupplierDialog";

type SparePartSupplierCsvRow = Record<
  | "name"
  | "type"
  | "shopName"
  | "address"
  | "cityId"
  | "contactPerson"
  | "contactPhone"
  | "mobileNo"
  | "email"
  | "panNo"
  | "gstin",
  string
>;

export default function SparePartSupplierPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SparePartSupplier | null>(
    null
  );
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
const [detailOpen, setDetailOpen] = React.useState(false);
const [detailId, setDetailId] = React.useState<string | null>(null);
  const size = 25;
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "name:asc",
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [debouncedSearch, page]
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const suppliers = useQuery({
    queryKey: sparePartSupplierKeys.list(listQuery),
    queryFn: () => sparePartSupplierApi.list(listQuery),
  });

  const cities = useQuery({
    queryKey: cityKeys.list(),
    queryFn: () => cityApi.list(),
  });



 const supplierDetail = useQuery({
  queryKey: detailId
    ? sparePartSupplierKeys.detail(detailId)
    : ["spare-part-supplier-detail-empty"],
  queryFn: () => sparePartSupplierApi.detail(detailId!),
  enabled: Boolean(detailOpen && detailId),
});
  const { create, update, remove } = useMasterMutations({
   api: sparePartSupplierApi,
   queryKey: sparePartSupplierKeys.all,
 });

  const bulkRemove = useMutation({
    mutationFn: sparePartSupplierApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: sparePartSupplierKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: sparePartSupplierApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sparePartSupplierKeys.all });
    },
  });

  const exportData = useMutation({
    mutationFn: sparePartSupplierApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "spare-part-suppliers.csv");
    },
  });

  const handleSubmit = async (data: CreateSparePartSupplierBody) => {
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
      title="Spare Part Suppliers"
      data={suppliers.data?.data ?? []}
      columns={sparePartSupplierColumns}
      defaultHiddenColumns={[
        "shopName",
        "contactPerson",
        "mobileNo",
        "email",
        "address",
        "panNo",
        "gstin",
        "createdAt",
        "updatedAt",
      ]}
      isLoading={suppliers.isLoading}
      search={search}
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={suppliers.data?.meta?.total ?? 0}
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
        const rows = parseCsvRows<SparePartSupplierCsvRow>(text);

        const parsedRows = rows.map((row) =>
          createSparePartSupplierSchema.parse(row)
        );

        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportData.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportData.isPending}
    >
  <SparePartSupplierDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  data={supplierDetail.data}
  isLoading={supplierDetail.isLoading}
/>
      <SparePartSupplierForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        cities={cities.data?.data ?? []}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
    </MasterListPage>
  );
}