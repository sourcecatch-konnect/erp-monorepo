"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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

import { useCan } from "@/features/auth";
import { formatPaise } from "@/lib/money";
import { jobCardApi, type JobCardStatus } from "./api/job-card.service";
import { jobCardKeys } from "./api/job-card.keys";

const STATUS_STYLE: Record<JobCardStatus, string> = {
  DRAFT: "border-muted-foreground/30 bg-muted text-muted-foreground",
  FINALISED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CANCELLED: "border-destructive/20 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: JobCardStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

export function JobCardListPage() {
  const canManage = useCan(PERMS.WORKSHOP.JOBCARD_MANAGE);
  const list = useQuery({ queryKey: jobCardKeys.list(), queryFn: () => jobCardApi.list() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Job Cards</h1>
          <p className="text-sm text-muted-foreground">
            A truck&apos;s workshop visit. Save keeps it a draft — parts only leave stock and
            post to accounts once you Finalise.
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

      <div className="rounded-md border">
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
            {!list.isLoading && (list.data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No job cards yet.
                </TableCell>
              </TableRow>
            )}
            {list.data?.map((jc) => (
              <TableRow key={jc.id} className="cursor-pointer hover:bg-muted/40">
                <TableCell className="font-medium">
                  <Link href={`/workshop/job-cards/${jc.id}`} className="hover:underline">
                    {jc.jobCardNumber ?? "—"}
                  </Link>
                </TableCell>
                <TableCell>{jc.vehicle.vehicleNumber}</TableCell>
                <TableCell>{jc.driver.name}</TableCell>
                <TableCell>{new Date(jc.inDateTime).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>
                  <StatusBadge status={jc.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(jc.totalAmountPaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
