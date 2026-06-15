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
import { attachmentApi } from "@/features/attachments/attachment.client";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import { ListQuery } from "../_shared/master-api";

export default function AgreementPage() {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Agreement | null>(null);
const [search, setSearch] = React.useState("");
const [page, setPage] = React.useState(0);
const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
const [detailOpen, setDetailOpen] = React.useState(false);
const [detailData, setDetailData] = React.useState<Agreement | null>(null);
const debouncedSearch = useDebouncedValue(search);
const [size, setSize] = React.useState(10);
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
const [isUploadingAgreementFile, setIsUploadingAgreementFile] =
  React.useState(false);

const handleSubmit = async (
  data: CreateAgreementBody,
  agreementFile?: File | null,
) => {
  let agreementId = selected?.id;

  try {
    if (selected) {
      await update.mutateAsync({
        id: selected.id,
        data,
      });

      agreementId = selected.id;
    } else {
      const createdAgreement = await create.mutateAsync(data);

      agreementId = createdAgreement?.id;

      if (!agreementId) {
        toast.error("Agreement created but agreement ID was not returned.");
        return;
      }
    }

    if (agreementFile && agreementId) {
      try {
        setIsUploadingAgreementFile(true);

        await attachmentApi.upload(
          {
            entityType: "agreement",
            entityId: agreementId,
            originalName: agreementFile.name,
            mime: agreementFile.type || "application/pdf",
            sizeBytes: agreementFile.size,
          },
          agreementFile,
        );

        toast.success("Agreement file uploaded successfully");
      } catch (uploadError) {
        console.error("Agreement file upload failed:", uploadError);

        toast.warning(
          "Agreement saved, but file upload failed. Please configure S3 bucket and upload again.",
        );
      } finally {
        setIsUploadingAgreementFile(false);
      }
    }

    setOpen(false);
    setSelected(null);
  } catch (error) {
    toast.error(getErrorMessage(error));
  }
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
  data={detailData ?? undefined}
  isLoading={false}
/>
   <AgreementForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
  onSubmit={handleSubmit}
  isSubmitting={
    create.isPending || update.isPending || isUploadingAgreementFile
  }
  companies={companies.data?.data ?? []}
  customers={customers.data?.data ?? []}
  cities={cities.data?.data ?? []}
  branches={branches.data?.data ?? []}
/>
    </MasterListPage>
  );
}