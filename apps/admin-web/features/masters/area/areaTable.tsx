"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Area } from "@skerp/types";

export const areaColumns: ColumnDef<Area>[] = [
  {
    accessorKey: "name",
    header: "Area Name",
  },
  {
    id: "city",
    header: "City",
    cell: ({ row }) => row.original.city?.name ?? "-",
  },
];