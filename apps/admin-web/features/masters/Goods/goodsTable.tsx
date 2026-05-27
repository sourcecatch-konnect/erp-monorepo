"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Goods } from "@skerp/types";
import {
  IconBox,
  IconCategory,
  IconRuler,
  IconWeight,
  IconStack2,
  IconCheck,
  IconX,
  IconCalendar,
} from "@tabler/icons-react";

const formatDate = (value?: string | Date | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

const formatNumber = (value?: number | null) => {
  if (value == null) return "-";
  return value.toLocaleString("en-IN");
};

export const goodsColumns: ColumnDef<Goods>[] = [
  {
    accessorKey: "name",
    header: "Goods",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBox size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.description ?? "No description"}
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        <IconCategory size={12} />
        {row.original.category}
      </span>
    ),
  },

  {
    accessorKey: "storagePosition",
    header: "Position",
    cell: ({ row }) => row.original.storagePosition ?? "-",
  },

  {
    accessorKey: "storageLayer",
    header: "Layer",
    cell: ({ row }) => row.original.storageLayer ?? "-",
  },

  {
    accessorKey: "weight",
    header: "Weight",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconWeight size={13} />
        {formatNumber(row.original.weight)} kg
      </span>
    ),
  },

  {
    id: "dimensions",
    header: "Dimensions",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-sky-700">
          <IconRuler size={12} />
          L: {formatNumber(row.original.length)}
        </span>

        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-violet-700">
          W: {formatNumber(row.original.width)}
        </span>

        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">
          H: {formatNumber(row.original.height)}
        </span>
      </div>
    ),
  },

  {
    accessorKey: "isStackingAllowed",
    header: "Stacking",
    cell: ({ row }) =>
      row.original.isStackingAllowed ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <IconCheck size={12} />
          Allowed
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <IconX size={12} />
          Not Allowed
        </span>
      ),
  },

  {
    accessorKey: "lorryReceiptId",
    header: "LR",
    cell: ({ row }) => row.original.lorryReceiptId ?? "-",
  },

  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-xs">
        <IconCalendar size={12} />
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },

  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-xs">
        <IconCalendar size={12} />
        {formatDate(row.original.updatedAt)}
      </span>
    ),
  },
];