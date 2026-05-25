"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Company } from "@skerp/types";

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  return new Date(value).toLocaleDateString();
};

export const companyColumns: ColumnDef<Company>[] = [
  {
    accessorKey: "name",
    header: "Company Name",
    enableHiding: false,
  },
  {
    accessorKey: "country",
    header: "Country",
  },
  {
    id: "state",
    header: "State",
    cell: ({ row }) => row.original.state?.name ?? "-",
  },
  {
    id: "city",
    header: "City",
    cell: ({ row }) => row.original.city?.name ?? "-",
  },
  {
    accessorKey: "contactPhone",
    header: "Contact Phone",
    cell: ({ row }) => row.original.contactPhone ?? "-",
  },
  {
    accessorKey: "establishmentYear",
    header: "Establishment Date",
    cell: ({ row }) => formatDate(row.original.establishmentYear),
  },
  {
    accessorKey: "companyPAN",
    header: "PAN",
    cell: ({ row }) => row.original.companyPAN ?? "-",
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