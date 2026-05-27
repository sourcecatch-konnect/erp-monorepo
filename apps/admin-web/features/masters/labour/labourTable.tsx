"use client";

import { ColumnDef } from "@tanstack/react-table";

import type { Labour, LabourWithRelations } from "@skerp/types";

import {
  IconBuilding,
  IconCalendar,
  IconCash,
  IconFileCertificate,
  IconMapPin,
  IconPhone,
  IconTool,
  IconUser,
} from "@tabler/icons-react";
import { formatCurrency } from "../_shared/dialog-parts";


const formatPercent = (
  value?: number | null
) => {
  if (value == null) return "-";

  return `${value}%`;
};
const formatDate = (
  value?: Date | string | null
) => {
  if (!value) return "-";

  return new Date(value)
    .toLocaleDateString();
};
const getWorkerBadge = (
  type: string
) => {
  switch (type) {
    case "Supervisor":
      return "bg-blue-100 text-blue-700";

    case "Mechanic":
      return "bg-orange-100 text-orange-700";

    default:
      return "bg-emerald-100 text-emerald-700";
  }
};
export const labourColumns: ColumnDef<LabourWithRelations>[] = [
  {
    accessorKey: "name",
    header: "Labour",
    enableHiding: false,

    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconUser size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.name}
          </span>

          <span className="text-xs text-muted-foreground">
            Labour Worker
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "type",
    header: "Worker Type",

    cell: ({ row }) => (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${getWorkerBadge(
          row.original.type
        )}`}
      >
        <IconTool size={12} />

        {row.original.type}
      </span>
    ),
  },

  {
    id: "location",
    header: "Location",

    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
          <IconMapPin size={12} />

          {row.original.city?.name ??
            "-"}
        </span>

        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
          <IconBuilding
            size={12}
          />

          {row.original.branch
            ?.name ?? "-"}
        </span>
      </div>
    ),
  },

  {
    accessorKey:
      "contactName",

    header: "Contact",

    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconUser size={13} />

        {row.original
          .contactName ??
          "-"}
      </span>
    ),
  },

  {
    accessorKey:
      "mobileNo",

    header: "Mobile",

    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-sm">
        <IconPhone size={13} />

        {row.original
          .mobileNo ??
          "-"}
      </span>
    ),
  },

  {
    accessorKey: "pan",
    header: "PAN",

    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        <IconFileCertificate
          size={12}
        />

        {row.original.pan ??
          "-"}
      </span>
    ),
  },

  {
    accessorKey:
      "tdsAmount",

    header:
      "TDS Amount",

    cell: ({ row }) =>
      formatCurrency(
        row.original
          .tdsAmount
      ),
  },

  {
    accessorKey:
      "tdsRate",

    header:
      "TDS Rate",

    cell: ({ row }) =>
      formatPercent(
        row.original
          .tdsRate
      ),
  },

  {
    accessorKey:
      "referredBy",

    header:
      "Referred By",

    cell: ({ row }) =>
      row.original
        .referredBy ??
      "-",
  },

  {
    accessorKey:
      "startDate",

    header:
      "Start Date",

    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1">
        <IconCalendar
          size={13}
        />

        {formatDate(
          row.original
            .startDate
        )}
      </span>
    ),
  },

  {
    accessorKey:
      "createdAt",

    header:
      "Created At",

    cell: ({ row }) =>
      formatDate(
        row.original
          .createdAt
      ),
  },

  {
    accessorKey:
      "updatedAt",

    header:
      "Updated At",

    cell: ({ row }) =>
      formatDate(
        row.original
          .updatedAt
      ),
  },
];