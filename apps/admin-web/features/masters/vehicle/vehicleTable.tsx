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
    enableHiding: false,
  },
  {
    accessorKey: "ownershipType",
    header: "Ownership",
    cell: ({ row }) => formatLabel(row.original.ownershipType),
    enableHiding: false,
  },
  {
    accessorKey: "vehicleType",
    header: "Vehicle Type",
    cell: ({ row }) => formatLabel(row.original.vehicleType),
    enableHiding: false,
  },
  {
    accessorKey: "capacityMT",
    header: "Capacity MT",
    enableHiding: false,
  },
  {
    accessorKey: "currentKM",
    header: "Current KM",
  },
  {
    accessorKey: "chasisNumber",
    header: "Chasis Number",
  },
  {
    accessorKey: "engineNumber",
    header: "Engine Number",
  },
  {
    accessorKey: "wheels",
    header: "Wheels",
  },
  {
    accessorKey: "bodyType",
    header: "Body Type",
  },
  {
    accessorKey: "lengthFeet",
    header: "Length Feet",
  },
  {
    accessorKey: "openingKM",
    header: "Opening KM",
  },
  {
    accessorKey: "purchaseDate",
    header: "Purchase Date",
  },
  {
    accessorKey: "insuranceNumber",
    header: "Insurance Number",
  },
  {
    accessorKey: "insuranceCompany",
    header: "Insurance Company",
  },
  {
    accessorKey: "insuranceIssueDate",
    header: "Insurance Issue Date",
  },
  {
    accessorKey: "insuranceDueDate",
    header: "Insurance Due Date",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => formatLabel(row.original.status),
    enableHiding: false,
  },
];