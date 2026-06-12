"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Driver } from "@skerp/types";
import {
  IconBan,
  IconBeach,
  IconCircleCheck,
  IconSteeringWheel,
} from "@tabler/icons-react";

const formatLabel = (value?: string | null) => {
  if (!value) return "-";

  return value.replaceAll("_", " ");
};

export const driverColumns: ColumnDef<Driver>[] = [
  {
    accessorKey: "name",
    header: "Driver",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconSteeringWheel size={14} />
        </span>
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.type}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "mobile",
    header: "Mobile",
  },
  {
    accessorKey: "licenseNo",
    header: "License No.",
  },
  {
    accessorKey: "licenseExpiryDate",
    header: "License Expiry",
    cell: ({ row }) => {
      const value = row.original.licenseExpiryDate;
      if (!value) return "-";
      const date = new Date(value);
      const now = new Date();
      const isExpired = date < now;
      const isSoon =
        date.getTime() - now.getTime() < 1000 * 60 * 60 * 24 * 30 &&
        date >= now;

      return (
        <span
          className={
            isExpired
              ? "rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
              : isSoon
                ? "rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                : "text-sm"
          }
        >
          {date.toLocaleDateString()}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const { status, onLeave, blackListed } = row.original;

      if (blackListed) {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <IconBan size={12} /> Blacklisted
          </span>
        );
      }

      if (onLeave) {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <IconBeach size={12} /> On Leave
          </span>
        );
      }

      return (
        <span
          className={
            status === "AVAILABLE"
              ? "inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
              : "inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
          }
        >
          <IconCircleCheck size={12} /> {formatLabel(status)}
        </span>
      );
    },
  },
];
