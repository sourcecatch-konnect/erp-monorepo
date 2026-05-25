"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { SparePartSupplier } from "@skerp/types";

export const sparePartSupplierColumns: ColumnDef<SparePartSupplier>[] = [
  {
    accessorKey: "name",
    header: "Supplier Name",
    enableHiding: false,
  },
  {
    accessorKey: "type",
    header: "Type",
    enableHiding: false,
  },
  {
    accessorKey: "shopName",
    header: "Shop Name",
    cell: ({ row }) => row.original.shopName ?? "-",
  },
  {
    id: "city",
    header: "City",
    cell: ({ row }) => row.original.city?.name ?? "-",
    enableHiding: false,
  },
  {
    accessorKey: "contactPerson",
    header: "Contact Person",
    cell: ({ row }) => row.original.contactPerson ?? "-",
  },
  {
    accessorKey: "contactPhone",
    header: "Contact Phone",
    cell: ({ row }) => row.original.contactPhone ?? "-",
  },
  {
    accessorKey: "mobileNo",
    header: "Mobile No",
    cell: ({ row }) => row.original.mobileNo ?? "-",
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email ?? "-",
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => row.original.address ?? "-",
  },
  {
    accessorKey: "panNo",
    header: "PAN No",
    cell: ({ row }) => row.original.panNo ?? "-",
  },
  {
    accessorKey: "gstin",
    header: "GSTIN",
    cell: ({ row }) => row.original.gstin ?? "-",
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) =>
      row.original.createdAt
        ? new Date(row.original.createdAt).toLocaleDateString()
        : "-",
  },
  {
    accessorKey: "updatedAt",
    header: "Updated At",
    cell: ({ row }) =>
      row.original.updatedAt
        ? new Date(row.original.updatedAt).toLocaleDateString()
        : "-",
  },
];