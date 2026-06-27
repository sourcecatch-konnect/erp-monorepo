// apps/web/features/MRRR/mrrrTable.tsx

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
  IconEye,
} from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@skerp/ui/components/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import { TooltipProvider } from "@skerp/ui/components/tooltip";
import { TruncatedTooltipText } from "../VP-Schedule/vp-schedule-ui";
import { formatMRRRDate, MRRRStatusBadge } from "./mrrr-ui";


type MRRRRow = {
  id: string;
  mrRrNumber?: string | null;
  status?: string | null;
  rakeType?: string | null;
  remarks?: string | null;
  createdAt?: string | Date | null;

  vpSchedule?: {
    id: string;
    scheduleNumber?: string | null;
    scheduleName?: string | null;
    scheduleDate?: string | Date | null;

    fromBranch?: {
      id: string;
      name?: string | null;
      branchCode?: string | null;
    } | null;

    toBranch?: {
      id: string;
      name?: string | null;
      branchCode?: string | null;
    } | null;
  } | null;

  createdBy?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type MRRRTableProps = {
  data: MRRRRow[];
  isLoading: boolean;
};

const identifierLabel = (row: MRRRRow) => {
  return row.mrRrNumber || row.id;
};

const vpScheduleLabel = (row: MRRRRow) => {
  const number = row.vpSchedule?.scheduleNumber;
  const name = row.vpSchedule?.scheduleName;

  if (number && name) return `${number} | ${name}`;
  if (number) return number;
  if (name) return name;

  return "—";
};

const branchLabel = (row: MRRRRow) => {
  const from =
    row.vpSchedule?.fromBranch?.name ||
    row.vpSchedule?.fromBranch?.branchCode ||
    null;

  const to =
    row.vpSchedule?.toBranch?.name ||
    row.vpSchedule?.toBranch?.branchCode ||
    null;

  if (from || to) {
    return `${from ?? "?"} → ${to ?? "?"}`;
  }

  return "—";
};

const createdByLabel = (row: MRRRRow) => {
  if (!row.createdBy) return "—";

  return `${row.createdBy.firstName ?? ""} ${
    row.createdBy.lastName ?? ""
  }`.trim() || "—";
};

export default function MRRRTable({ data, isLoading }: MRRRTableProps) {
  const columns = React.useMemo<ColumnDef<MRRRRow>[]>(
    () => [
      {
        id: "mrRrNumber",
        header: "MR/RR No",
        size: 180,
        cell: ({ row }) => (
          <Link
            href={`/operations/mrrr/${encodeURIComponent(
              String(identifierLabel(row.original)),
            )}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.mrRrNumber ?? "—"}
          </Link>
        ),
      },
      {
        id: "vpSchedule",
        header: "VP Schedule",
        size: 240,
        cell: ({ row }) => (
          <TruncatedTooltipText value={vpScheduleLabel(row.original)} />
        ),
      },
      {
        id: "scheduleDate",
        header: "Schedule Date",
        size: 130,
        cell: ({ row }) =>
          formatMRRRDate(row.original.vpSchedule?.scheduleDate),
      },
      {
        id: "branch",
        header: "Branch",
        size: 200,
        cell: ({ row }) => (
          <TruncatedTooltipText value={branchLabel(row.original)} />
        ),
      },
      {
        id: "rakeType",
        header: "Rake Type",
        size: 120,
        cell: ({ row }) => row.original.rakeType ?? "—",
      },
      {
        id: "status",
        header: "Status",
        size: 130,
        cell: ({ row }) => (
          <MRRRStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "createdBy",
        header: "Created By",
        size: 140,
        cell: ({ row }) => (
          <TruncatedTooltipText value={createdByLabel(row.original)} />
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

  return (
    <TooltipProvider>
      <div className="w-full overflow-x-auto rounded-lg bg-card">
        <Table className="w-full table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground"
                    style={{
                      width: header.getSize(),
                      minWidth: header.getSize(),
                      maxWidth: header.getSize(),
                    }}
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
                      No MR/RR documents found
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const mrrr = row.original;
                const identifier = identifierLabel(mrrr);

                return (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="h-12 overflow-hidden text-sm"
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.getSize(),
                          maxWidth: cell.column.getSize(),
                        }}
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
                              aria-label="MR/RR actions"
                            >
                              <IconDotsVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/operations/MRRR/${encodeURIComponent(
                                  String(identifier),
                                )}`}
                              >
                                <IconEye size={16} className="mr-2" />
                                View details
                              </Link>
                            </DropdownMenuItem>

                            {mrrr.status === "DRAFT" ? (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/operations/MRRR/${encodeURIComponent(
                                    String(identifier),
                                  )}/edit`}
                                >
                                  <IconEdit size={16} className="mr-2" />
                                  Edit
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
    </TooltipProvider>
  );
}