"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { RateMatrixWithRelations } from "@skerp/types";

import {
  IconRoute,
  IconClock,
  IconFileInvoice,
} from "@tabler/icons-react";
import { formatCurrencyFromPaise } from "../_shared/dialog-parts";

const formatNumber = (value?: number | null, suffix = "") => {
  if (value == null) return "-";
  return `${value}${suffix}`;
};

export const rateMatrixColumns: ColumnDef<RateMatrixWithRelations>[] = [
  {
    accessorKey: "agreementId",
    header: "Agreement",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconFileInvoice size={15} />
        </span>

        <div className="flex flex-col">
         <span className="font-medium">
  {row.original.agreement?.company?.name ?? "-"} -{" "}
  {row.original.agreement?.client?.name ?? "-"}
</span>
          <span className="text-xs text-muted-foreground">
            Agreement Link
          </span>
        </div>
      </div>
    ),
  },

  {
    accessorKey: "routeId",
    header: "Route",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <IconRoute size={14} />
        </span>
<span className="text-sm font-medium">
  {row.original.route?.sourceCity?.name ?? "-"} to{" "}
  {row.original.route?.destinationCity?.name ?? "-"}
</span>
      </div>
    ),
  },

{
  accessorKey: "rate",
  header: "Rate",
  cell: ({ row }) => (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      {formatCurrencyFromPaise(row.original.rate)}
    </span>
  ),
},

  {
    accessorKey: "transitDays",
    header: "Transit Days",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        <IconClock size={12} />
        {formatNumber(row.original.transitDays, " days")}
      </span>
    ),
  },

  {
    accessorKey: "remarks",
    header: "Remarks",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.remarks ?? "-"}
      </span>
    ),
  },
];
