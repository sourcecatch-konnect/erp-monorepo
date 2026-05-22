"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { City } from "@skerp/types";

export const cityColumns: ColumnDef<City>[] = [
  {
    accessorKey: "name",
    header: "City Name",
  },
  {
    id: "state",
    header: "State",
    cell: ({ row }) => row.original.state?.name ?? "-",
  },
];
