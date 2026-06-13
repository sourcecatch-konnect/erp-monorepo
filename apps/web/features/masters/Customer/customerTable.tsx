"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Customer } from "@skerp/types";
import {
  IconBuildingStore,
  IconCash,
  IconCircleCheck,
  IconCircleX,
  IconFileCertificate,
  IconMail,
  IconMapPin,
  IconPhone,
  IconUser,
} from "@tabler/icons-react";
import { formatCurrencyFromPaise } from "../_shared/dialog-parts";



const formatPercent = (value?: number | null) => {
  if (value == null) return "-";
  return `${value}%`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

export const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: "name",
    header: "Customer",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBuildingStore size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.shortName ?? "Customer"}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "customerPAN",
    header: "PAN",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        <IconFileCertificate size={12} />
        {row.original.customerPAN ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "gstNo",
    header: "GST No",
    cell: ({ row }) => row.original.gstNo ?? "-",
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
      </div>
    ),
  },
  {
    accessorKey: "creditLimit",
    header: "Credit Limit",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm font-medium">
        <IconCash size={13} />
        {formatCurrencyFromPaise(row.original.creditLimit)}
      </span>
    ),
  },
  {
    accessorKey: "interestRateLatePayment",
    header: "Late Interest",
    cell: ({ row }) => formatPercent(row.original.interestRateLatePayment),
  },
  {
    accessorKey: "tdsDeductionRate",
    header: "TDS",
    cell: ({ row }) => formatPercent(row.original.tdsDeductionRate),
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
    accessorKey: "mobileNo",
    header: "Mobile",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconPhone size={13} />
        {row.original.mobileNo ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "primaryEmail",
    header: "Email",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconMail size={13} />
        {row.original.primaryEmail ?? "-"}
      </span>
    ),
  },
  {
    accessorKey: "disallowNewLRBooking",
    header: "LR Booking",
    cell: ({ row }) =>
      row.original.disallowNewLRBooking ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <IconCircleX size={12} />
          Blocked
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <IconCircleCheck size={12} />
          Allowed
        </span>
      ),
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
