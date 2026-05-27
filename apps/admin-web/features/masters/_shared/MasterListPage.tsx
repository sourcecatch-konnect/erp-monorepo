"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import MasterTable from "./MasterTable";

type Props<T extends { id: string }> = {
  title: string;
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  size: number;
  total: number;
  onView?: (row: T) => void;
  onPageChange: (page: number) => void;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onAdd: () => void;
  onEdit: (row: T) => void;
  onDelete: (id: string) => void;
  onBulkDelete: () => void;
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
  isBulkDeleting?: boolean;
  isImporting?: boolean;
  isExporting?: boolean;
  children?: React.ReactNode;
  defaultHiddenColumns?: string[];
};

export default function MasterListPage<T extends { id: string }>({
  title,
  data,
  columns,
  isLoading,
  search,
  onSearchChange,
  page,
  size,
  onView,
  total,
  onPageChange,
  defaultHiddenColumns,
  selectedIds,
  onSelectedIdsChange,
  onAdd,
  onEdit,
  onDelete,
  onBulkDelete,
  onImport,
  onExport,
  isBulkDeleting,
  isImporting,
  isExporting,
  children,
}: Props<T>) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const isFirstPage = page <= 0;
  const isLastPage = page >= pageCount - 1;

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <div className="text-sm text-muted-foreground">
            {total} records
            {selectedIds.length > 0 ? `, ${selectedIds.length} selected` : ""}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 ? (
            <Button
              variant="destructive"
              onClick={onBulkDelete}
              disabled={isBulkDeleting}
              className="gap-2"
            >
              <IconTrash size={16} />
              {isBulkDeleting ? "Deleting..." : `Delete ${selectedIds.length}`}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="gap-2"
          >
            <IconUpload size={16} />
            {isImporting ? "Importing..." : "Import"}
          </Button>
          <Button
            variant="outline"
            onClick={onExport}
            disabled={isExporting}
            className="gap-2"
          >
            <IconDownload size={16} />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
          <Button onClick={onAdd} className="gap-2">
            <IconPlus size={16} />
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-3 py-3 shadow-sm">
        <div className="relative w-full max-w-sm">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="h-8 pl-9 shadow-none"
            value={search}
            placeholder={`Search ${title.toLowerCase()}`}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
           <span>
    Showing {page * size + 1}–
    {Math.min((page + 1) * size, total)}
    {" "}of {total}
  </span>

  <span>
    Page {page + 1} of {pageCount}
  </span>
        <div className="flex items-center gap-1">
  <Button
    size="icon-sm"
    variant="outline"
    onClick={() => onPageChange(page - 1)}
    disabled={isFirstPage || isLoading}
  >
    <IconChevronLeft size={16} />
  </Button>

  {Array.from(
    { length: Math.min(pageCount, 5) },
    (_, i) => (
      <Button
        key={i}
        size="icon-sm"
        variant={page === i ? "default" : "outline"}
        onClick={() => onPageChange(i)}
      >
        {i + 1}
      </Button>
    )
  )}

  <Button
    size="icon-sm"
    variant="outline"
    onClick={() => onPageChange(page + 1)}
    disabled={isLastPage || isLoading}
  >
    <IconChevronRight size={16} />
  </Button>
</div>
        </div>
      </div>

      <MasterTable
        title={isLoading ? "Loading..." : title}
        data={data}
        columns={columns}
        onEdit={onEdit}
        onDelete={onDelete}
        onView={onView}
        defaultHiddenColumns={defaultHiddenColumns}
        selectedIds={selectedIds}
        onSelectedIdsChange={onSelectedIdsChange}
        isLoading={isLoading}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];

          if (file) {
            await onImport(file);
            event.target.value = "";
          }
        }}
      />

      {children}
    </div>
  );
}
