"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Vehicle } from "@skerp/types";

import {
  IconTruck,
  IconGauge,
  IconCalendar,
  IconEngine,
  IconShieldCheck,
} from "@tabler/icons-react";

const formatLabel = (value?: string | null) => {
  if (!value) return "-";

  return value.replaceAll("_", " ");
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  return new Date(value).toLocaleDateString();
};

export const vehicleColumns: ColumnDef<Vehicle>[] = [
  {
    accessorKey: "vehicleNumber",
    header: "Vehicle",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <IconTruck size={15} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">
            {row.original.vehicleNumber}
          </span>

          <span className="text-xs text-muted-foreground">
            {(row.original as { vehicleTypeRef?: { name?: string } })
              .vehicleTypeRef?.name ?? "-"}
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "ownershipType",
    header: "Ownership",
    cell: ({ row }) => (
      <span className="inline-flex rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
        {formatLabel(row.original.ownershipType)}
      </span>
    ),
  },

  {
    accessorKey: "capacityMT",
    header: "Capacity",
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.capacityMT ?? "-"} MT
      </span>
    ),
  },

  {
    accessorKey: "currentKM",
    header: "Current KM",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1">
        <IconGauge size={13} />
        {row.original.currentKM ?? "-"}
      </span>
    ),
  },

  {
    id: "vehicleDetails",
    header: "Vehicle Details",
    cell: ({ row }) => (
      <div className="flex flex-col text-sm">
        <span>
          Wheels: {row.original.wheels ?? "-"}
        </span>

        <span>
          Body: {row.original.bodyType ?? "-"}
        </span>

        <span>
          Length: {row.original.lengthFeet ?? "-"} ft
        </span>
      </div>
    ),
  },

  {
    id: "engine",
    header: "Engine Details",
    cell: ({ row }) => (
      <div className="flex items-start gap-2">
        <IconEngine size={15} className="mt-1" />

        <div className="flex flex-col text-xs">
          <span>
            Chasis: {row.original.chasisNumber ?? "-"}
          </span>

          <span>
            Engine: {row.original.engineNumber ?? "-"}
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "purchaseDate",
    header: "Purchase Date",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1">
        <IconCalendar size={13} />
        {formatDate(row.original.purchaseDate)}
      </span>
    ),
  },

  {
    id: "insurance",
    header: "Insurance",
    cell: ({ row }) => (
      <div className="flex items-start gap-2">
        <IconShieldCheck size={14} className="mt-1" />

        <div className="flex flex-col text-xs">
          <span>
            {row.original.insuranceCompany ?? "-"}
          </span>

          <span>
            Due: {formatDate(row.original.insuranceDueDate)}
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span
        className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
          row.original.status === "AVAILABLE"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-orange-50 text-orange-700"
        }`}
      >
        {formatLabel(row.original.status)}
      </span>
    ),
    enableHiding: false,
  },
];