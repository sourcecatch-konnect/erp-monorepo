"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { LabourWithRelations } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { labourApi } from "./labour.service";
import { labourKeys } from "./labour.key";
import { labourColumns } from "./labourTable";
import { createLabourSchema } from "@skerp/validators";

import LabourAdvancedForm from "./labourForm";
import LabourDetailDialog from "./labourDialog";



import getErrorMessage, { useMasterMutations } from "../_shared/hooks/useMasterMutation";

type LabourCsvRow = Record<
  | "name"
  | "photoPath"
  | "address"
  | "cityId"
  | "contactName"
  | "contactPhone"
  | "mobileNo"
  | "referredBy"
  | "refContactNo"
  | "startDate"
  | "pan"
  | "tdsAmount"
  | "tdsRate"
  | "type"
  | "branchId",
  string
>;

export default function LabourPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<LabourWithRelations | null>(null);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const [size, setSize] = React.useState(10);

  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(() => ({
    page,
    size,
    sort: "name:asc",
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
  }), [debouncedSearch, page, size]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, size]);

  // ---------------- LIST ----------------
  const labours = useQuery({
    queryKey: labourKeys.list(listQuery),
    queryFn: () => labourApi.list(listQuery),
  });



  // ---------------- MASTER MUTATIONS ----------------
  const { remove } = useMasterMutations({
    api: labourApi,
    queryKey: labourKeys.all,
    entityName: "Labour",
  });

  // ---------------- BULK DELETE ----------------
  const bulkRemove = useMutation({
    mutationFn: labourApi.bulkRemove,
    onSuccess: () => {
      toast.success("Selected labour deleted successfully");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: labourKeys.all });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ---------------- IMPORT ----------------
  const bulkImport = useMutation({
    mutationFn: labourApi.bulkImport,
    onSuccess: () => {
      toast.success("Labour imported successfully");
      queryClient.invalidateQueries({ queryKey: labourKeys.all });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ---------------- EXPORT ----------------
  const exportLabour = useMutation({
    mutationFn: labourApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "labours.csv");
      toast.success("Labour exported successfully");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ---------------- SUBMIT ----------------


  return (
    <MasterListPage
      title="Labours"
      data={labours.data?.data ?? []}
      columns={labourColumns}
      isLoading={labours.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      onSizeChange={setSize}
      total={labours.data?.meta?.total ?? 0}
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
      onBulkDelete={() => bulkRemove.mutateAsync(selectedIds)}
      onImport={async (file) => {
        const text = await file.text();
        const rows = parseCsvRows<LabourCsvRow>(text);

        const parsedRows = rows.map((row) =>
          createLabourSchema.parse(row)
        );

        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportLabour.mutate(listQuery)}
    >
  <LabourDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  id={detailId}
/>

<LabourAdvancedForm
  open={open}
  onOpenChange={setOpen}
  row={selected}
/>
    </MasterListPage>
  );
}