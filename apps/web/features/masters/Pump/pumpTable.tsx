"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Pump } from "@skerp/types";

import {
  IconGasStation,
  IconMapPin,
  IconCash,
  IconCircleCheck,
  IconCircleX,
} from "@tabler/icons-react";
import { formatCurrencyFromPaise } from "../_shared/dialog-parts";

const formatDate = (value?: string | Date | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

export const pumpColumns: ColumnDef<Pump>[] = [
  {
    accessorKey: "name",
    header: "Pump",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconGasStation size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.address ?? "Fuel Station"}
          </span>
        </div>
      </div>
    ),
  },

{
  id: "location",
  header: "Location",
  cell: ({ row }) => {
    const city = row.original.city?.name ?? "-";
    const state = row.original.state?.name ?? "-";

    return (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
          <IconMapPin size={15} />
        </span>

        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {city}
          </span>
          <span className="text-xs text-muted-foreground">
            {state}
          </span>
        </div>
      </div>
    );
  },
},

  {
    accessorKey: "currentDieselRate",
    header: "Diesel Rate",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm font-medium">
        <IconCash size={13} />
        {formatCurrencyFromPaise(row.original.currentDieselRate)}
      </span>
    ),
  },

  {
    accessorKey: "creditLimit",
    header: "Credit Limit",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm font-medium">
        <IconCash size={13} />
        {formatCurrencyFromPaise(row.original.creditLimit)}
      </span>
    ),
  },

  {
    accessorKey: "pan",
    header: "PAN",
    cell: ({ row }) => row.original.pan ?? "-",
  },

  {
    accessorKey: "isBlackListed",
    header: "Status",
    cell: ({ row }) =>
      row.original.isBlackListed ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <IconCircleX size={12} />
          Blacklisted
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <IconCircleCheck size={12} />
          Active
        </span>
      ),
  },

  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },

  {
    accessorKey: "updatedAt",
    header: "Updated At",
    cell: ({ row }) => formatDate(row.original.updatedAt),
  },
];
