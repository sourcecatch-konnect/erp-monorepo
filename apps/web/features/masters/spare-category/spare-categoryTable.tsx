"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { SpareCategory } from "@skerp/types";
import {
  IconBox,
  IconFileText,
  IconCalendar,
} from "@tabler/icons-react";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

const formatLabel = (value?: string | null) => {
  if (!value) return "-";
  return value.replaceAll("_", " ");
};

export const spareCategoryColumns: ColumnDef<SpareCategory>[] = [
  {
    accessorKey: "name",
    header: "Category",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBox size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            Spare Category
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "type",
    header: "Type",
    enableHiding: false,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        {formatLabel(row.original.type)}
      </span>
    ),
  },

  {
    accessorKey: "ledgerName",
    header: "Ledger",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        <IconFileText size={12} />
        {row.original.ledgerName ?? "-"}
      </span>
    ),
  },

  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconCalendar size={13} />
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },

  {
    accessorKey: "updatedAt",
    header: "Updated At",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconCalendar size={13} />
        {formatDate(row.original.updatedAt)}
      </span>
    ),
  },
];