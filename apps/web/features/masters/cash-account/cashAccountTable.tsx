"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { CashAccount } from "@skerp/types";
import { IconBuildingBank, IconCash } from "@tabler/icons-react";

export const cashAccountColumns: ColumnDef<CashAccount>[] = [
  {
    accessorKey: "name",
    header: "Account",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          {row.original.type === "BANK" ? (
            <IconBuildingBank size={14} />
          ) : (
            <IconCash size={14} />
          )}
        </span>
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
        {row.original.type === "BANK" ? "Bank" : "Cash in hand"}
      </span>
    ),
  },
  {
    accessorKey: "bankName",
    header: "Bank",
    cell: ({ row }) => row.original.bankName || "-",
  },
  {
    accessorKey: "accountLast4",
    header: "A/C (last 4)",
    cell: ({ row }) =>
      row.original.accountLast4 ? `••••${row.original.accountLast4}` : "-",
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) =>
      row.original.isActive ? (
        <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Active
        </span>
      ) : (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Inactive
        </span>
      ),
  },
];
