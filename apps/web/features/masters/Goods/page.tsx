"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateGoodsBody, Goods } from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";
import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { goodsApi } from "./goods.service";
import { goodsKeys } from "./goods.key";
import { goodsColumns } from "./goodsTable";

import { createGoodsSchema } from "@skerp/validators";

import getErrorMessage, { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { toast } from "sonner";

import GoodsForm from "./goodsForm";
import GoodsDetailDialog from "./goodsDialog";


type GoodsCsvRow = Record<
  | "name"
  | "description"
  | "weight"
  | "length"
  | "width"
  | "height"
  | "category"
  | "storagePosition"
  | "storageLayer"
  | "isStackingAllowed"
  | "lorryReceiptId",
  string
>;

export default function GoodsPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Goods | null>(null);

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
    ...(debouncedSearch.trim()
      ? { search: debouncedSearch.trim() }
      : {}),
  }), [debouncedSearch, page, size]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, size]);

  // ---------------- LIST ----------------
  const goods = useQuery({
    queryKey: goodsKeys.list(listQuery),
    queryFn: () => goodsApi.list(listQuery),
  });

  // ---------------- DETAIL ----------------
const { remove } = useMasterMutations({
  api: goodsApi,
  queryKey: goodsKeys.all,
  entityName: "Goods",
});

  // ---------------- BULK DELETE ----------------
  const bulkRemove = useMutation({
    mutationFn: goodsApi.bulkRemove,
    onSuccess: () => {
      toast.success("Selected goods deleted successfully");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: goodsKeys.all });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ---------------- IMPORT ----------------
  const bulkImport = useMutation({
    mutationFn: goodsApi.bulkImport,
    onSuccess: () => {
      toast.success("Goods imported successfully");
      queryClient.invalidateQueries({ queryKey: goodsKeys.all });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ---------------- EXPORT ----------------
  const exportGoods = useMutation({
    mutationFn: goodsApi.export,
    onSuccess: (blob) => {
      downloadBlob(blob, "goods.csv");
      toast.success("Goods exported successfully");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });



  return (
    <MasterListPage
      title="Goods"
      data={goods.data?.data ?? []}
      columns={goodsColumns}
      isLoading={goods.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={goods.data?.meta?.total ?? 0}
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
      onView={(row) => {
        setDetailId(row.id);
        setDetailOpen(true);
      }}
      onDelete={(id) => remove.mutateAsync(id)}
      onBulkDelete={() => bulkRemove.mutateAsync(selectedIds)}
      onImport={async (file) => {
        const text = await file.text();
        const rows = parseCsvRows<GoodsCsvRow>(text);

        const parsedRows = rows.map((row) =>
          createGoodsSchema.parse({
            ...row,
            isStackingAllowed:
              row.isStackingAllowed === "true" ||
              row.isStackingAllowed === "Yes" ||
              row.isStackingAllowed === "yes",
          })
        );

        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportGoods.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportGoods.isPending}
    >
      <GoodsDetailDialog
  open={detailOpen}
  onOpenChange={setDetailOpen}
  id={detailId}
/>

      <GoodsForm
        open={open}
        onOpenChange={setOpen}
        row={selected}

      />
    </MasterListPage>
  );
}