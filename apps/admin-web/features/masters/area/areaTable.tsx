"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Area } from "@skerp/types";
import {
  IconMapPin,
  IconBuildingCommunity,
} from "@tabler/icons-react";

export const areaColumns: ColumnDef<Area>[] = [
  {
    accessorKey: "name",
    header: "Area",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconMapPin size={14} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            Area Name
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "city",
    header: "City",
    enableHiding: false,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        <IconBuildingCommunity size={12} />
        {row.original.city?.name ?? "-"}
      </span>
    ),
  },
];