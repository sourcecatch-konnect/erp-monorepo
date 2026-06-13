"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { LRListItem } from "@skerp/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@skerp/ui/components/pagination";
import {
  IconEye,
  IconDotsVertical,
  IconBan,
  IconDatabaseOff,
} from "@tabler/icons-react";

import { LRStatusBadge, SOURCE_LABELS, LR_STATUS_ORDER } from "../lorry-receipt-ui";

type Props = {
  data: LRListItem[];
  total: number;
  page: number;
  size: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  counts: Record<string, number>;
  isLoading?: boolean;
  canCancel: boolean;
  onCancel: (lr: LRListItem) => void;
};

export default function LRTable(props: Props) {
  const {
    data, total, page, size, onPageChange,
    search, onSearchChange,
    statusFilter, onStatusFilterChange,
    counts, isLoading,
    canCancel, onCancel,
  } = props;

  const columns = React.useMemo<ColumnDef<LRListItem>[]>(
    () => [
      {
        header: "LR Number",
        cell: ({ row }) => (
          <Link href={`/lorry-receipts/${row.original.id}`} className="block">
            <span className="font-medium text-primary hover:underline">
              {row.original.lrNumber}
            </span>
          </Link>
        ),
      },
      {
        header: "Consignor",
        cell: ({ row }) => row.original.consignor?.name ?? "—",
      },
      {
        header: "Consignee",
        cell: ({ row }) => row.original.consignee?.name ?? "—",
      },
      {
        header: "Origin",
        cell: ({ row }) => row.original.originBranch?.name ?? "—",
      },
      {
        header: "Destination",
        cell: ({ row }) => row.original.destinationBranch?.name ?? "—",
      },
      {
        header: "Vehicle",
        cell: ({ row }) => {
          const lr = row.original;
          if (lr.isMarketVehicle) return lr.marketVehicleNumber ?? "—";
          return lr.primaryTrip?.vehicle?.vehicleNumber ?? "—";
        },
      },
      {
        header: "Source",
        cell: ({ row }) => SOURCE_LABELS[row.original.source],
      },
      {
        header: "Status",
        cell: ({ row }) => <LRStatusBadge status={row.original.status} />,
      },
    ],
    []
  );

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const pageCount = Math.max(1, Math.ceil(total / size));

  return (
    <div className="w-full space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-1">
        {LR_STATUS_ORDER.map((tab) => {
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

      <div className="flex items-center justify-between gap-2">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search LR number…"
          className="h-9 max-w-xs"
        />
      </div>

      <div className="w-full overflow-x-auto rounded-lg bg-card">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/40">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    className="h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
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
              Array.from({ length: 8 }).map((_, r) => (
                <TableRow key={r}>
                  {columns.map((_, c) => (
                    <TableCell key={c} className="h-12">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                  <TableCell className="w-16">
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
                    <span className="text-sm font-medium">No lorry receipts found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const lr = row.original;
                const cancellable = lr.status === "DRAFT";
                return (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="h-12 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                    <TableCell className="w-16 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label="View LR" asChild>
                          <Link href={`/lorry-receipts/${lr.id}`}>
                            <IconEye size={16} />
                          </Link>
                        </Button>
                        {canCancel && cancellable ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon-sm" variant="ghost" aria-label="Row actions">
                                <IconDotsVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => onCancel(lr)}
                              >
                                <IconBan size={16} className="mr-2" /> Cancel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} LR{total === 1 ? "" : "s"} · page {page + 1} of {pageCount}
        </p>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page === 0}
                className={page === 0 ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => { e.preventDefault(); if (page > 0) onPageChange(page - 1); }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={page + 1 >= pageCount}
                className={page + 1 >= pageCount ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => { e.preventDefault(); if (page + 1 < pageCount) onPageChange(page + 1); }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
