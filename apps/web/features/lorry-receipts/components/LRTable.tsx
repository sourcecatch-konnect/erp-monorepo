"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { LRGroupListItem } from "@skerp/types";
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
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";

import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { LRStatusBadge, SOURCE_LABELS, LR_STATUS_ORDER } from "../lorry-receipt-ui";

type Props = {
  data: LRGroupListItem[];
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
  onCancel: (group: LRGroupListItem) => void;
};

export default function LRTable(props: Props) {
  const {
    data, total, page, size, onPageChange,
    search, onSearchChange,
    statusFilter, onStatusFilterChange,
    counts, isLoading,
    canCancel, onCancel,
  } = props;
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const columns = React.useMemo<ColumnDef<LRGroupListItem>[]>(
    () => [
      {
        id: "expand",
        header: "",
        cell: ({ row }) => {
          const lrs = row.original.lorryReceipts ?? [];
          const isExpanded = Boolean(expanded[row.original.id]);
          return (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={isExpanded ? "Collapse LRs" : "Expand LRs"}
              disabled={lrs.length === 0}
              onClick={() =>
                setExpanded((current) => ({
                  ...current,
                  [row.original.id]: !current[row.original.id],
                }))
              }
            >
              {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </Button>
          );
        },
      },
      {
        header: "Group #",
        cell: ({ row }) => (
         <Link
  href={`/lorry-receipts/${encodeURIComponent(row.original.groupNumber)}`}
  className="block"
>
            <span className="font-medium text-primary hover:underline">
              {row.original.groupNumber}
            </span>
          </Link>
        ),
      },
      { header: "Consignor", cell: ({ row }) => row.original.consignor?.name ?? "—" },
      { header: "Consignee", cell: ({ row }) => row.original.consignee?.name ?? "—" },
      { header: "Origin", cell: ({ row }) => row.original.originBranch?.name ?? "—" },
      { header: "Destination", cell: ({ row }) => row.original.destinationBranch?.name ?? "—" },
      {
        header: "Vehicle",
        cell: ({ row }) => {
          const g = row.original;
          if (g.isMarketVehicle) return g.marketVehicleNumber ?? "—";
          return g.primaryTrip?.vehicle?.vehicleNumber ?? "—";
        },
      },
      {
        header: "LRs",
        cell: ({ row }) => row.original.lrCount ?? "—",
      },
      {
        header: "Freight",
        cell: ({ row }) =>
          row.original.baseFreightAmount != null
            ? formatPaise(row.original.baseFreightAmount)
            : "—",
      },
      { header: "Source", cell: ({ row }) => SOURCE_LABELS[row.original.source] },
      { header: "Status", cell: ({ row }) => <LRStatusBadge status={row.original.status} /> },
    ],
    [expanded],
  );

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const pageCount = Math.max(1, Math.ceil(total / size));

  return (
    <div className="w-full space-y-3">
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
          placeholder="Search group number…"
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
                    <span className="text-sm font-medium">No LR groups found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const g = row.original;
                const cancellable = g.status === "DRAFT";
                const childRows = g.lorryReceipts ?? [];
                const isExpanded = Boolean(expanded[g.id]);
                return (
                  <React.Fragment key={row.id}>
                    <TableRow className="hover:bg-muted/30">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="h-12 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                      <TableCell className="w-16 text-right">
                        <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label="View group" asChild>
  <Link href={`/lorry-receipts/${encodeURIComponent(g.groupNumber)}`}>
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
                                <DropdownMenuItem className="text-red-600" onClick={() => onCancel(g)}>
                                  <IconBan size={16} className="mr-2" /> Cancel
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded ? (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={columns.length + 1} className="p-0">
                          <div className="px-4 py-3">
                            <div className="overflow-x-auto rounded-md border bg-background">
                              <table className="w-full min-w-[720px] text-sm">
                                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">LR #</th>
                                    <th className="px-3 py-2 font-semibold">Route</th>
                                    <th className="px-3 py-2 font-semibold">Invoice</th>
                                    <th className="px-3 py-2 font-semibold">E-way bill</th>
                                    <th className="px-3 py-2 font-semibold">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {childRows.map((lr) => (
                                    <tr key={lr.id} className="border-t">
                                      <td className="px-3 py-2 font-medium text-primary">
                                        <Link href={`/lorry-receipts/${encodeURIComponent(g.groupNumber)}`} className="hover:underline">
                                          {lr.lrNumber}
                                        </Link>
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {lr.loadingLocation?.name ?? "-"} -&gt;{" "}
                                        {lr.unloadingLocation?.name ?? "-"}
                                      </td>
                                      <td className="px-3 py-2">
                                        {lr.invoiceNumber ? (
                                          <div>
                                            <p>{lr.invoiceNumber}</p>
                                            {lr.invoiceAmount != null ? (
                                              <p className="text-xs text-muted-foreground">
                                                {formatPaise(lr.invoiceAmount)}
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground">-</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        {lr.ewayBill ? (
                                          <div>
                                            <p>{lr.ewayBill.ewayBillNo}</p>
                                            <p className="text-xs text-muted-foreground">
                                              Expires {formatDate(lr.ewayBill.expiresAt)}
                                            </p>
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground">-</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2">
                                        <LRStatusBadge status={lr.status} />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} group{total === 1 ? "" : "s"} · page {page + 1} of {pageCount}
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
