"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";

import type {
  AgreementWithRelations,
  RateMatrixWithRelations,
} from "@skerp/types";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@skerp/ui/components/table";

import { Button } from "@skerp/ui/components/button";
import { Checkbox } from "@skerp/ui/components/checkbox";
import { Skeleton } from "@skerp/ui/components/skeleton";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@skerp/ui/components/tooltip";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";

import {
  IconChevronLeft,
  IconColumns,
  IconDatabaseOff,
  IconEdit,
  IconEye,
  IconTrash,
} from "@tabler/icons-react";

import { agreementApi } from "../../Agreements/agreements.service";
import { rateMatrixApi } from "../rateMatrix.service";
import { rateMatrixKeys } from "../rateMatrix.key";

import { formatDate } from "./agreement.util";

import { AgreementDeleteDialog } from "./agreement-delete-dialog";
import { useCompanyAgreements } from "../../Agreements/useAgreement";
import AgreementDetailDialog from "../../Agreements/agreementDialog";

type Props = {
  rateMatrixId: string;
};

export default function RateMatrixCompanyAgreementsPage({
  rateMatrixId,
}: Props) {
  const router = useRouter();

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const [viewAgreement, setViewAgreement] =
    React.useState<AgreementWithRelations | null>(null);

  const [deleteAgreement, setDeleteAgreement] =
    React.useState<AgreementWithRelations | null>(null);

  const [isDeleting, setIsDeleting] = React.useState(false);

  const rateMatrix = useQuery({
    queryKey: rateMatrixKeys.detail(rateMatrixId),
    queryFn: () => rateMatrixApi.detail(rateMatrixId),
    enabled: Boolean(rateMatrixId),
  });

  const detail = rateMatrix.data as RateMatrixWithRelations | undefined;

  const companyId = detail?.agreement?.company?.id;
  const companyName = detail?.agreement?.company?.name ?? "-";
console.log(detail,"eeg")
 const [search, setSearch] = React.useState("");
const [page, setPage] = React.useState(0);
const size = 25;

const {
  agreements,
  total,
  pageCount,
  isLoading: agreementsLoading,
  refetch: refetchAgreements,
} = useCompanyAgreements({
  companyId,
  page,
  size,
  search,
});

  const handleDelete = async () => {
    if (!deleteAgreement) return;

    try {
      setIsDeleting(true);

      await agreementApi.remove(deleteAgreement.id);

    await refetchAgreements();
      setDeleteAgreement(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = React.useMemo<ColumnDef<AgreementWithRelations>[]>(
    () => [
      {
        id: "select",
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(Boolean(value))
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label="Select row"
          />
        ),
      },
      {
        id: "company",
        header: "Company",
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-slate-950">
              {row.original.company?.name ?? "-"}
            </p>
            <p className="text-xs text-muted-foreground">
              Agreement ID: {row.original.id.slice(0, 8)}
            </p>
          </div>
        ),
      },
      {
        id: "consigner",
        header: "Consigner",
        cell: ({ row }) => row.original.client?.name ?? "-",
      },
      {
        id: "city",
        header: "City",
        cell: ({ row }) => row.original.city?.name ?? "-",
      },
      {
        id: "branch",
        header: "Branch",
        cell: ({ row }) => row.original.branch?.name ?? "-",
      },
      {
        id: "startDate",
        header: "Start Date",
        cell: ({ row }) => formatDate(row.original.startDate),
      },
      {
        id: "agreementDate",
        header: "Agreement Date",
        cell: ({ row }) => formatDate(row.original.agreementDate),
      },
      {
        id: "expiryDate",
        header: "Expiry Date",
        cell: ({ row }) => formatDate(row.original.expiryDate),
      },
     
      {
        id: "actions",
        header: "Actions",
        enableHiding: false,
        cell: ({ row }) => {
          const agreement = row.original;

          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewAgreement(agreement)}
                  >
                    <IconEye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View agreement</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => router.push("/dashboard/masters/agreement")}
                  >
                    <IconEdit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit from agreement master</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setDeleteAgreement(agreement)}
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete agreement</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [router]
  );

  const table = useReactTable({
    data: agreements,
    columns,
    state: {
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: true,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

const isLoading = rateMatrix.isLoading || agreementsLoading;

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="-ml-2 mb-2 gap-1 text-muted-foreground"
              >
                <IconChevronLeft className="h-4 w-4" />
                Back to Rate Matrix
              </Button>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Company Agreements
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Showing all agreements related to{" "}
                <span className="font-semibold text-slate-900">
                  {companyName}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {total} Agreements
              </div>

              <div className="rounded-full border bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {Object.keys(rowSelection).length} Selected
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-2">
                    <IconColumns className="h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-52">
                  {table
                    .getAllLeafColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(Boolean(value))
                        }
                        className="capitalize"
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {!rateMatrix.isLoading && !companyId ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            Company not found for this rate matrix.
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-950">
              Related Agreements
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Agreements are filtered using the company linked with this rate matrix.
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="bg-white hover:bg-white"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="whitespace-nowrap border-b text-xs font-bold uppercase tracking-wide text-slate-500"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {table.getVisibleLeafColumns().map((column) => (
                        <TableCell key={column.id}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="transition hover:bg-slate-50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="whitespace-nowrap py-4 text-sm text-slate-700"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={table.getVisibleLeafColumns().length}
                      className="h-64"
                    >
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-3 rounded-full bg-slate-100 p-4 text-slate-500">
                          <IconDatabaseOff className="h-7 w-7" />
                        </div>

                        <p className="text-sm font-semibold text-slate-950">
                          No agreements found
                        </p>

                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          No agreements are available for this company.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      <AgreementDetailDialog
  open={Boolean(viewAgreement)}
  onOpenChange={(open) => {
    if (!open) setViewAgreement(null);
  }}
  data={viewAgreement ?? undefined}
  isLoading={false}
/>

        <AgreementDeleteDialog
          open={Boolean(deleteAgreement)}
          agreement={deleteAgreement}
          isDeleting={isDeleting}
          onOpenChange={(open) => {
            if (!open) setDeleteAgreement(null);
          }}
          onConfirm={handleDelete}
        />
      </div>
    </TooltipProvider>
  );
}