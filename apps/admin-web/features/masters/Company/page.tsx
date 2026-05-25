"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCompanyBody, Company } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { companyApi } from "./company.service";
import { companyKeys } from "./company.key";
import { companyColumns } from "./CompanyTable";
import CompanyForm from "./CompanyForm";
import { createCompanySchema } from "@skerp/validators";

import { stateApi } from "../state/state.service";
import { cityApi } from "../city/city.service";
import { stateKeys } from "../state/state.keys";
import { cityKeys } from "../city/city.keys";
import { toast } from "sonner";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

type CompanyCsvRow = Record<
  | "name"
  | "address"
  | "country"
  | "stateId"
  | "cityId"
  | "contactPhone"
  | "establishmentYear"
  | "companyPAN"
  | "mainLogoPath"
  | "companyTAN",
  string
>;

export default function CompanyPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Company | null>(null);
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

  const companies = useQuery({
    queryKey: companyKeys.list(listQuery),
    queryFn: () => companyApi.list(listQuery),
  });

  const states = useQuery({
    queryKey: stateKeys.list({ size: 1000 }),
    queryFn: () => stateApi.list({ size: 1000 }),
  });

  const cities = useQuery({
    queryKey: cityKeys.list({ size: 1000 }),
    queryFn: () => cityApi.list({ size: 1000 }),
  });

 const { create, update, remove } = useMasterMutations({
  api: companyApi,
  queryKey: companyKeys.all,
});
  const bulkRemove = useMutation({
    mutationFn: companyApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: companyApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all });
    },
  });

  const exportCompanies = useMutation({
    mutationFn: companyApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "companies.csv");
    },
  });

  const handleSubmit = async (data: CreateCompanyBody) => {
    if (selected) {
      await update.mutateAsync({ id: selected.id, data });
    } else {
      await create.mutateAsync(data);
    }

    setOpen(false);
    setSelected(null);
  };

  return (
    <>

   
    <MasterListPage
      title="Companies"
      data={companies.data?.data ?? []}
      columns={companyColumns}
      isLoading={companies.isLoading}
      defaultHiddenColumns={[
        "contactPhone",
        "establishmentYear",
        "companyPAN",
        "companyTAN",
        "mainLogoPath",
        "address",
        "createdAt",
        "updatedAt",
      ]}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={companies.data?.meta?.total ?? 0}
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

        const rows = parseCsvRows<CompanyCsvRow>(text);

        const parsedRows = rows.map((row) =>
          createCompanySchema.parse({
            ...row,
            country: row.country || "India",
          })
        );

        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportCompanies.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportCompanies.isPending}
    >
      <CompanyForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        states={states.data?.data ?? []}
        cities={cities.data?.data ?? []}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
      />
    </MasterListPage>
    </>
  );
}