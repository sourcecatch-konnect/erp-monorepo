"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateSpareCategoryBody,
  SpareCategory,
} from "@skerp/types";

import MasterListPage from "../_shared/MasterListPage";

import {
  downloadBlob,
  ListQuery,
  parseCsvRows,
} from "../_shared/master-api";

import { useDebouncedValue } from "../_shared/hooks/useDebouncedValue";

import { spareCategoryKeys } from "./spare-category.key";
import { spareCategoryApi } from "./spare-cateogry.service";
import SpareCategoryForm from "./spare-categoryForm";
import { spareCategoryColumns } from "./spare-categoryTable";
import { createSpareCategorySchema } from "@skerp/validators";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";

type SpareCategoryCsvRow = Record<
  "name" | "type" | "ledgerName",
  string
>;

export default function SpareCategoryPage() {
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] =
    React.useState<SpareCategory | null>(null);

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] =
    React.useState<string[]>([]);

  const size = 25;

  const debouncedSearch =
    useDebouncedValue(search);

  const listQuery = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "name:asc",

      ...(debouncedSearch.trim()
        ? {
            search:
              debouncedSearch.trim(),
          }
        : {}),
    }),
    [debouncedSearch, page]
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const spareCategories = useQuery({
    queryKey:
      spareCategoryKeys.list(
        listQuery
      ),

    queryFn: () =>
      spareCategoryApi.list(
        listQuery
      ),
  });

 const { create, update, remove } = useMasterMutations({
  api: spareCategoryApi,
  queryKey: spareCategoryKeys.all,
});

  const bulkRemove =
    useMutation({
      mutationFn:
        spareCategoryApi.bulkRemove,

      onSuccess: () => {
        setSelectedIds([]);

        queryClient.invalidateQueries({
          queryKey:
            spareCategoryKeys.all,
        });
      },
    });

  const bulkImport =
    useMutation({
      mutationFn:
        spareCategoryApi.bulkImport,

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey:
            spareCategoryKeys.all,
        });
      },
    });

  const exportData =
    useMutation({
      mutationFn:
        spareCategoryApi.export,

      onSuccess: (blob) => {
        downloadBlob(
          blob,
          "spare-categories.csv"
        );
      },
    });

  const handleSubmit =
    async (
      data: CreateSpareCategoryBody
    ) => {
      if (selected) {
        await update.mutateAsync({
          id: selected.id,
          data,
        });
      } else {
        await create.mutateAsync(
          data
        );
      }

      setOpen(false);
      setSelected(null);
    };

  return (
    <MasterListPage
      title="Spare Categories"
      data={
        spareCategories.data
          ?.data ?? []
      }
      columns={
        spareCategoryColumns
      }
      isLoading={
        spareCategories.isLoading
      }
      search={search}
      onSearchChange={
        setSearch
      }
      page={page}
      size={size}
      total={
        spareCategories.data
          ?.meta?.total ?? 0
      }
      onPageChange={
        setPage
      }
      selectedIds={
        selectedIds
      }
      onSelectedIdsChange={
        setSelectedIds
      }
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
        bulkRemove.mutateAsync(
          selectedIds
        )
      }
      onImport={async (
        file
      ) => {
        const text =
          await file.text();

        const rows =
          parseCsvRows<SpareCategoryCsvRow>(
            text
          );

        const parsedRows =
          rows.map((row) =>
            createSpareCategorySchema.parse(
              row
            )
          );

        await bulkImport.mutateAsync(
          parsedRows
        );
      }}
      onExport={() =>
        exportData.mutate(
          listQuery
        )
      }
      isBulkDeleting={
        bulkRemove.isPending
      }
      isImporting={
        bulkImport.isPending
      }
      isExporting={
        exportData.isPending
      }
    >
      <SpareCategoryForm
        open={open}
        onOpenChange={
          setOpen
        }
        row={selected}
        onSubmit={
          handleSubmit
        }
        isSubmitting={
          create.isPending ||
          update.isPending
        }
      />
    </MasterListPage>
  );
}