"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { SparePart } from "@skerp/types";
import {
  IconBox,
  IconCategory,
  IconTruck,
  IconCurrencyRupee,
  IconScale,
  IconRecycle,
  IconPackages,
  IconCalendar,
} from "@tabler/icons-react";

const formatLabel = (value?: string | null) => {
  if (!value) return "-";
  return value.replaceAll("_", " ");
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

const formatCurrency = (value?: number | string | null) => {
  if (value == null || value === "") return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));
};

export const sparePartColumns: ColumnDef<SparePart>[] = [
  {
    accessorKey: "name",
    header: "Spare Part",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBox size={15} />
        </span>

        <span className="font-medium">{row.original.name}</span>
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
    id: "category",
    header: "Category",
    enableHiding: false,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
        <IconCategory size={12} />
        {row.original.category?.name ?? "-"}
      </span>
    ),
  },

  {
    id: "supplier",
    header: "Supplier",
    enableHiding: false,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <IconTruck size={12} />
        {row.original.supplier?.name ?? "-"}
      </span>
    ),
  },

  {
    accessorKey: "rate",
    header: "Rate",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1">
        <IconCurrencyRupee size={13} />
        {formatCurrency(row.original.rate)}
      </span>
    ),
  },

  {
    accessorKey: "minimumStock",
    header: "Min Stock",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1">
        <IconScale size={13} />
        {row.original.minimumStock ?? "-"}
      </span>
    ),
  },

  {
    accessorKey: "unit",
    header: "Unit",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        {row.original.unit ?? "-"}
      </span>
    ),
  },

  {
    accessorKey: "isRecyclable",
    header: "Recyclable",
    cell: ({ row }) =>
      row.original.isRecyclable ? (
        <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          Yes
        </span>
      ) : (
        <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          No
        </span>
      ),
  },

  {
    accessorKey: "isBatchTracked",
    header: "Batch",
    cell: ({ row }) =>
      row.original.isBatchTracked ? (
        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          Tracked
        </span>
      ) : (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
          No
        </span>
      ),
  },

  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.description ?? "-"}
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