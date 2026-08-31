"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { State } from "@skerp/types";
import { IconMapPin, IconBuildingSkyscraper } from "@tabler/icons-react";

export const stateColumns: ColumnDef<State>[] = [
  {
    accessorKey: "name",
    header: "State",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
          <IconMapPin size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>

        </div>
      </div>
    ),
  },

];