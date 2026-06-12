"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { VehicleType } from "@skerp/types";
import { IconTruck } from "@tabler/icons-react";

const money = (v?: number | null) =>
  v === null || v === undefined
    ? "-"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(v);

export const vehicleTypeColumns: ColumnDef<VehicleType>[] = [
  {
    accessorKey: "name",
    header: "Vehicle Type",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconTruck size={15} />
        </span>
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.code}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "freightRangeFrom",
    header: "Freight Range",
    cell: ({ row }) =>
      `${money(row.original.freightRangeFrom)} – ${money(row.original.freightRangeTo)}`,
  },
  {
    accessorKey: "isActive",
    header: "Active",
    cell: ({ row }) =>
      row.original.isActive ? (
        <span className="rounded-sm bg-green-100 px-2 py-0.5 text-xs text-green-700">
          Active
        </span>
      ) : (
        <span className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Inactive
        </span>
      ),
  },
];
