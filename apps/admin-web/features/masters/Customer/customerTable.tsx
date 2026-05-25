"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Customer } from "@skerp/types";

const formatCurrency = (value?: number | null) => {
  if (value == null) return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value?: number | null) => {
  if (value == null) return "-";

  return `${value}%`;
};

export const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: "name",
    header: "Customer Name",
    enableHiding: false,
  },
  {
    accessorKey: "shortName",
    header: "Short Name",
    cell: ({ row }) => row.original.shortName ?? "-",
  },
  {
    accessorKey: "customerPAN",
    header: "PAN",
    cell: ({ row }) => row.original.customerPAN ?? "-",
  },
  {
    accessorKey: "gstNo",
    header: "GST No",
    cell: ({ row }) => row.original.gstNo ?? "-",
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
    accessorKey: "creditLimit",
    header: "Credit Limit",
    cell: ({ row }) => formatCurrency(row.original.creditLimit),
  },
  {
    accessorKey: "interestRateLatePayment",
    header: "Late Interest",
    cell: ({ row }) => formatPercent(row.original.interestRateLatePayment),
  },
  {
    accessorKey: "tdsDeductionRate",
    header: "TDS Rate",
    cell: ({ row }) => formatPercent(row.original.tdsDeductionRate),
  },
  {
    accessorKey: "contactPerson",
    header: "Contact Person",
    cell: ({ row }) => row.original.contactPerson ?? "-",
  },
  {
    accessorKey: "mobileNo",
    header: "Mobile No",
    cell: ({ row }) => row.original.mobileNo ?? "-",
  },
  {
    accessorKey: "primaryEmail",
    header: "Email",
    cell: ({ row }) => row.original.primaryEmail ?? "-",
  },
  {
    accessorKey: "disallowNewLRBooking",
    header: "LR Blocked",
    cell: ({ row }) =>
      row.original.disallowNewLRBooking ? "Yes" : "No",
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