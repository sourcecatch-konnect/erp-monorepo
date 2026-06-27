"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";
import { DayCloseReport } from "./DayCloseReport";

export default function CashPlanningReportPage({ date }: { date: string }) {
  const router = useRouter();

  const dayQuery = useQuery({
    queryKey: cashPlanningKeys.day(date),
    queryFn: () => cashPlanningApi.getDay(date),
  });
  const day = dayQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/cash-planning")}
        >
          <IconArrowLeft size={15} className="mr-1" />
          Back to Cash Planning
        </Button>
        {day ? (
          <Button size="sm" onClick={() => window.print()}>
            <IconPrinter size={15} className="mr-1" />
            Print / Save PDF
          </Button>
        ) : null}
      </div>

      {dayQuery.isLoading ? (
        <Skeleton className="mx-auto h-[600px] w-[148mm] max-w-full rounded-md" />
      ) : !day ? (
        <div className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          No cash plan for {date}.
        </div>
      ) : (
        <div className="rounded-md bg-muted/40 p-5 print:bg-transparent print:p-0">
          <DayCloseReport day={day} />
        </div>
      )}
    </div>
  );
}
