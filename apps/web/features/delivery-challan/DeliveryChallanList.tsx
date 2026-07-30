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
  IconX,
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

import { DeliveryChallanStatusBadge } from "./DeliveryChallanStatusBadge";
import {
  useCancelDeliveryChallan,
  useDeleteDeliveryChallan,
  useDeliveryChallans,
  useIssueDeliveryChallan,
} from "./useDeliveryChallan";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function DeliveryChallanList() {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const debouncedSearch = useDebouncedValue(search);
  const size = 10;
  const query = useDeliveryChallans({
    page,
    size,
    search: debouncedSearch.trim(),
    filter: status === "ALL" ? undefined : { status },
  });
  const issue = useIssueDeliveryChallan();
  const cancel = useCancelDeliveryChallan();
  const remove = useDeleteDeliveryChallan();
  const canCreate = useCan(PERMS.DELIVERY_CHALLAN.CREATE);
  const canUpdate = useCan(PERMS.DELIVERY_CHALLAN.UPDATE);
  const canDelete = useCan(PERMS.DELIVERY_CHALLAN.DELETE);
  const canIssue = useCan(PERMS.DELIVERY_CHALLAN.ISSUE);
  const canCancel = useCan(PERMS.DELIVERY_CHALLAN.CANCEL);
  const rows = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / size));

  React.useEffect(() => setPage(0), [debouncedSearch, status]);

  const handleIssue = async (id: string, version: number) => {
    if (
      !window.confirm(
        "Issue this Delivery Challan? It can no longer be edited.",
      )
    ) {
      return;
    }
    try {
      await issue.mutateAsync({ id, version });
      toast.success("Delivery Challan issued");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCancel = async (id: string, version: number) => {
    const reason = window.prompt("Enter cancellation reason:");
    if (!reason?.trim()) return;
    try {
      await cancel.mutateAsync({ id, version, reason: reason.trim() });
      toast.success("Delivery Challan cancelled");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this Delivery Challan draft?")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Delivery Challan draft deleted");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Delivery Challans</h1>
          <p className="text-sm text-muted-foreground">
            Dispatch Branch GRN goods by VP and track pending quantities.
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/vp-management/delivery-challans/new">
              <IconPlus size={16} className="mr-1.5" />
              Create Delivery Challan
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search challan, vehicle or transporter..."
          className="max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ISSUED">Issued</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="min-w-[1050px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Challan number</TableHead>
              <TableHead>Rake / VP</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Loading</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 7 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 8 }).map((__, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : query.isError ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <p className="font-medium">
                    Unable to load Delivery Challans
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getErrorMessage(query.error)}
                  </p>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-14 text-center text-muted-foreground"
                >
                  <IconDatabaseOff size={22} className="mx-auto mb-2" />
                  No Delivery Challans found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/vp-management/delivery-challans/${row.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.challanNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {row.branchGrn.railRake.rakeNumber}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.branchGrn.vpWagonLoading.mrRrRow.vpNo ||
                        row.branchGrn.vpWagonLoading.mrRrRow.rowLabel}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{row.sourceBranch.name}</div>
                    <div className="max-w-48 truncate text-xs text-muted-foreground">
                      to{" "}
                      {row.destinationArea?.name ||
                        row.destinationLocation?.name ||
                        row.deliveryAddressSnapshot ||
                        "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{row.vehicleNumberSnapshot || "Client delivery"}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.transporterNameSnapshot || row.vehicleMode}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(row.loadingAt)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {row.totalQuantity}
                  </TableCell>
                  <TableCell>
                    <DeliveryChallanStatusBadge status={row.status} />
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
                          <Link
                            href={`/vp-management/delivery-challans/${row.id}`}
                          >
                            <IconListDetails size={16} className="mr-2" />
                            View details
                          </Link>
                        </DropdownMenuItem>
                        {canUpdate && row.status === "DRAFT" ? (
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/vp-management/delivery-challans/${row.id}/edit`}
                            >
                              <IconEdit size={16} className="mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        {canIssue && row.status === "DRAFT" ? (
                          <DropdownMenuItem
                            onClick={() => handleIssue(row.id, row.version)}
                          >
                            <IconSend size={16} className="mr-2" />
                            Issue challan
                          </DropdownMenuItem>
                        ) : null}
                        {canCancel && row.status !== "CANCELLED" ? (
                          <DropdownMenuItem
                            onClick={() => handleCancel(row.id, row.version)}
                          >
                            <IconX size={16} className="mr-2" />
                            Cancel challan
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
          {total} challan{total === 1 ? "" : "s"} · page {page + 1} of{" "}
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
