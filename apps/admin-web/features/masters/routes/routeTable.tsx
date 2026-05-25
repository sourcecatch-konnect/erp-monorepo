"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Route } from "@skerp/types";

export const routeColumns: ColumnDef<Route>[] = [
  {
      id: "sourceCity",
  header: "From City",
  cell: ({ row }) => row.original.sourceCity?.name ?? "-",
    enableHiding: false,
  },
  {
  id: "destinationCity",
  header: "To City",
  cell: ({ row }) => row.original.destinationCity?.name ?? "-",
    enableHiding: false,
  },
  {
    accessorKey: "rateMatrixEntries",
    header: "Rate Matrices",
    cell: ({ row }) =>
      row.original.rateMatrixEntries?.length ?? 0,
  },
  {
    accessorKey: "VehicleTrip",
    header: "Trips",
    cell: ({ row }) =>
      row.original.VehicleTrip?.length ?? 0,
  },
  {
    accessorKey: "LorryReceipt",
    header: "LR Count",
    cell: ({ row }) =>
      row.original.LorryReceipt?.length ?? 0,
  },
];