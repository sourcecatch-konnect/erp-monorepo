"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Agreement } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { toast } from "sonner";



import AgreementDetailDialog from "./agreementDialog";
import { agreementKeys } from "./agreements.key";
import { agreementApi } from "./agreements.service";
import { agreementColumns } from "./agreementsTable";
import AgreementForm from "./agreementsForm";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import { ListQuery } from "../_shared/master-api";

export default function AgreementPage() {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Agreement | null>(null);
const [search, setSearch] = React.useState("");
const [page, setPage] = React.useState(0);
const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
const [detailOpen, setDetailOpen] = React.useState(false);
const [detailId, setDetailId] = React.useState<string | null>(null);
const debouncedSearch = useDebouncedValue(search);
const [size, setSize] = React.useState(10);
  // ================= MASTER DATA =================


  // ================= AGREEMENTS =================

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "createdAt:asc",
      ...(debouncedSearch.trim()
        ? { search: debouncedSearch.trim() }
        : {}),
    }),
    [debouncedSearch, page, size]
  );
  React.useEffect(() => {
  setPage(0);
}, [debouncedSearch, size]);
const agreements = useQuery({
  queryKey: agreementKeys.list(listQuery),
  queryFn: () => agreementApi.list(listQuery),
});

  // ================= MASTER MUTATIONS =================
  const { remove } = useMasterMutations({
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


  return (
   <MasterListPage
  title="Agreements"
  data={agreements.data?.data ?? []}
  columns={agreementColumns}
  isLoading={agreements.isLoading}
    onView={(row) => {
  setDetailId(row.id);
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
  onSizeChange={setSize}
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
  id={detailId}
/>

<AgreementForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
/>
    </MasterListPage>
  );
}