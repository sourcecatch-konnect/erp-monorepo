"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { State } from "@skerp/types";

export const stateColumns: ColumnDef<State>[] = [
  {
    accessorKey: "name",
    header: "State Name",
  },
];
