"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Creditor } from "@skerp/types";
import { IconBuildingBank } from "@tabler/icons-react";
import { formatPaise } from "@/lib/money";

const formatLabel = (value?: string | null) => {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const creditorColumns: ColumnDef<Creditor>[] = [
  {
    accessorKey: "name",
    header: "Creditor",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBuildingBank size={14} />
        </span>
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
        {formatLabel(row.original.category)}
      </span>
    ),
  },
  {
    accessorKey: "defaultMode",
    header: "Default Mode",
    cell: ({ row }) => formatLabel(row.original.defaultMode),
  },
  {
    accessorKey: "outstandingBalance",
    header: "Outstanding",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatPaise(row.original.outstandingBalance)}
      </span>
    ),
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => row.original.phone || "-",
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) =>
      row.original.isActive ? (
        <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Active
        </span>
      ) : (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Inactive
        </span>
      ),
  },
];
