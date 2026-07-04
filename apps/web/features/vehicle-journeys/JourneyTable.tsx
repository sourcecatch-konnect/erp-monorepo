"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { VehicleJourney } from "@skerp/types";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@skerp/ui/components/pagination";
import { IconEye, IconDatabaseOff } from "@tabler/icons-react";

import {
  JourneyStatusBadge,
  JOURNEY_STATUS_ORDER,
  SETTLEMENT_LABELS,
  formatDateTime,
} from "./journey-ui";

type Props = {
  data: VehicleJourney[];
  total: number;
  page: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  counts: Record<string, number>;
  isLoading?: boolean;
};

/** "Jalgaon → Pune → Howrah" built from the journey's ordered legs. */
const routeChain = (j: VehicleJourney) => {
  const cities: string[] = [j.startCity?.name ?? "?"];
  for (const leg of j.trips ?? []) {
    if (leg.toCity?.name) cities.push(leg.toCity.name);
  }
  return cities.join(" → ");
};

const lastClosingKm = (j: VehicleJourney) => {
  const closed = (j.trips ?? []).filter((l) => l.closingKm !== null);
  const last = closed[closed.length - 1];
  return last?.closingKm ?? null;
};

export default function JourneyTable(props: Props) {
  const {
    data,
    total,
    page,
    size,
    onPageChange,
    onSizeChange,
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    counts,
    isLoading,
  } = props;

  const columns = React.useMemo<ColumnDef<VehicleJourney>[]>(
    () => [
      {
        header: "Journey",
        cell: ({ row }) => (
          <Link href={`/vehicle-journeys/${row.original.id}`} className="block">
            <span className="block font-medium text-primary hover:underline">
              {row.original.journeyNumber}
            </span>
            <span className="block text-xs text-muted-foreground">
              {formatDateTime(row.original.startedAt)}
            </span>
          </Link>
        ),
      },
      {
        header: "Vehicle",
        cell: ({ row }) => row.original.vehicle?.vehicleNumber ?? "—",
      },
      {
        header: "Driver",
        cell: ({ row }) => row.original.driver?.name ?? "—",
      },
      {
        header: "Route chain",
        cell: ({ row }) => (
          <span className="text-sm">{routeChain(row.original)}</span>
        ),
      },
      {
        header: "Current city",
        cell: ({ row }) => row.original.currentCity?.name ?? "—",
      },
      {
        header: "KM",
        cell: ({ row }) => {
          const last = lastClosingKm(row.original);
          return (
            <span className="whitespace-nowrap text-sm">
              {row.original.openingKm}
              {last !== null ? ` → ${last}` : ""}
            </span>
          );
        },
      },
      {
        header: "Status",
        cell: ({ row }) => <JourneyStatusBadge status={row.original.status} />,
      },
      {
        header: "Settlement",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {SETTLEMENT_LABELS[row.original.settlementStatus]}
          </span>
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
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

  return (
    <div className="w-full space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-1">
        {JOURNEY_STATUS_ORDER.map((tab) => {
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
                    active
                      ? "bg-primary-foreground/20"
                      : "bg-muted-foreground/10"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative w-full sm:max-w-sm">
        <Input
          placeholder="Search journey no., vehicle or driver..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="w-full overflow-x-auto rounded-lg border bg-card">
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
                <TableHead className="h-10 w-12 text-right text-xs font-semibold uppercase text-muted-foreground">
                  View
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
                  <TableCell className="w-12">
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
                    <span className="text-sm font-medium">
                      No journeys found
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="h-12 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  <TableCell className="w-12 text-right">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="View journey"
                      asChild
                    >
                      <Link href={`/vehicle-journeys/${row.original.id}`}>
                        <IconEye size={16} />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
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
              onChange={(e) => onSizeChange(Number(e.target.value))}
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
