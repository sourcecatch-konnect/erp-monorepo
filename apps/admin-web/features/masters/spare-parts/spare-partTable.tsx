"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { SparePart } from "@skerp/types";

const formatLabel = (value?: string | null) => {
  if (!value) return "-";

  return value.replaceAll("_", " ");
};

export const sparePartColumns: ColumnDef<SparePart>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableHiding: false,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) =>
      formatLabel(row.original.type),
    enableHiding: false,
  },
  {
    id: "category",
    header: "Category",
    cell: ({ row }) =>
      row.original.category?.name ?? "-",
    enableHiding: false,
  },
  {
    id: "supplier",
    header: "Supplier",
    cell: ({ row }) =>
      row.original.supplier?.name ?? "-",
    enableHiding: false,
  },
  {
    accessorKey: "rate",
    header: "Rate",
  },
  {
    accessorKey: "minimumStock",
    header: "Minimum Stock",
  },
  {
    accessorKey: "unit",
    header: "Unit",
  },
  {
    accessorKey: "isRecyclable",
    header: "Recyclable",
    cell: ({ row }) =>
      row.original.isRecyclable
        ? "Yes"
        : "No",
  },
  {
    accessorKey: "isBatchTracked",
    header: "Batch Tracked",
    cell: ({ row }) =>
      row.original.isBatchTracked
        ? "Yes"
        : "No",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) =>
      row.original.description ?? "-",
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) =>
      row.original.createdAt
        ? new Date(
            row.original.createdAt
          ).toLocaleDateString()
        : "-",
  },
  {
    accessorKey: "updatedAt",
    header: "Updated At",
    cell: ({ row }) =>
      row.original.updatedAt
        ? new Date(
            row.original.updatedAt
          ).toLocaleDateString()
        : "-",
  },
];