"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Vehicle } from "@skerp/types";

const formatLabel = (value?: string | null) => {
  if (!value) return "-";

  return value.replaceAll("_", " ");
};

export const vehicleColumns: ColumnDef<Vehicle>[] = [
  {
    accessorKey: "vehicleNumber",
    header: "Vehicle Number",
  },
  {
    accessorKey: "ownershipType",
    header: "Ownership",
    cell: ({ row }) => formatLabel(row.original.ownershipType),
  },
  {
    accessorKey: "vehicleType",
    header: "Vehicle Type",
    cell: ({ row }) => formatLabel(row.original.vehicleType),
  },
  {
    accessorKey: "capacityMT",
    header: "Capacity MT",
  },
  {
    accessorKey: "currentKM",
    header: "Current KM",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => formatLabel(row.original.status),
  },
];