"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CashAccount } from "@skerp/types";
import { createCashAccountSchema } from "@skerp/validators";

import MasterListPage from "../_shared/MasterListPage";
import { downloadBlob, ListQuery, parseCsvRows } from "../_shared/master-api";
import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

import { cashAccountApi } from "./cash-account.service";
import { cashAccountKeys } from "./cash-account.keys";
import { cashAccountColumns } from "./cashAccountTable";
import CashAccountForm from "./CashAccountForm";

type CashAccountCsvRow = Record<string, string>;

export default function CashAccountPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<CashAccount | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(10);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "name:asc",
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }),
    [debouncedSearch, page, size],
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, size]);

  const accounts = useQuery({
    queryKey: cashAccountKeys.list(listQuery),
    queryFn: () => cashAccountApi.list(listQuery),
  });

  const { remove } = useMasterMutations({
    api: cashAccountApi,
    queryKey: cashAccountKeys.all,
    entityName: "Cash Account",
  });

  const bulkRemove = useMutation({
    mutationFn: cashAccountApi.bulkRemove,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: cashAccountKeys.all });
    },
  });

  const bulkImport = useMutation({
    mutationFn: cashAccountApi.bulkImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashAccountKeys.all });
    },
  });

  const exportAccounts = useMutation({
    mutationFn: cashAccountApi.export,
    onSuccess: (blob) => downloadBlob(blob, "cash-accounts.csv"),
  });

  return (
    <MasterListPage
      title="Cash Accounts"
      data={accounts.data?.data ?? []}
      columns={cashAccountColumns}
      isLoading={accounts.isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={accounts.data?.meta?.total ?? 0}
      onPageChange={setPage}
      onSizeChange={setSize}
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
        const rows = parseCsvRows<CashAccountCsvRow>(text);
        const parsedRows = rows.map((row) =>
          createCashAccountSchema.parse({
            ...row,
            type: row.type || "BANK",
            isActive: row.isActive ? row.isActive === "true" : true,
          }),
        );
        await bulkImport.mutateAsync(parsedRows);
      }}
      onExport={() => exportAccounts.mutate(listQuery)}
      isBulkDeleting={bulkRemove.isPending}
      isImporting={bulkImport.isPending}
      isExporting={exportAccounts.isPending}
    >
      <CashAccountForm open={open} onOpenChange={setOpen} row={selected} />
    </MasterListPage>
  );
}
