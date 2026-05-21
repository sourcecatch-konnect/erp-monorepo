"use client";

import * as React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@skerp/ui/components/table";

import { Button } from "@skerp/ui/components/button";
import { IconEdit, IconTrash } from "@tabler/icons-react";

type AccessorColumn<T> = {
  type: "accessor";
  header: string;
  accessor: keyof T;
  align?: "left" | "center" | "right";
};

type RenderColumn<T> = {
  type: "render";
  header: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
};

type Column<T> = AccessorColumn<T> | RenderColumn<T>;

type Props<T extends { id: string }> = {
  title?: string;
  data: T[];
  columns: Column<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (id: string) => void;
  onAddNew?: () => void;
};

export default function MasterTable<T extends { id: string }>({
  title = "Data List",
  data,
  columns,
  onEdit,
  onDelete,
  onAddNew
}: Props<T>) {
  const hasActions = Boolean(onEdit || onDelete);

  const renderCell = (column: Column<T>, row: T) => {
    if (column.type === "accessor") {
      return String(row[column.accessor] ?? "");
    }
    return column.render(row);
  };

  const getAlignClass = (align?: string) => {
    switch (align) {
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">
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

      {/* TABLE */}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            {columns.map((col, i) => (
              <TableHead
                key={i}
                className={getAlignClass(col.align)}
              >
                {col.header}
              </TableHead>
            ))}

            {hasActions && (
              <TableHead className="text-right pr-4">
                Actions
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (hasActions ? 1 : 0)}
                className="text-center py-10 text-muted-foreground"
              >
                No data available
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow
                key={row.id}
                className="hover:bg-muted/40 transition"
              >
                {columns.map((col, i) => (
                <TableCell className={getAlignClass(col.align)}>
  <span className="text-sm font-medium text-foreground">
    {renderCell(col, row)}
  </span>
</TableCell>
                ))}

     {hasActions && (
  <TableCell className="text-right w-[120px]">
    <div className="flex justify-end items-center gap-1">
      
      {onEdit && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onEdit(row)}
        >
          <IconEdit size={16} />
        </Button>
      )}

      {onDelete && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-red-600 hover:bg-red-50"
          onClick={() => onDelete(row.id)}
        >
          <IconTrash size={16} />
        </Button>
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
  );
}