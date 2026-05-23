"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Transport } from "@skerp/types";

export const transportColumns: ColumnDef<Transport>[] = [
  {
    accessorKey: "name",
    header: "Transport Name",
  },
  {
    accessorKey: "country",
    header: "Country",
  },
  {
    accessorKey: "phoneNo",
    header: "Phone No",
  },
  {
    id: "state",
    header: "State",
    cell: ({ row }) => row.original.state?.name ?? "-",
  },
  {
    id: "city",
    header: "City",
    cell: ({ row }) => row.original.city?.name ?? "-",
  },
];