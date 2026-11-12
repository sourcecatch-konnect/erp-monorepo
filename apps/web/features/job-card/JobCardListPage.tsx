"use client";

import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { TablePaginationFooter } from "@/components/data-table/TablePaginationFooter";

import { useCan } from "@/features/auth";
import { formatPaise } from "@/lib/money";
import type { JobCardStatus } from "./api/job-card.service";
import { useJobCardList } from "./useJobCardList";
import { JobCardStatusBadge } from "./jobCardStatusBadge";

export function JobCardListPage() {
  const canManage = useCan(PERMS.WORKSHOP.JOBCARD_MANAGE);

  const {
    search,
    setSearch,
    status,
    setStatus,
    page,
    setPage,
    size,
    setSize,
    list,
  } = useJobCardList();
  const jobCards = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Job Cards</h1>
          <p className="text-sm text-muted-foreground">
            A truck&apos;s workshop visit. Save keeps it a draft — parts only
            leave stock and post to accounts once you Finalise.
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/workshop/job-cards/new">
              <IconPlus size={15} className="mr-1" /> New Job Card
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="Search job cards"
          placeholder="Search job card, vehicle or driver..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={200}
          className="sm:max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as JobCardStatus | "ALL")}
        >
          <SelectTrigger
            aria-label="Filter job cards by status"
            className="w-[180px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="FINALISED">Finalised</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.isError && (
        <div
          role="alert"
          className="flex items-center gap-3 text-sm text-destructive"
        >
          Unable to load job cards.
          <Button
            variant="outline"
            size="sm"
            onClick={() => void list.refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      <div className="rounded-md border" aria-busy={list.isFetching}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Card #</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>In Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!list.isLoading && !list.isError && jobCards.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No job cards match your filters.
                </TableCell>
              </TableRow>
            )}
            {jobCards.map((jc) => (
              <TableRow
                key={jc.id}
                className="cursor-pointer hover:bg-muted/40"
              >
                <TableCell className="font-medium text-primary hover:underline">
                  <Link
                    href={`/workshop/job-cards/${jc.id}`}
                    className="hover:underline"
                  >
                    {jc.jobCardNumber ?? "—"}
                  </Link>
                </TableCell>
                <TableCell>{jc.vehicle.vehicleNumber}</TableCell>
                <TableCell>{jc.driver.name}</TableCell>
                <TableCell>
                  {new Date(jc.inDateTime).toLocaleDateString("en-IN")}
                </TableCell>
                <TableCell>
                  <JobCardStatusBadge status={jc.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(jc.totalAmountPaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {list.data && (
          <TablePaginationFooter
            total={total}
            page={page}
            size={size}
            onPageChange={setPage}
            onSizeChange={setSize}
          />
        )}
      </div>
    </div>
  );
}
