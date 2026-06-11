"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { Branch } from "@skerp/types";
import {
  IconBuilding,
  IconBuildingCommunity,
  IconCircleCheck,
  IconCircleX,
  IconMapPin,
} from "@tabler/icons-react";

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
};

const BooleanBadge = ({ value }: { value?: boolean | null }) => {
  return value ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <IconCircleCheck size={12} /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <IconCircleX size={12} /> No
    </span>
  );
};

export const branchColumns: ColumnDef<Branch>[] = [
  {
    accessorKey: "name",
    header: "Branch",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconBuilding size={14} />
        </span>

        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.branchCode ?? "-"} · {row.original.shortCode ?? "-"}
          </span>
        </div>
      </div>
    ),
  },
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
    id: "company",
    header: "Company",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
        <IconBuildingCommunity size={12} />
        {row.original.company?.name ?? "-"}
      </span>
    ),
  },
  {
    id: "city",
    header: "City",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
        <IconMapPin size={12} />
        {row.original.city?.name ?? "-"}
      </span>
    ),
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
    cell: ({ row }) => <BooleanBadge value={row.original.allowLR} />,
  },
  {
    accessorKey: "isRailHead",
    header: "Rail Head",
    cell: ({ row }) => <BooleanBadge value={row.original.isRailHead} />,
  },
  {
    accessorKey: "allowReceipt",
    header: "Allow Receipt",
    cell: ({ row }) => <BooleanBadge value={row.original.allowReceipt} />,
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