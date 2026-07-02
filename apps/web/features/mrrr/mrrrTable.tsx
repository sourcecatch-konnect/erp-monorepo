// apps/web/features/MRRR/mrrrTable.tsx

"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  IconBan,
  IconDatabaseOff,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconTrash,
} from "@tabler/icons-react";
import { PERMS } from "@skerp/types";

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@skerp/ui/components/tooltip";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { useCan } from "@/features/auth";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";
import { TruncatedTooltipText } from "../VP-Schedule/vp-schedule-ui";
import { formatMRRRDate, MRRRStatusBadge } from "./mrrr-ui";
import { useCancelMRRR, useDeleteMRRR } from "./hook/useMrrr";
import ReasonDialog from "@/components/feedback/ReasonDialog";


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
    sourceArea?: {
  id: string;
  name?: string | null;
  city?: {
    id: string;
    name?: string | null;
  } | null;
} | null;

destinationArea?: {
  id: string;
  name?: string | null;
  city?: {
    id: string;
    name?: string | null;
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
  return row.mrRrNumber || row.vpSchedule?.scheduleNumber || row.id;
};



const routeLabel = (row: MRRRRow) => {
  const sourceCity = row.vpSchedule?.sourceArea?.city?.name;
  const destinationCity = row.vpSchedule?.destinationArea?.city?.name;

  if (sourceCity || destinationCity) {
    return `${sourceCity ?? "?"} → ${destinationCity ?? "?"}`;
  }

  return "—";
};

const routeTooltipLabel = (row: MRRRRow) => {
  const sourceArea = row.vpSchedule?.sourceArea?.name;
  const destinationArea = row.vpSchedule?.destinationArea?.name;

  if (sourceArea || destinationArea) {
    return `Source Area: ${sourceArea ?? "?"}\nDestination Area: ${
      destinationArea ?? "?"
    }`;
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
const canDelete = useCan(PERMS.MRRR.DELETE);
const canCancel = useCan(PERMS.MRRR.CANCEL);

const deleteMutation = useDeleteMRRR();
const cancelMutation = useCancelMRRR();

const [deleteRow, setDeleteRow] = React.useState<MRRRRow | null>(null);
const [cancelRow, setCancelRow] = React.useState<MRRRRow | null>(null);

  const columns = React.useMemo<ColumnDef<MRRRRow>[]>(
    () => [

 {
  id: "vpSchedule",
  header: "VP Schedule Name",
  size: 220,
  cell: ({ row }) => {
    const mrrr = row.original;
    const vpSchedule = mrrr.vpSchedule;

    const label =
      vpSchedule?.scheduleName ??
      vpSchedule?.scheduleNumber ??
      "View MR/RR";

    return (
      <Link
        href={`/vp-management/mrrr/${encodeURIComponent(String(mrrr.id))}`}
        className="block cursor-pointer truncate font-medium text-primary underline-offset-4 hover:underline"
        title={label}
      >
        {label}
      </Link>
    );
  },
},
      {
        id: "scheduleDate",
        header: "Schedule Date",
        size: 120,
        cell: ({ row }) =>
          formatMRRRDate(row.original.vpSchedule?.scheduleDate),
      },
{
  id: "route",
  header: "Route",
  size: 160,
  cell: ({ row }) => {
    const mrrr = row.original;
    const schedule = mrrr.vpSchedule;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block cursor-help truncate">
            {routeLabel(mrrr)}
          </span>
        </TooltipTrigger>

        <TooltipContent side="top" className="z-50 max-w-sm">
          <div className="grid gap-1 text-xs">
            <p>
              <span className="font-medium">Source Area:</span>{" "}
              {schedule?.sourceArea?.name ?? "?"}
            </p>

            <p>
              <span className="font-medium">Destination Area:</span>{" "}
              {schedule?.destinationArea?.name ?? "?"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  },
},      {
        id: "rakeType",
        header: "Rake Type",
        size: 80,
        cell: ({ row }) => row.original.rakeType ?? "—",
      },
      {
        id: "status",
        header: "Status",
        size: 100,
        cell: ({ row }) => (
          <MRRRStatusBadge status={row.original.status} />
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

  const handleDelete = () => {
    if (!deleteRow) return;

    deleteMutation.mutate(deleteRow.id, {
      onSuccess: () => {
        toast.success("MR/RR deleted");
        setDeleteRow(null);
      },
      onError: (error) => {
        toast.error(getErrorMessage(error));
      },
    });
  };
const handleCancel = (reason: string) => {
  if (!cancelRow) return;

  cancelMutation.mutate(
    {
      id: cancelRow.id,
      body: { reason },
    },
    {
      onSuccess: () => {
        toast.success("MR/RR cancelled");
        setCancelRow(null);
      },
      onError: (error) => {
        toast.error(getErrorMessage(error));
      },
    },
  );
};
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
                                href={`/vp-management/mrrr/${encodeURIComponent(
                                  String(identifier),
                                )}`}
                              >
                                <IconEye size={16} className="mr-2" />
                                View details
                              </Link>
                            </DropdownMenuItem>

                            {mrrr.status === "DRAFT" ? (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/vp-management/mrrr/${encodeURIComponent(
                                      String(identifier),
                                    )}/edit`}
                                  >
                                    <IconEdit size={16} className="mr-2" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                                {canCancel && ["DRAFT", "SUBMITTED"].includes(mrrr.status ?? "") ? (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      className="text-red-600 focus:text-red-700"
      disabled={cancelMutation.isPending}
      onClick={() => setCancelRow(mrrr)}
    >
      <IconBan size={16} className="mr-2" />
      Cancel
    </DropdownMenuItem>
  </>
) : null}
                                {canDelete ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      disabled={deleteMutation.isPending}
                                      onClick={() => setDeleteRow(mrrr)}
                                    >
                                      <IconTrash size={16} className="mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
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

      <ConfirmDialog
        open={Boolean(deleteRow)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setDeleteRow(null);
          }
        }}
        title={`Delete MR/RR ${deleteRow ? identifierLabel(deleteRow) : ""}`}
        description="This will hide the draft MR/RR from the normal list. Submitted MR/RR documents cannot be deleted."
        confirmLabel="Delete MR/RR"
        pendingLabel="Deleting..."
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
      <ReasonDialog
  open={Boolean(cancelRow)}
  onOpenChange={(open) => {
    if (!open && !cancelMutation.isPending) {
      setCancelRow(null);
    }
  }}
  title={`Cancel MR/RR ${cancelRow ? identifierLabel(cancelRow) : ""}`}
  description="This will cancel the MR/RR and it cannot continue in the railway process."
  confirmLabel="Cancel MR/RR"
  destructive
  isPending={cancelMutation.isPending}
  onConfirm={handleCancel}
/>
    </TooltipProvider>
  );
}
