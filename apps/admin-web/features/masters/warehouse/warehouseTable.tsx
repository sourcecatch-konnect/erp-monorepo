"use client";

import { ColumnDef } from "@tanstack/react-table";
import type {  WarehouseWithRelations } from "@skerp/types";

export const warehouseColumns: ColumnDef<WarehouseWithRelations>[] = [
  {
    accessorKey: "name",
    header: "Warehouse Name",
    enableHiding: false,
  },

  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => row.original.type ?? "-",
  },

  {
    id: "branch",
    header: "Branch",
    cell: ({ row }) => row.original.branch?.name ?? "-",
    enableHiding: false,
  },

  {
    id: "city",
    header: "City",
    cell: ({ row }) => row.original.city?.name ?? "-",
  },

  {
    id: "state",
    header: "State",
    cell: ({ row }) => row.original.state?.name ?? "-",
  },

  {
    accessorKey: "country",
    header: "Country",
    cell: ({ row }) => row.original.country ?? "-",
  },

  {
    accessorKey: "contactName",
    header: "Contact Person",
    cell: ({ row }) => row.original.contactName ?? "-",
  },

  {
    accessorKey: "contactPhone",
    header: "Phone",
    cell: ({ row }) => row.original.contactPhone ?? "-",
  },

  {
    accessorKey: "monthlyRent",
    header: "Monthly Rent",
    cell: ({ row }) =>
      row.original.monthlyRent != null
        ? `₹ ${row.original.monthlyRent}`
        : "-",
  },

  {
    accessorKey: "securityDeposit",
    header: "Security Deposit",
    cell: ({ row }) =>
      row.original.securityDeposit != null
        ? `₹ ${row.original.securityDeposit}`
        : "-",
  },

  {
    accessorKey: "storageCapacity",
    header: "Capacity",
    cell: ({ row }) =>
      row.original.storageCapacity != null
        ? `${row.original.storageCapacity}`
        : "-",
  },

{
  id: "dimensions",
  header: "Dimensions",
  cell: ({ row }) => {
    const { length, width, breadth } = row.original;

    return (
      <div className="flex gap-1 text-xs">
        <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
          L {length ?? "-"}
        </span>
        <span className="px-2 py-1 rounded-full bg-green-50 text-green-700">
          W {width ?? "-"}
        </span>
        <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700">
          B {breadth ?? "-"}
        </span>
      </div>
    );
  },
},

  {
    accessorKey: "gateNo",
    header: "Gate No",
    cell: ({ row }) => row.original.gateNo ?? "-",
  },
];