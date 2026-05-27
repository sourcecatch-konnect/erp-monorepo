"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Wagon } from "@skerp/types";

import {
  IconTrain,
  IconRulerMeasure,
  IconScale,
} from "@tabler/icons-react";

const formatNumber = (value?: number | null, suffix = "") => {
  if (value == null) return "-";
  return `${value}${suffix}`;
};

export const wagonColumns: ColumnDef<Wagon>[] = [
  {
    accessorKey: "name",
    header: "Wagon",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconTrain size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            Railway Wagon
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "height",
    header: "Height",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        <IconRulerMeasure size={12} />
        {formatNumber(row.original.height)}
      </span>
    ),
  },
  {
    accessorKey: "width",
    header: "Width",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
        <IconRulerMeasure size={12} />
        {formatNumber(row.original.width)}
      </span>
    ),
  },
  {
    accessorKey: "weight",
    header: "Weight",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <IconScale size={12} />
        {formatNumber(row.original.weight)}
      </span>
    ),
  },
];