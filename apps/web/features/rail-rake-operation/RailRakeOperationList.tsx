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
  IconSend,
  IconTrash,
} from "@tabler/icons-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
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

import {
  useDeleteRailRakeOperation,
  useRailRakeOperations,
  useSubmitRailRakeOperation,
} from "./useRailRakeOperation";
import {
  railRakeOperationContext,
  type RailRakeOperationContext,
} from "./rail-rake-operation.context";
import { RailRakeOperationStatusBadge } from "./railRakeOperationStatusBadge";

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
    : "—";


export default function RailRakeOperationList({
  context,
}: {
  context: RailRakeOperationContext;
}) {
  const contextConfig = railRakeOperationContext[context];
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const debounced = useDebouncedValue(search);
  const size = 10;
  const query = useRailRakeOperations({
    page,
    size,
    search: debounced.trim(),
    filter: {
      stage: contextConfig.stage,
      ...(status === "ALL" ? {} : { status }),
    },
  });
  const remove = useDeleteRailRakeOperation();
  const submit = useSubmitRailRakeOperation();
  const canCreate = useCan(contextConfig.permissions.CREATE);
  const canUpdate = useCan(contextConfig.permissions.UPDATE);
  const canDelete = useCan(contextConfig.permissions.DELETE);
  const canSubmit = useCan(contextConfig.permissions.SUBMIT);
  const rows = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / size));

  React.useEffect(() => setPage(0), [debounced, status]);

  const handleSubmit = async (id: string, version: number) => {
    if (!window.confirm("Submit this Rake operation?")) return;
    try {
      await submit.mutateAsync({ id, version });
      toast.success("Rake operation submitted");
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this draft Rake operation?")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Rake operation deleted");
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{contextConfig.title}</h1>
          <p className="text-sm text-muted-foreground">
            {contextConfig.description}
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href={`${contextConfig.basePath}/new`}>
              <IconPlus size={16} className="mr-1.5" />
              New Entry
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Rake, branch or railhead..."
          className="max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="min-w-[1050px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Rake ID</TableHead>
              <TableHead>Responsible branch</TableHead>
              <TableHead>Operation area</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 7 }).map((__, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : query.isError ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <p className="font-medium">Unable to load Rake operations</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getErrorMessage(query.error)}
                  </p>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-14 text-center text-muted-foreground"
                >
                  <IconDatabaseOff size={22} className="mx-auto mb-2" />
                  No Rake operations found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`${contextConfig.basePath}/${row.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.railRake.rakeNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.railRake.vpSchedule.scheduleNumber}
                    </p>
                  </TableCell>
                  <TableCell>{row.branch.name}</TableCell>
                  <TableCell>{row.area.name}</TableCell>
                  <TableCell>{date(row.arrivalAt)}</TableCell>
                  <TableCell>{date(row.departureAt)}</TableCell>
                  <TableCell>
                    <RailRakeOperationStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost">
                          <IconDotsVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`${contextConfig.basePath}/${row.id}`}>
                            <IconListDetails size={16} className="mr-2" />
                            View details
                          </Link>
                        </DropdownMenuItem>
                        {canUpdate && row.status === "DRAFT" ? (
                          <DropdownMenuItem asChild>
                            <Link
                              href={`${contextConfig.basePath}/${row.id}/edit`}
                            >
                              <IconEdit size={16} className="mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        {canSubmit && row.status === "DRAFT" ? (
                          <DropdownMenuItem
                            onClick={() => handleSubmit(row.id, row.version)}
                          >
                            <IconSend size={16} className="mr-2" />
                            Submit
                          </DropdownMenuItem>
                        ) : null}
                        {canDelete && row.status === "DRAFT" ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(row.id)}
                            >
                              <IconTrash size={16} className="mr-2" />
                              Delete
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

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page === 0}
              onClick={(event) => {
                event.preventDefault();
                setPage((value) => Math.max(0, value - 1));
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 text-sm">
              Page {page + 1} of {pageCount}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page + 1 >= pageCount}
              onClick={(event) => {
                event.preventDefault();
                setPage((value) => Math.min(pageCount - 1, value + 1));
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
