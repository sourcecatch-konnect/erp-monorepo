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
  IconTrash,
} from "@tabler/icons-react";
import { TruncatedTooltipText, VPScheduleStatusBadge } from "./vp-schedule-ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@skerp/ui/components/tooltip";
import { useDeleteVPSchedule } from "./hook/useVPSchedule";
import { toast } from "sonner";

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
  city?: {
    id: string;
    name: string;
  } | null;
} | null;

destinationArea?: {
  id: string;
  name: string;
  city?: {
    id: string;
    name: string;
  } | null;
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


const routeLabel = (schedule: VPScheduleRow) => {
  const sourceCity = schedule.sourceArea?.city?.name;
  const destinationCity = schedule.destinationArea?.city?.name;

  if (sourceCity || destinationCity) {
    return `${sourceCity ?? "?"} → ${destinationCity ?? "?"}`;
  }

  return "—";
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
  const deleteMutation = useDeleteVPSchedule();

  const handleDelete = async (schedule: VPScheduleRow) => {
    const label = schedule.scheduleName || schedule.scheduleNumber || "this VP schedule";

    const confirmed = window.confirm(
      `Are you sure you want to delete ${label}?`,
    );

    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(schedule.id);
      toast.success("VP schedule deleted");
    } catch {
      toast.error("Failed to delete VP schedule");
    }
  };
  const columns = React.useMemo<ColumnDef<VPScheduleRow>[]>(
  () => [
{
  id: "scheduleName",
  header: "Schedule Name",
  size: 260,
  cell: ({ row }) => {
    const schedule = row.original;

    return (
      <Link
        href={`/vp-management/vp-schedule/${encodeURIComponent(
          String(schedule.scheduleNumber || schedule.id),
        )}`}
        className="block min-w-0 cursor-pointer font-medium text-primary hover:underline"
      >
        <TruncatedTooltipText
          value={schedule.scheduleName ?? "—"}
          className="cursor-pointer"
        />
      </Link>
    );
  },
},
    {
      id: "route",
      header: "Route",
      size: 160,
      cell: ({ row }) => {
        const schedule = row.original;

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block truncate cursor-help">
                {routeLabel(schedule)}
              </span>
            </TooltipTrigger>

            <TooltipContent side="top" className="z-50 max-w-sm">
              <div className="grid gap-1 text-xs">
                <p>
                  <span className="font-medium">Source Area:</span>{" "}
                  {schedule.sourceArea?.name ?? "?"}
                </p>

                <p>
                  <span className="font-medium">Destination Area:</span>{" "}
                  {schedule.destinationArea?.name ?? "?"}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      },
    },

    {
      id: "totalWagonCount",
      header: "Wagons",
      size: 90,
      cell: ({ row }) => row.original.totalWagonCount ?? 0,
    },

    {
      id: "status",
      header: "Status",
      size: 120,
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

            <TableHead className="sticky right-0 z-20 h-10 w-16 bg-muted text-right text-xs font-semibold uppercase text-muted-foreground ">
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
                <TableRow key={row.id} className="group hover:bg-muted/30">
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

                 <TableCell className="sticky right-0 z-10 w-16 bg-card text-right  group-hover:bg-muted/30">
                    <div className="flex justify-end gap-1">
                <DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      type="button"
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
        href={`/vp-management/vp-schedule/${encodeURIComponent(
          String(schedule.scheduleNumber || schedule.id),
        )}`}
      >
        <IconEye size={16} className="mr-2" />
        View details
      </Link>
    </DropdownMenuItem>

    <DropdownMenuItem asChild>
      <Link href={`/vp-management/vp-schedule/${schedule.id}/edit`}>
        <IconEdit size={16} className="mr-2" />
        Edit
      </Link>
    </DropdownMenuItem>

    <DropdownMenuItem
      disabled={deleteMutation.isPending}
      className="text-destructive focus:text-destructive"
      onSelect={(event) => {
        event.preventDefault();
        handleDelete(schedule);
      }}
    >
      <IconTrash size={16} className="mr-2" />
      Delete
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
