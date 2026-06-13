"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Route } from "@skerp/types";
import {
  IconArrowRight,
  IconMapPin,
  IconReceipt,
  IconRoute,
  IconTruck,
  IconTableOptions,
} from "@tabler/icons-react";

const CountBadge = ({
  value,
  icon,
}: {
  value: number;
  icon: React.ReactNode;
}) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
    {icon}
    {value}
  </span>
);

export const routeColumns: ColumnDef<Route>[] = [
  {
    id: "route",
    header: "Route",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconRoute size={14} />
        </span>

        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{row.original.sourceCity?.name ?? "-"}</span>
          <IconArrowRight size={14} className="text-muted-foreground" />
          <span>{row.original.destinationCity?.name ?? "-"}</span>
        </div>
      </div>
    ),
  },
  {
    id: "sourceCity",
    header: "From City",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        <IconMapPin size={12} />
        {row.original.sourceCity?.name ?? "-"}
      </span>
    ),
    enableHiding: false,
  },
  {
    id: "destinationCity",
    header: "To City",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
        <IconMapPin size={12} />
        {row.original.destinationCity?.name ?? "-"}
      </span>
    ),
    enableHiding: false,
  }
];