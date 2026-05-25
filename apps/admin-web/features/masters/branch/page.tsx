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

import { cityApi } from "../city/city.service";
import { companyApi } from "../Company/company.service";
import { companyKeys } from "../Company/company.key";
import { cityKeys } from "../city/city.keys";
import { toast } from "sonner";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

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

  const branches = useQuery({
    queryKey: branchKeys.list(listQuery),
    queryFn: () => branchApi.list(listQuery),
  });

  const companies = useQuery({
    queryKey: companyKeys.list({ size: 1000 }),
    queryFn: () => companyApi.list({ size: 1000 }),
  });

  const cities = useQuery({
    queryKey: cityKeys.list({ size: 1000 }),
    queryFn: () => cityApi.list({ size: 1000 }),
  });

const { create, update, remove } = useMasterMutations({
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

  const handleSubmit = async (
    data: CreateBranchBody
  ) => {
    if (selected) {
      await update.mutateAsync({
        id: selected.id,
        data,
      });
    } else {
      await create.mutateAsync(data);
    }

    setOpen(false);
    setSelected(null);
  };

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
      onExport={() =>
        exportBranches.mutate(listQuery)
      }
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportBranches.isPending}
    >
      <BranchForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        companies={companies.data?.data ?? []}
        cities={cities.data?.data ?? []}
        onSubmit={handleSubmit}
        isSubmitting={
          create.isPending ||
          update.isPending
        }
      />
    </MasterListPage>
  );
}