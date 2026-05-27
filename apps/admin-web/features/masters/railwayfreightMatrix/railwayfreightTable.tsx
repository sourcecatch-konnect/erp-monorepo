"use client";

import { ColumnDef } from "@tanstack/react-table";
import type {
  RailwayFreightMatrixWithRelations,
} from "@skerp/types";

import {
  IconTrain,
  IconMapPin,
  IconArrowRight,
  IconCash,
} from "@tabler/icons-react";

const formatNumber = (value?: number | null, suffix = "") => {
  if (value == null) return "-";
  return `${value}${suffix}`;
};

const formatCurrency = (value?: number | null) => {
  if (value == null) return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
};

export const railwayFreightColumns:
ColumnDef<RailwayFreightMatrixWithRelations>[] = [
  {
    accessorKey: "wagonType",
    header: "Wagon Type",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconTrain size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.wagonType}</span>
          <span className="text-xs text-muted-foreground">
            Railway Freight
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "sourceCity",
    header: "Source City",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        <IconMapPin size={12} />
        {row.original.sourceCity?.name ?? "-"}
      </span>
    ),
  },

  {
    accessorKey: "destinationCity",
    header: "Destination City",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
        <IconArrowRight size={12} />
        {row.original.destinationCity?.name ?? "-"}
      </span>
    ),
  },

  {
    accessorKey: "freightAmount",
    header: "Freight Amount",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <IconCash size={12} />
        {formatCurrency(row.original.freightAmount)}
      </span>
    ),
  },
];