"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { GRN } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import {
  IconCheck,
  IconDatabaseOff,
  IconDotsVertical,
  IconEye,
  IconPackageExport,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

import {
  formatDate,
  formatDateTime,
  formatGRNMoney,
  GRN_STATUS_TABS,
  GRNStatusBadge,
} from "./grn-ui";

type Props = {
  data: GRN[];
  total: number;
  page: number;
  size: number;
  search: string;
  statusFilter: string;
  counts: Record<string, number>;
  isLoading?: boolean;
  canSubmit: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canCreateVPLoading: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onView: (grn: GRN) => void;
  onSubmit: (grn: GRN) => void;
  onCancel: (grn: GRN) => void;
  onDelete: (grn: GRN) => void;
  onCreateVPLoading: (grn: GRN) => void;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const branchLabel = (branch?: { name?: string | null; branchCode?: string | null } | null) =>
  branch?.name ?? branch?.branchCode ?? "-";

const routeLabel = (grn: GRN) => {
  const source = grn.vpSchedule?.sourceArea?.name;
  const destination = grn.vpSchedule?.destinationArea?.name;

  if (source || destination) return `${source ?? "-"} -> ${destination ?? "-"}`;

  return `${branchLabel(grn.vpSchedule?.fromBranch)} -> ${branchLabel(
    grn.vpSchedule?.toBranch,
  )}`;
};

export default function GRNTable({
  data,
  total,
  page,
  size,
  search,
  statusFilter,
  counts,
  isLoading,
  canSubmit,
  canCancel,
  canDelete,
  canCreateVPLoading,
  onPageChange,
  onSizeChange,
  onSearchChange,
  onStatusFilterChange,
  onView,
  onSubmit,
  onCancel,
  onDelete,
  onCreateVPLoading,
}: Props) {
  const columns = React.useMemo<ColumnDef<GRN>[]>(
    () => [
      {
        header: "GRN No",
        accessorKey: "grnNumber",
        cell: ({ row }) => (
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => onView(row.original)}
          >
            {row.original.grnNumber}
          </button>
        ),
      },
      {
        header: "LR",
        cell: ({ row }) => row.original.lorryReceipt?.lrNumber ?? "-",
      },
      {
        header: "VP Schedule",
        cell: ({ row }) =>
          row.original.vpSchedule?.scheduleName ??
          row.original.vpSchedule?.scheduleNumber ??
          "-",
      },
      {
        header: "Schedule Date",
        cell: ({ row }) => formatDate(row.original.vpSchedule?.scheduleDate),
      },
      {
        header: "Route",
        cell: ({ row }) => routeLabel(row.original),
      },
      {
        header: "Gate",
        cell: ({ row }) => row.original.gateNo ?? "-",
      },
      {
        header: "Qty",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-sm">
            <span className="font-medium">{row.original.receivedQty}</span>
            <span className="text-muted-foreground"> / {row.original.totalQty}</span>
          </div>
        ),
      },
      {
        header: "Damage",
        cell: ({ row }) => row.original.damageQty,
      },
      {
        header: "Net",
        cell: ({ row }) => formatGRNMoney(row.original.netAmount),
      },
      {
        header: "Created",
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        header: "Status",
        cell: ({ row }) => <GRNStatusBadge status={row.original.status} />,
      },
    ],
    [onView],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const pageCount = Math.max(1, Math.ceil(total / size));

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        {GRN_STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          const count = counts[tab.key];

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatusFilterChange(tab.key)}
              className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
              {typeof count === "number" ? (
                <span
                  className={`ml-1.5 rounded-sm px-1 text-xs ${
                    active ? "bg-primary-foreground/20" : "bg-muted-foreground/10"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search GRN, LR, gate, VP schedule..."
        className="h-9 max-w-md"
      />

      <div className="w-full overflow-x-auto rounded-lg bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
                <TableHead className="h-10 w-16 text-right text-xs font-semibold uppercase text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((_, columnIndex) => (
                    <TableCell key={columnIndex} className="h-12">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Skeleton className="ml-auto size-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-14 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <IconDatabaseOff size={18} />
                    </div>
                    <span className="text-sm font-medium">No GRNs found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const grn = row.original;
                const isDraft = grn.status === "DRAFT";
                const canLoad = grn.status === "SUBMITTED" && canCreateVPLoading;

                return (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="h-12 whitespace-nowrap text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                    <TableCell className="w-16 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="View GRN"
                          onClick={() => onView(grn)}
                        >
                          <IconEye size={16} />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="GRN actions"
                            >
                              <IconDotsVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(grn)}>
                              <IconEye size={16} className="mr-2" />
                              View details
                            </DropdownMenuItem>

                            {canLoad ? (
                              <DropdownMenuItem onClick={() => onCreateVPLoading(grn)}>
                                <IconPackageExport size={16} className="mr-2" />
                                Create VP Loading
                              </DropdownMenuItem>
                            ) : null}

                            {canSubmit && isDraft ? (
                              <DropdownMenuItem onClick={() => onSubmit(grn)}>
                                <IconCheck size={16} className="mr-2" />
                                Submit GRN
                              </DropdownMenuItem>
                            ) : null}

                            {(canCancel && grn.status !== "CANCELLED") ||
                            (canDelete && (isDraft || grn.status === "CANCELLED")) ? (
                              <DropdownMenuSeparator />
                            ) : null}

                            {canCancel && grn.status !== "CANCELLED" ? (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => onCancel(grn)}
                              >
                                <IconX size={16} className="mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            ) : null}

                            {canDelete && (isDraft || grn.status === "CANCELLED") ? (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => onDelete(grn)}
                              >
                                <IconTrash size={16} className="mr-2" />
                                Delete
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            {total === 0
              ? "Showing 0"
              : `Showing ${page * size + 1}-${Math.min((page + 1) * size, total)}`}{" "}
            of {total}
          </span>

          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={size}
              onChange={(event) => onSizeChange(Number(event.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <span>
            Page {page + 1} of {pageCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
