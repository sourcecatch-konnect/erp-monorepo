"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { SpareCategory } from "@skerp/types";

const formatLabel = (value?: string | null) => {
  if (!value) return "-";

  return value.replaceAll("_", " ");
};

export const spareCategoryColumns: ColumnDef<SpareCategory>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableHiding: false,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => formatLabel(row.original.type),
    enableHiding: false,
  },
  {
    accessorKey: "ledgerName",
    header: "Ledger Name",
    cell: ({ row }) => row.original.ledgerName || "-",
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) =>
      row.original.createdAt
        ? new Date(row.original.createdAt).toLocaleDateString()
        : "-",
  },
  {
    accessorKey: "updatedAt",
    header: "Updated At",
    cell: ({ row }) =>
      row.original.updatedAt
        ? new Date(row.original.updatedAt).toLocaleDateString()
        : "-",
  },
];