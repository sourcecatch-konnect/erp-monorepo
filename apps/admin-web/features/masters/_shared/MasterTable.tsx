"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@skerp/ui/components/table";

import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@skerp/ui/components/tooltip";
import { IconDatabaseOff, IconEdit, IconTrash } from "@tabler/icons-react";

type Props<T extends { id: string }> = {
  title?: string;
  data: T[];
  columns: ColumnDef<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (id: string) => void;
  onAddNew?: () => void;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  isLoading?: boolean;
};

export default function MasterTable<T extends { id: string }>({
  title = "Data List",
  data,
  columns,
  onEdit,
  onDelete,
  onAddNew,
  selectedIds = [],
  onSelectedIdsChange,
  isLoading,
}: Props<T>) {
  const hasActions = Boolean(onEdit || onDelete);
  const hasSelection = Boolean(onSelectedIdsChange);
  const selectedSet = React.useMemo(
    () => new Set(selectedIds),
    [selectedIds]
  );
  const visibleIds = data.map((row) => row.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const setSelected = (id: string, selected: boolean) => {
    if (!onSelectedIdsChange) {
      return;
    }

    const next = new Set(selectedIds);

    if (selected) {
      next.add(id);
    } else {
      next.delete(id);
    }

    onSelectedIdsChange([...next]);
  };

  const setAllVisible = (selected: boolean) => {
    if (!onSelectedIdsChange) {
      return;
    }

    const next = new Set(selectedIds);

    visibleIds.forEach((id) => {
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
    });

    onSelectedIdsChange([...next]);
  };
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="flex min-h-11 items-center justify-between border-b bg-muted/20 px-4">
        <h2 className="text-sm font-semibold text-foreground">
          {title}
        </h2>

      {onAddNew && (
  <Button
    size="sm"
    className="h-8 px-3"
    onClick={onAddNew}
  >
    + Add New
  </Button>
)}
      </div>

      <div className="overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-b bg-muted/40 hover:bg-muted/40"
            >
              {hasSelection ? (
                <TableHead className="w-11 px-4">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(value) => setAllVisible(Boolean(value))}
                    aria-label="Select all rows"
                  />
                </TableHead>
              ) : null}

              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}

              {hasActions && (
                <TableHead className="h-10 w-[104px] pr-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions
                </TableHead>
              )}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, rowIndex) => (
              <TableRow key={rowIndex} className="border-b">
                {hasSelection ? (
                  <TableCell className="w-11 px-4">
                    <Skeleton className="size-4 rounded-[4px]" />
                  </TableCell>
                ) : null}

                {columns.map((_, columnIndex) => (
                  <TableCell
                    key={columnIndex}
                    className="h-12 whitespace-nowrap"
                  >
                    <Skeleton
                      className={
                        columnIndex === 0
                          ? "h-4 w-40"
                          : columnIndex % 2 === 0
                            ? "h-4 w-28"
                            : "h-4 w-24"
                      }
                    />
                  </TableCell>
                ))}

                {hasActions ? (
                  <TableCell className="w-[104px] pr-4">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="size-7 rounded-md" />
                      <Skeleton className="size-7 rounded-md" />
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={
                  columns.length +
                  (hasActions ? 1 : 0) +
                  (hasSelection ? 1 : 0)
                }
                className="py-14 text-center text-muted-foreground"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <IconDatabaseOff size={18} />
                  </div>
                  <span className="text-sm font-medium">No records found</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-selected={selectedSet.has(row.original.id)}
                className="border-b transition-colors hover:bg-muted/30 data-[selected=true]:bg-primary/5"
              >
                {hasSelection ? (
                  <TableCell className="w-11 px-4">
                    <Checkbox
                      checked={selectedSet.has(row.original.id)}
                      onCheckedChange={(value) =>
                        setSelected(row.original.id, Boolean(value))
                      }
                      aria-label="Select row"
                    />
                  </TableCell>
                ) : null}

                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="h-12 whitespace-nowrap">
                    <span className="text-sm text-foreground">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </span>
                  </TableCell>
                ))}

     {hasActions && (
  <TableCell className="w-[104px] pr-4 text-right">
    <div className="flex justify-end items-center gap-1">
      
      {onEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
              onClick={() => onEdit(row.original)}
              aria-label="Edit row"
            >
              <IconEdit size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      )}

      {onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
              onClick={() => onDelete(row.original.id)}
              aria-label="Delete row"
            >
              <IconTrash size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      )}

    </div>
  </TableCell>
)}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </div>
    </TooltipProvider>
  );
}
