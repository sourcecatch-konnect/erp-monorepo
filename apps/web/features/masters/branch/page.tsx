"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  Branch,
  CreateBranchBody,
  Company,
  City,
} from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";

import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { branchApi } from "./branch.service";
import { branchKeys } from "./branch.key";
import { branchColumns } from "./branchTable";
import BranchForm from "./branchForm";
import { createBranchSchema } from "@skerp/validators";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import BranchDetailDialog from "./branchDialog";

type BranchCsvRow = Record<
  | "branchCode"
  | "shortCode"
  | "name"
  | "cityId"
  | "address"
  | "contactName"
  | "contactPhone"
  | "email"
  | "weeklyOffDay"
  | "gstNo"
  | "workingHours"
  | "companyId"
  | "warehouseId",
  string
>;

export default function BranchPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Branch | null>(null);
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

  const branches = useQuery({
    queryKey: branchKeys.list(listQuery),
    queryFn: () => branchApi.list(listQuery),
  });

const { remove } = useMasterMutations({
  api: branchApi,
  queryKey: branchKeys.all,
});
const bulkRemove = useMutation({
  mutationFn: branchApi.bulkRemove,
  onSuccess: () => {
    setSelectedIds([]);
    queryClient.invalidateQueries({
      queryKey: branchKeys.all,
    });
  },
});

const bulkImport = useMutation({
  mutationFn: branchApi.bulkImport,
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: branchKeys.all,
    });
  },
});



  const exportBranches = useMutation({
    mutationFn: branchApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "branches.csv");
    },
  });


  return (
    <MasterListPage
      title="Branches"
      data={branches.data?.data ?? []}
      columns={branchColumns}
      isLoading={branches.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={branches.data?.meta?.total ?? 0}
      onPageChange={setPage}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      onSizeChange={setSize}
      defaultHiddenColumns={[
        "contactPhone",
        "email",
        "gstNo",
        "workingHours",
        "createdAt",
        "updatedAt",
      ]}
      onAdd={() => {
        setSelected(null);
        setOpen(true);
      }}
      onEdit={(row) => {
        setSelected(row);
        setOpen(true);
      }}
      onDelete={(id) =>
        remove.mutateAsync(id)
      }
      onBulkDelete={() =>
        bulkRemove.mutateAsync(selectedIds)
      }
      onImport={async (file) => {
        const text = await file.text();

        const rows =
          parseCsvRows<BranchCsvRow>(text);

        const parsedRows = rows.map((row) =>
          createBranchSchema.parse(row)
        );

        await bulkImport.mutateAsync(
          parsedRows
        );
      }}
      onView={(row) => {
  setDetailId(row.id);
  setDetailOpen(true);
}}
      onExport={() =>
        exportBranches.mutate(listQuery)
      }
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportBranches.isPending}
    >
 <BranchDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  id={detailId}
/>

<BranchForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
/>
    </MasterListPage>
  );
}