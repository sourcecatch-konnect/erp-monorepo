"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { WarehouseWithRelations } from "@skerp/types";

import {
  IconBuildingWarehouse,
  IconMapPin,
  IconPhone,
  IconUser,
  IconCurrencyRupee,
  IconRulerMeasure,
} from "@tabler/icons-react";

const formatCurrency = (value?: number | null) => {
  if (value == null) return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
};

export const warehouseColumns: ColumnDef<WarehouseWithRelations>[] = [
  {
    accessorKey: "name",
    header: "Warehouse",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <IconBuildingWarehouse size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.name}
          </span>

          <span className="text-xs text-muted-foreground">
            {row.original.type ?? "Warehouse"}
          </span>
        </div>
      </div>
    ),
  },

  {
    id: "branch",
    header: "Branch",
    cell: ({ row }) => (
      <span className="inline-flex rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
        {row.original.branch?.name ?? "-"}
      </span>
    ),
    enableHiding: false,
  },

  {
    id: "location",
    header: "Location",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
          <IconMapPin size={12} />
          {row.original.state?.name ?? "-"}
        </span>

        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
          {row.original.city?.name ?? "-"}
        </span>

        <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {row.original.country ?? "-"}
        </span>
      </div>
    ),
  },

  {
    id: "contact",
    header: "Contact",
    cell: ({ row }) => (
      <div className="flex flex-col text-sm">
        <span className="inline-flex items-center gap-1">
          <IconUser size={13} />
          {row.original.contactName ?? "-"}
        </span>

        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <IconPhone size={13} />
          {row.original.contactPhone ?? "-"}
        </span>
      </div>
    ),
  },

  {
    id: "financial",
    header: "Financial",
    cell: ({ row }) => (
      <div className="flex flex-col text-xs">
        <span className="inline-flex items-center gap-1">
          <IconCurrencyRupee size={12} />
          Rent: {formatCurrency(row.original.monthlyRent)}
        </span>

        <span>
          Deposit:{" "}
          {formatCurrency(
            row.original.securityDeposit
          )}
        </span>
      </div>
    ),
  },

  {
    accessorKey: "storageCapacity",
    header: "Capacity",
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.storageCapacity ?? "-"}
      </span>
    ),
  },

  {
    id: "dimensions",
    header: "Dimensions",
    cell: ({ row }) => {
      const { length, width, breadth } =
        row.original;

      return (
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
            L {length ?? "-"}
          </span>

          <span className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
            W {width ?? "-"}
          </span>

          <span className="rounded-full bg-purple-50 px-2 py-1 text-xs text-purple-700">
            B {breadth ?? "-"}
          </span>
        </div>
      );
    },
  },

  {
    accessorKey: "gateNo",
    header: "Gate",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1">
        <IconRulerMeasure size={13} />
        {row.original.gateNo ?? "-"}
      </span>
    ),
  },
];