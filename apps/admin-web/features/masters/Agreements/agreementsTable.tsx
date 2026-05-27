"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { AgreementWithRelations } from "@skerp/types";

import {
  IconBuilding,
  IconUser,
  IconMapPin,
  IconCalendar,
  IconCash,
} from "@tabler/icons-react";

const formatDate = (value?: string | Date | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

const formatNumber = (value?: number | null) => {
  if (value == null) return "-";
  return value.toLocaleString("en-IN");
};

export const agreementColumns: ColumnDef<AgreementWithRelations>[] = [
  {
    accessorKey: "company",
    header: "Company",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBuilding size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.company?.name ?? "-"}
          </span>
          <span className="text-xs text-muted-foreground">
            Company
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "client",
    header: "Client",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
          <IconUser size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.client?.name ?? "-"}
          </span>
          <span className="text-xs text-muted-foreground">
            Customer
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "city",
    header: "City",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
        <IconMapPin size={12} />
        {row.original.city?.name ?? "-"}
      </span>
    ),
  },

  {
    accessorKey: "agreementDate",
    header: "Agreement Date",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
        <IconCalendar size={12} />
        {formatDate(row.original.agreementDate)}
      </span>
    ),
  },

  {
    accessorKey: "expiryDate",
    header: "Expiry Date",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
        <IconCalendar size={12} />
        {formatDate(row.original.expiryDate)}
      </span>
    ),
  },

  {
    accessorKey: "carryingCapacity",
    header: "Capacity",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
        <IconCash size={12} />
        {formatNumber(row.original.carryingCapacity)}
      </span>
    ),
  },
];