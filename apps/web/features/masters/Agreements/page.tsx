"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Agreement, CreateAgreementBody } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { toast } from "sonner";



import { cityApi } from "../city/city.service";
import { branchApi } from "../branch/branch.service";
import AgreementDetailDialog from "./agreementDialog";
import getErrorMessage from "../_shared/hooks/useMasterMutation";
import { companyApi } from "../Company/company.service";
import { customerApi } from "../Customer/customer.service";
import { agreementKeys } from "./agreements.key";
import { agreementApi } from "./agreements.service";
import { agreementColumns } from "./agreementsTable";
import AgreementForm from "./agreementsForm";
export default function AgreementPage() {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Agreement | null>(null);
const [search, setSearch] = React.useState("");
const [page, setPage] = React.useState(0);
const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
const [detailOpen, setDetailOpen] = React.useState(false);
const [detailData, setDetailData] = React.useState<Agreement | null>(null);
const size = 25;
  // ================= MASTER DATA =================
  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: () => companyApi.list(),
  });

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => customerApi.list(),
  });

  const cities = useQuery({
    queryKey: ["cities"],
    queryFn: () => cityApi.list(),
  });

  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchApi.list(),
  });

  // ================= AGREEMENTS =================
const listQuery = React.useMemo(
  () => ({
    page,
    size,
    sort: "createdAt:desc",
    ...(search.trim() ? { search: search.trim() } : {}),
  }),
  [page, size, search]
);

const agreements = useQuery({
  queryKey: agreementKeys.list(listQuery),
  queryFn: () => agreementApi.list(listQuery),
});

  // ================= MASTER MUTATIONS =================
  const { create, update, remove } = useMasterMutations({
    api: agreementApi,
    queryKey: agreementKeys.all,
    entityName: "Agreement",
  });
const bulkRemove = useMutation({
  mutationFn: agreementApi.bulkRemove,
  onSuccess: () => {
    toast.success("Deleted successfully");
  },
});

const bulkImport = useMutation({
  mutationFn: agreementApi.bulkImport,
});

const exportAgreements = useMutation({
  mutationFn: agreementApi.export,
});
  // ================= SUBMIT =================
  const handleSubmit = async (data: CreateAgreementBody) => {
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
  title="Agreements"
  data={agreements.data?.data ?? []}
  columns={agreementColumns}
  isLoading={agreements.isLoading}
    onView={(row) => {
  setDetailData(row);
  setDetailOpen(true);
}}
  search={search}
  onSearchChange={setSearch}

  page={page}
  size={size}
  total={agreements.data?.meta?.total ?? 0}
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
    const rows = JSON.parse(text);
    await bulkImport.mutateAsync(rows);
  }}

  onExport={() => exportAgreements.mutate(listQuery)}

  isBulkDeleting={bulkRemove.isPending}
>
  <AgreementDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  data={detailData ?? undefined}
  isLoading={false}
/>
      <AgreementForm
        open={open}
        onOpenChange={setOpen}
        row={selected}
        onSubmit={handleSubmit}
        isSubmitting={create.isPending || update.isPending}
        companies={companies.data?.data ?? []}
        customers={customers.data?.data ?? []}
        cities={cities.data?.data ?? []}
        branches={branches.data?.data ?? []}
      />
    </MasterListPage>
  );
}