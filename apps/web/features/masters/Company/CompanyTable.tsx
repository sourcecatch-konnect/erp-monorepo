"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Company } from "@skerp/types";
import {
  IconBuilding,
  IconCalendar,
  IconFileCertificate,
  IconMapPin,
  IconPhone,
} from "@tabler/icons-react";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

export const companyColumns: ColumnDef<Company>[] = [
  {
    accessorKey: "name",
    header: "Company",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBuilding size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.country ?? "-"}
          </span>
        </div>
      </div>
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
  {
    accessorKey: "contactPhone",
    header: "Contact",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconPhone size={13} />
        {row.original.contactPhone ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "establishmentYear",
    header: "Established",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconCalendar size={13} />
        {formatDate(row.original.establishmentYear)}
      </span>
    ),
  },
  {
    accessorKey: "companyPAN",
    header: "PAN",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        <IconFileCertificate size={12} />
        {row.original.companyPAN ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "companyTAN",
    header: "TAN",
    cell: ({ row }) => row.original.companyTAN ?? "-",
  },
  {
    accessorKey: "mainLogoPath",
    header: "Logo",
    cell: ({ row }) => row.original.mainLogoPath ?? "-",
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => row.original.address ?? "-",
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    accessorKey: "updatedAt",
    header: "Updated At",
    cell: ({ row }) => formatDate(row.original.updatedAt),
  },
];