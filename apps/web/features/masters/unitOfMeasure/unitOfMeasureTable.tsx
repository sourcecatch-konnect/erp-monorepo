"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { UnitOfMeasure } from "@skerp/types";
import { IconRulerMeasure } from "@tabler/icons-react";

const categoryLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");


export const unitOfMeasureColumns: ColumnDef<UnitOfMeasure>[] = [
  {
    accessorKey: "name",
    header: "Unit",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconRulerMeasure size={15} />
        </span>
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.code}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => categoryLabel(row.original.category),
  },
  {
    accessorKey: "isActive",
    header: "Active",
    cell: ({ row }) =>
      row.original.isActive ? (
        <span className="rounded-sm bg-green-100 px-2 py-0.5 text-xs text-green-700">
          Active
        </span>
      ) : (
        <span className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Inactive
        </span>
      ),
  },
];
