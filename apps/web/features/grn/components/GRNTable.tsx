"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  IconDatabaseOff,
  IconDotsVertical,
  IconEdit,
  IconBan,
  IconListDetails,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";

import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@skerp/ui/components/pagination";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";

import { formatPaise } from "@/lib/money";
import {
  GRNStatus,
  GRNStatusBadge,
  GRNVPLoadingStatusBadge,
  type GRNVPLoadingStatus,
} from "./grn-ui";

const DASH = "—";

type MoneyValue = Parameters<typeof formatPaise>[0];

export type GRNListItem = {
  id: string;
  grnNumber?: string | null;
  status?: GRNStatus | null;
  gateNo?: string | null;
  receivedQty?: number | null;
  damageQty?: number | null;
  shortageQty?: number | null;
  netAmount?: MoneyValue | null;
  netAmountPaise?: MoneyValue | null;
  createdAt?: string | Date | null;
  vpLoadingSummary?: {
    status: GRNVPLoadingStatus;
    loadedQty: number;
    remainingQty: number;
    progressPercent: number;
    activeLoadingCount: number;
  };
  lorryReceipt?: {
    lrNumber?: string | null;
  } | null;
};
type Props = {
  data: GRNListItem[];
  total: number;
  page: number;
  size: number;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  isError?: boolean;

  canUpdate?: boolean;
  canCancel?: boolean;
  onCancel?: (grn: GRNListItem) => void;
};

const formatDate = (value: unknown) => {
  if (!value) return DASH;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return DASH;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMoney = (value: MoneyValue | null | undefined) => {
  if (value == null) return DASH;
  return formatPaise(value);
};

export default function GRNTable({
  data,
  total,
  page,
  size,
  search,
  onSearchChange,
  onPageChange,
  isLoading,
  isError,
  canUpdate = true,
  canCancel = true,
  onCancel,
}: Props) {
  const columns = React.useMemo<ColumnDef<GRNListItem>[]>(
    () => [
      {
        header: "GRN No",
        cell: ({ row }) => {
          const identifier = row.original.grnNumber || row.original.id;

          return (
            <Link
              href={`/vp-management/grn/${encodeURIComponent(identifier)}`}
              className="font-medium text-primary hover:underline"
            >
              {row.original.grnNumber || DASH}
            </Link>
          );
        },
      },
      {
        header: "LR No",
        cell: ({ row }) => row.original.lorryReceipt?.lrNumber || DASH,
      },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.status ? (
            <GRNStatusBadge status={row.original.status} />
          ) : (
            DASH
          ),
      },
      {
        header: "VP Loading",
        cell: ({ row }) => {
          const summary = row.original.vpLoadingSummary;
          if (!summary) return DASH;

          return (
            <div className="space-y-1">
              <GRNVPLoadingStatusBadge status={summary.status} />
              <p className="text-xs tabular-nums text-muted-foreground">
                {summary.loadedQty} / {row.original.receivedQty ?? 0} loaded
              </p>
            </div>
          );
        },
      },

      {
        header: "Net Amount",
        cell: ({ row }) =>
          formatMoney(row.original.netAmount ?? row.original.netAmountPaise),
      },
      {
        header: "Created",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const pageCount = Math.max(1, Math.ceil(total / size));

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search GRN or LR number..."
          className="h-9 max-w-xs"
        />
      </div>

      <div className="w-full overflow-x-auto rounded-lg border bg-card">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
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

                  <TableCell className="w-16">
                    <Skeleton className="ml-auto size-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-14 text-center text-sm text-red-600"
                >
                  Failed to load GRN list.
                </TableCell>
              </TableRow>
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
                    <span className="text-sm font-medium">No GRN found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const grn = row.original;
                const identifier = row.original.grnNumber || row.original.id;
                const viewHref = `/vp-management/grn/${encodeURIComponent(identifier)}`;

                const editHref = `/vp-management/grn/${grn.id}/edit`;

                const editable =
                  grn.status === "DRAFT" || grn.status === "SUBMITTED";
                const cancellable = grn.status !== "CANCELLED";

                return (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="h-12 whitespace-nowrap text-sm"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}

                    <TableCell className="w-16 text-right">
                      <div className="flex justify-end gap-1">
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
                            <DropdownMenuItem asChild>
                              <Link href={viewHref}>
                                <IconListDetails size={16} className="mr-2" />
                                View details
                              </Link>
                            </DropdownMenuItem>

                            {canUpdate && editable ? (
                              <DropdownMenuItem asChild>
                                <Link href={editHref}>
                                  <IconEdit size={16} className="mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                            ) : null}

                            {canCancel && onCancel && cancellable ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => onCancel(grn)}
                                >
                                  <IconBan size={16} className="mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              </>
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

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} GRN{total === 1 ? "" : "s"} · page {page + 1} of {pageCount}
        </p>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page === 0}
                className={page === 0 ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 0) onPageChange(page - 1);
                }}
              />
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={page + 1 >= pageCount}
                className={
                  page + 1 >= pageCount ? "pointer-events-none opacity-50" : ""
                }
                onClick={(e) => {
                  e.preventDefault();
                  if (page + 1 < pageCount) onPageChange(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
