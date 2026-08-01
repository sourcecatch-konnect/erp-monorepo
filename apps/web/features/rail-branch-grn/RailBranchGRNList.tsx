"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  IconDatabaseOff,
  IconDotsVertical,
  IconEdit,
  IconListDetails,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

import { useCan } from "@/features/auth";
import { useDebouncedValue } from "@/features/masters/_shared/hooks/useDebouncedValue";
import getErrorMessage from "@/features/masters/_shared/hooks/useMasterMutation";

import { useDeleteRailBranchGRN, useRailBranchGRNs } from "./useRailBranchGRN";
import { RailBranchGRNStatusBadge } from "./RailBranchGRNStatusBadge";



const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value))
    : "—";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN").format(value);


export default function RailBranchGRNList() {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search);
  const size = 10;
  const query = useRailBranchGRNs({
    page,
    size,
    search: debouncedSearch.trim(),
  });
  const remove = useDeleteRailBranchGRN();
  const canCreate = useCan(PERMS.RAIL_BRANCH_GRN.CREATE);
  const canUpdate = useCan(PERMS.RAIL_BRANCH_GRN.UPDATE);
  const canDelete = useCan(PERMS.RAIL_BRANCH_GRN.DELETE);
  const rows = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / size));

  React.useEffect(() => setPage(0), [debouncedSearch]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this draft Branch GRN?")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Branch GRN draft deleted");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            Goods Receipt Notes at Branch
          </h1>
          <p className="text-sm text-muted-foreground">
            Receive verified VP goods from incoming rail rakes.
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/vp-management/branch-grn/new">
              <IconPlus size={16} className="mr-1.5" />
              Create Branch GRN
            </Link>
          </Button>
        ) : null}
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search Rake ID or VP number..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Rake ID</TableHead>
              <TableHead>VP number</TableHead>
              <TableHead>Schedule date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Loaded</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Damage</TableHead>
              <TableHead className="text-right">Shortage</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 9 }).map((__, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : query.isError ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <p className="font-medium">Unable to load Branch GRNs</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getErrorMessage(query.error)}
                  </p>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-14 text-center text-muted-foreground"
                >
                  <IconDatabaseOff size={22} className="mx-auto mb-2" />
                  No Branch GRNs found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((grn) => (
                <TableRow key={grn.id}>
                  <TableCell>
                    <Link
                      href={`/vp-management/branch-grn/${grn.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {grn.railRake.rakeNumber}
                    </Link>

                  </TableCell>
                  <TableCell className="font-medium">
                    {grn.vpWagonLoading.mrRrRow.vpNo || "—"}
                  </TableCell>
                  <TableCell>
                    {formatDate(grn.railRake.vpSchedule.scheduleDate)}
                  </TableCell>
                  <TableCell>
                    <RailBranchGRNStatusBadge status={grn.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(grn.totalLoadedQty)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(grn.totalReceivedQty)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(grn.totalDamageQty)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(grn.totalShortageQty)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Branch GRN actions"
                        >
                          <IconDotsVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/vp-management/branch-grn/${grn.id}`}>
                            <IconListDetails size={16} className="mr-2" />
                            View details
                          </Link>
                        </DropdownMenuItem>
                        {canUpdate &&
                          ["DRAFT", "SUBMITTED"].includes(grn.status) ? (
                          <DropdownMenuItem asChild>
                            <Link href={`/vp-management/branch-grn/${grn.id}/edit`}>
                              <IconEdit size={16} className="mr-2" />
                              {grn.status === "SUBMITTED" ? "Correct GRN" : "Edit"}
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        {canDelete && grn.status === "DRAFT" ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(grn.id)}
                            >
                              <IconTrash size={16} className="mr-2" />
                              Delete draft
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} Branch GRN{total === 1 ? "" : "s"} · page {page + 1} of{" "}
          {pageCount}
        </p>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page === 0}
                className={page === 0 ? "pointer-events-none opacity-50" : ""}
                onClick={(event) => {
                  event.preventDefault();
                  if (page > 0) setPage(page - 1);
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
                onClick={(event) => {
                  event.preventDefault();
                  if (page + 1 < pageCount) setPage(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
