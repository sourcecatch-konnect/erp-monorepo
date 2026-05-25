"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Branch } from "@skerp/types";

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  return new Date(value).toLocaleDateString();
};

export const branchColumns: ColumnDef<Branch>[] = [
  {
    accessorKey: "branchCode",
    header: "Branch Code",
    enableHiding: false,
  },
  {
    accessorKey: "shortCode",
    header: "Short Code",
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Branch Name",
    enableHiding: false,
  },
  {
    id: "company",
    header: "Company",
    cell: ({ row }) => row.original.company?.name ?? "-",
  },
  {
    id: "city",
    header: "City",
    cell: ({ row }) => row.original.city?.name ?? "-",
  },
  {
    accessorKey: "contactName",
    header: "Contact Name",
    cell: ({ row }) => row.original.contactName ?? "-",
  },
  {
    accessorKey: "contactPhone",
    header: "Contact Phone",
    cell: ({ row }) => row.original.contactPhone ?? "-",
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email ?? "-",
  },
  {
    accessorKey: "weeklyOffDay",
    header: "Weekly Off",
    cell: ({ row }) => row.original.weeklyOffDay ?? "-",
  },
  {
    accessorKey: "gstNo",
    header: "GST No",
    cell: ({ row }) => row.original.gstNo ?? "-",
  },
  {
    accessorKey: "workingHours",
    header: "Working Hours",
    cell: ({ row }) => row.original.workingHours ?? "-",
  },
  {
    accessorKey: "allowLR",
    header: "Allow LR",
    cell: ({ row }) =>
      row.original.allowLR ? "Yes" : "No",
  },
  {
    accessorKey: "isRailHead",
    header: "Rail Head",
    cell: ({ row }) =>
      row.original.isRailHead ? "Yes" : "No",
  },
  {
    accessorKey: "allowReceipt",
    header: "Allow Receipt",
    cell: ({ row }) =>
      row.original.allowReceipt ? "Yes" : "No",
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => row.original.address ?? "-",
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) =>
      formatDate(row.original.createdAt),
  },
  {
    accessorKey: "updatedAt",
    header: "Updated At",
    cell: ({ row }) =>
      formatDate(row.original.updatedAt),
  },
];