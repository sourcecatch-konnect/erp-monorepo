"use client";

import * as React from "react";
import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { PERMS } from "@skerp/types";
import {
  IconArrowRight,
  IconDatabaseOff,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconRefresh,
  IconRoute,
  IconSearch,
  IconTrain,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@skerp/ui/components/tooltip";

import { useCan } from "@/features/auth";

import type {
  VPWagonLoadingListRow,
} from "../vp-loading.service";
import { VPWagonLoadingStatusBadge } from "./vp-loading-ui";

export type VPLoadingTableRow =
  VPWagonLoadingListRow;
const DASH = "-";

type Props = {
  data: VPLoadingTableRow[];
  total: number;
  page: number;
  size: number;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

const formatNumber = (value: number | string | null | undefined) => {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) return DASH;

  return number.toLocaleString("en-IN");
};

function CountBadge({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </span>
  );
}


export default function VPLoadingTable({
  data,
  total,
  page,
  size,
  search,
  onSearchChange,
  onPageChange,
  isLoading = false,
  isFetching = false,
  isError = false,
  onRetry,
}: Props) {
  const canUpdate = useCan(PERMS.VP_LOADING.UPDATE);
  const columns = React.useMemo<
    ColumnDef<VPLoadingTableRow>[]
  >(
  () => [
    {
  header: "Schedule",

  cell: ({ row }) => {
    const schedule = row.original.schedule;

    const detailHref =
      `/vp-management/vp-loading/${encodeURIComponent(
        schedule.id,
      )}?rowId=${encodeURIComponent(
        row.original.mrRrRow.id,
      )}`;

    return (
      <div className="min-w-45">
        <div className="flex items-center gap-2">
          <IconTrain
            size={15}
            className="shrink-0 text-primary"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={detailHref}
                className="block max-w-60 truncate font-semibold text-primary hover:underline"
              >
                {schedule.scheduleNumber}
              </Link>
            </TooltipTrigger>

            <TooltipContent side="top">
              {schedule.scheduleNumber}
            </TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <p className="mt-1 max-w-72 truncate text-xs text-muted-foreground">
              {schedule.scheduleName || DASH}
            </p>
          </TooltipTrigger>

          <TooltipContent side="top">
            {schedule.scheduleName || DASH}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  },
},

    {
      header: "VP / Wagon",

      cell: ({ row }) => (
        <div className="min-w-20">
          <p className="font-semibold">
            {row.original.mrRrRow.vpNo ||
              row.original.mrRrRow
                .rowLabel ||
              DASH}
          </p>

          <p className="text-xs text-muted-foreground">
            {row.original.mrRrRow.wagon
              ?.name ||
              "Wagon not assigned"}
          </p>
        </div>
      ),
    },

   {
  header: "Route",

  cell: ({ row }) => {
    const schedule = row.original.schedule;

    const fromBranch = schedule.fromBranch?.name || DASH;
    const toBranch = schedule.toBranch?.name || DASH;

    const sourceArea = schedule.sourceArea?.name || DASH;
    const destinationArea =
      schedule.destinationArea?.name || DASH;

    return (
      <div className="min-w-56">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default items-center gap-2">
              <IconRoute
                size={14}
                className="shrink-0 text-muted-foreground"
              />

              <span className="max-w-24 truncate font-medium">
                {fromBranch}
              </span>

              <IconArrowRight
                size={14}
                className="shrink-0 text-muted-foreground"
              />

              <span className="max-w-24 truncate font-medium">
                {toBranch}
              </span>
            </div>
          </TooltipTrigger>

          <TooltipContent side="top">
            {fromBranch} to {toBranch}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <p className="mt-1 max-w-56 cursor-default truncate text-xs text-muted-foreground">
              {sourceArea} to {destinationArea}
            </p>
          </TooltipTrigger>

          <TooltipContent side="top">
            {sourceArea} to {destinationArea}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  },
},

    {
      header: "LR Count",

      cell: ({ row }) => (
        <CountBadge
          label="LR"
          value={formatNumber(row.original.allocationCount)}
        />
      ),
    },

    {
      header: "Loaded Qty",

      cell: ({ row }) => (
        <CountBadge
          label="Qty"
          value={formatNumber(row.original.totalLoadedQty)}
        />
      ),
    },

    {
      header: "Status",

      cell: ({ row }) => (
        <VPWagonLoadingStatusBadge
          status={row.original.status}
        />
      ),
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
    <TooltipProvider delayDuration={250}>
    <div className="w-full space-y-3">
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Wagon loading records</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Track VP wagons, route, LR allocation count and loading status.
            </p>
          </div>

        <div className="relative w-full sm:max-w-xl">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search schedule, VP no, wagon, route, quantity or status..."
            className="h-9 w-full pl-9"
          />
        </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <CountBadge
            label="Rows"
            value={formatNumber(total)}
          />
          <CountBadge
            label="Page"
            value={`${page + 1}/${pageCount}`}
          />
          {isFetching && !isLoading ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <IconRefresh size={13} className="animate-spin" />
              Refreshing...
            </span>
          ) : null}
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
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
              Array.from({ length: 6 }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-transparent">
                  {columns.map((_, columnIndex) => (
                    <TableCell key={columnIndex} className="h-10">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        {columnIndex < 4 ? (
                          <Skeleton className="h-3 w-20" />
                        ) : null}
                      </div>
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
                  className="py-14 text-center"
                >
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-6 text-red-700">
                    <IconDatabaseOff size={22} />
                    <div>
                      <p className="text-sm font-semibold">
                        Failed to load VP loading rows
                      </p>
                      <p className="mt-1 text-xs text-red-600">
                        Refresh the list and try again.
                      </p>
                    </div>
                    {onRetry ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRetry}
                      >
                        <IconRefresh size={15} className="mr-1" />
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-14 text-center text-muted-foreground"
                >
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                      <IconDatabaseOff size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        No wagon loadings found
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Wagon loading records will appear here after the first
                        LR/GRN is added to a VP wagon.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const item = row.original;
                const workspaceHref =
                  `/vp-management/vp-loading/${encodeURIComponent(
                    item.schedule.id,
                  )}?rowId=${encodeURIComponent(item.mrRrRow.id)}`;
                const editHref =
                  `/vp-management/vp-loading/${encodeURIComponent(
                    item.schedule.id,
                  )}/edit?rowId=${encodeURIComponent(item.mrRrRow.id)}`;
                const canEditLoading = canUpdate && item.status === "IN_PROGRESS";

                return (
                <TableRow
                  key={row.id}
                  className="group hover:bg-muted/20"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="h-10 whitespace-nowrap text-sm"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}

                  <TableCell className="w-16 text-right">
                    <div className="flex items-center justify-end">
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="VP loading actions"
                              >
                                <IconDotsVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>

                          <TooltipContent side="left">
                            VP loading actions
                          </TooltipContent>
                        </Tooltip>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={workspaceHref}>
                              <IconEye size={16} className="mr-2" />
                              View detail
                            </Link>
                          </DropdownMenuItem>

                          {canEditLoading ? (
                            <DropdownMenuItem asChild>
                              <Link href={editHref}>
                                <IconEdit size={16} className="mr-2" />
                                Add LR / GRN
                              </Link>
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
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Showing page {page + 1} of {pageCount} for {formatNumber(total)} wagon
          loading{total === 1 ? "" : "s"}.
        </p>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page === 0}
                className={
                  page === 0 ? "pointer-events-none opacity-50" : ""
                }
                onClick={(event) => {
                  event.preventDefault();
                  if (page > 0) onPageChange(page - 1);
                }}
              />
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={page + 1 >= pageCount}
                className={
                  page + 1 >= pageCount
                    ? "pointer-events-none opacity-50"
                    : ""
                }
                onClick={(event) => {
                  event.preventDefault();
                  if (page + 1 < pageCount) onPageChange(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
    </TooltipProvider>
  );
}
