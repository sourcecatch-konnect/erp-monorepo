"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Transport } from "@skerp/types";

import {
  IconTruck,
  IconPhone,
  IconMapPin,
  IconWorld,
} from "@tabler/icons-react";

export const transportColumns: ColumnDef<Transport>[] = [
  {
    accessorKey: "name",
    header: "Transport",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <IconTruck size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.name}
          </span>

          <span className="text-xs text-muted-foreground">
            Transport Provider
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "country",
    header: "Country",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
        <IconWorld size={12} />
        {row.original.country ?? "-"}
      </span>
    ),
  },

  {
    accessorKey: "phoneNo",
    header: "Contact",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconPhone size={13} />
        {row.original.phoneNo ?? "-"}
      </span>
    ),
  },

 {
  id: "location",
  header: "Location",
  cell: ({ row }) => {
    const city = row.original.city?.name ?? "-";
    const state = row.original.state?.name ?? "-";

    return (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
          <IconMapPin size={15} />
        </span>

        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {city}
          </span>

          <span className="text-xs text-muted-foreground">
            {state}
          </span>
        </div>
      </div>
    );
  },
},
];