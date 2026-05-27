"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { SparePartSupplier } from "@skerp/types";
import {
  IconBuildingStore,
  IconFileCertificate,
  IconMail,
  IconMapPin,
  IconPhone,
  IconUser,
} from "@tabler/icons-react";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

export const sparePartSupplierColumns: ColumnDef<SparePartSupplier>[] = [
  {
    accessorKey: "name",
    header: "Supplier",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBuildingStore size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.shopName ?? row.original.type ?? "-"}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    enableHiding: false,
    cell: ({ row }) => (
      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        {row.original.type ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "shopName",
    header: "Shop Name",
    cell: ({ row }) => row.original.shopName ?? "-",
  },
  {
    id: "city",
    header: "City",
    enableHiding: false,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        <IconMapPin size={12} />
        {row.original.city?.name ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "contactPerson",
    header: "Contact Person",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconUser size={13} />
        {row.original.contactPerson ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "contactPhone",
    header: "Contact Phone",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconPhone size={13} />
        {row.original.contactPhone ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "mobileNo",
    header: "Mobile No",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconPhone size={13} />
        {row.original.mobileNo ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconMail size={13} />
        {row.original.email ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => row.original.address ?? "-",
  },
  {
    accessorKey: "panNo",
    header: "PAN",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        <IconFileCertificate size={12} />
        {row.original.panNo ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "gstin",
    header: "GSTIN",
    cell: ({ row }) => row.original.gstin ?? "-",
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