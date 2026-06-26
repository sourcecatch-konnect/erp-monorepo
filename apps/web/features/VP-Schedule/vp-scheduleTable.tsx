// apps/web/features/vp-schedule/components/VPScheduleTable.tsx

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

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
import {
  IconDatabaseOff,
  IconDotsVertical,
  IconEdit,
  IconEye,
} from "@tabler/icons-react";
import { formatVPScheduleDate, TruncatedTooltipText, VPScheduleStatusBadge } from "./vp-schedule-ui";
import { TooltipProvider } from "@skerp/ui/components/tooltip";

type VPScheduleRow = {
  id: string;
  scheduleNumber?: string | null;
  scheduleName?: string | null;
  scheduleDate?: string | Date | null;
  status?: string | null;
  remarks?: string | null;

  sourceArea?: {
    id: string;
    name: string;
  } | null;

  destinationArea?: {
    id: string;
    name: string;
  } | null;

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

  totalWagonCount?: number | null;
  totalCapacityMt?: number | null;
  totalCapacityCft?: number | null;

  createdBy?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type VPScheduleTableProps = {
  data: VPScheduleRow[];
  isLoading: boolean;
};

const formatDate = (date?: string | Date | null) => {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const routeLabel = (schedule: VPScheduleRow) => {
  const source = schedule.sourceArea?.name;
  const destination = schedule.destinationArea?.name;

  if (source || destination) {
    return `${source ?? "?"} → ${destination ?? "?"}`;
  }

  return "—";
};

const branchLabel = (schedule: VPScheduleRow) => {
  const from =
    schedule.fromBranch?.name || schedule.fromBranch?.branchCode || null;

  const to = schedule.toBranch?.name || schedule.toBranch?.branchCode || null;

  if (from || to) {
    return `${from ?? "?"} → ${to ?? "?"}`;
  }

  return "—";
};

const capacityLabel = (schedule: VPScheduleRow) => {
  const mt = schedule.totalCapacityMt ?? 0;
  const cft = schedule.totalCapacityCft ?? 0;

  return `${mt} MT / ${cft} CFT`;
};

const createdByLabel = (schedule: VPScheduleRow) => {
  if (!schedule.createdBy) return "—";

  return `${schedule.createdBy.firstName ?? ""} ${
    schedule.createdBy.lastName ?? ""
  }`.trim();
};

export default function VPScheduleTable({
  data,
  isLoading,
}: VPScheduleTableProps) {
  const columns = React.useMemo<ColumnDef<VPScheduleRow>[]>(
  () => [
    {
      id: "scheduleNumber",
      header: "Schedule No",
      size: 180,
      cell: ({ row }) => (
        <Link
          href={`/operations/vp-schedule/${encodeURIComponent(
            String(row.original.scheduleNumber || row.original.id),
          )}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.scheduleNumber ?? "—"}
        </Link>
      ),
    },
    {
      id: "scheduleName",
      header: "Schedule Name",
      size: 220,
      cell: ({ row }) => (
        <TruncatedTooltipText value={row.original.scheduleName ?? "—"} />
      ),
    },
    {
      id: "scheduleDate",
      header: "Date",
      size: 100,
      cell: ({ row }) => formatVPScheduleDate(row.original.scheduleDate),
    },
    {
      id: "route",
      header: "Route",
      size: 340,
      cell: ({ row }) => (
        <TruncatedTooltipText value={routeLabel(row.original)} />
      ),
    },
    {
      id: "branch",
      header: "Branch",
      size: 180,
      cell: ({ row }) => (
        <TruncatedTooltipText value={branchLabel(row.original)} />
      ),
    },
    {
      id: "totalWagonCount",
      header: "Wagons",
      size: 90,
      cell: ({ row }) => row.original.totalWagonCount ?? 0,
    },
    {
      id: "capacity",
      header: "Capacity",
      size: 150,
      cell: ({ row }) => (
        <TruncatedTooltipText value={capacityLabel(row.original)} />
      ),
    },
    {
      id: "status",
      header: "Status",
      size: 140,
      cell: ({ row }) => (
        <VPScheduleStatusBadge status={row.original.status} />
      ),
    },
    {
      id: "createdBy",
      header: "Created By",
      size: 100,
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
                    No VP schedules found
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
              const schedule = row.original;

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
  {flexRender(cell.column.columnDef.cell, cell.getContext())}
</TableCell>
                  ))}

                  <TableCell className="w-16 text-right">
                    <div className="flex justify-end gap-1">
                
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="VP schedule actions"
                          >
                            <IconDotsVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                         <Link
  href={`/operations/vp-schedule/${encodeURIComponent(
    String(schedule.scheduleNumber || schedule.id)
  )}`}
  className="font-medium text-primary hover:underline"
>
                               
                              <IconEye size={16} className="mr-2" />
                              View details
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild>
                            <Link
                              href={`/operations/vp-schedule/${schedule.id}/edit`}
                            >
                              <IconEdit size={16} className="mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
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