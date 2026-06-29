"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";

import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";

import { cashPlanningApi } from "../api/cash-planning.service";
import { cashPlanningKeys } from "../api/cash-planning.keys";
import {
  CashPlanningA4Report,
  CashPlanningQueueA4Report,
} from "./CashPlanningA4Report";
import { DayCloseReport } from "./DayCloseReport";

type ReportType = "a5" | "a4" | "a4Queue";

const reportOptions: { value: ReportType; label: string }[] = [
  { value: "a5", label: "Day Close" },
  { value: "a4", label: "Full Ledger" },
  { value: "a4Queue", label: "Queue Only" },
];

export default function CashPlanningReportPage({ date }: { date: string }) {
  const router = useRouter();
  const [reportType, setReportType] = React.useState<ReportType>("a5");

  const dayQuery = useQuery({
    queryKey: cashPlanningKeys.day(date),
    queryFn: () => cashPlanningApi.getDay(date),
  });
  const day = dayQuery.data;

  const ledgerQuery = useQuery({
    queryKey: cashPlanningKeys.ledger(),
    queryFn: () => cashPlanningApi.ledger(),
    enabled: reportType === "a4" && !!day,
  });

  const receivablesQuery = useQuery({
    queryKey: cashPlanningKeys.receivables(),
    queryFn: () => cashPlanningApi.listReceivables(),
    enabled: reportType === "a4" && !!day,
  });

  const a4Loading =
    reportType === "a4" &&
    (ledgerQuery.isLoading || receivablesQuery.isLoading);
  const a4Error =
    reportType === "a4" && (ledgerQuery.isError || receivablesQuery.isError);
  const canPrint =
    !!day &&
    (reportType === "a5" ||
      reportType === "a4Queue" ||
      (!!ledgerQuery.data &&
        !!receivablesQuery.data &&
        !a4Loading &&
        !a4Error));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/cash-planning")}
        >
          <IconArrowLeft size={15} className="mr-1" />
          Back to Cash Planning
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {day ? (
            <div className="flex rounded-md border bg-background p-0.5">
              {reportOptions.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={reportType === option.value ? "default" : "ghost"}
                  className="h-8"
                  onClick={() => setReportType(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          ) : null}
          {day ? (
            <Button
              size="sm"
              onClick={() => window.print()}
              disabled={!canPrint}
            >
              <IconPrinter size={15} className="mr-1" />
              Print / Save PDF
            </Button>
          ) : null}
        </div>
      </div>

      {dayQuery.isLoading ? (
        <Skeleton className="mx-auto h-[600px] w-[148mm] max-w-full rounded-md" />
      ) : !day ? (
        <div className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          No cash plan for {date}.
        </div>
      ) : a4Loading ? (
        <Skeleton className="mx-auto h-[900px] w-[210mm] max-w-full rounded-md" />
      ) : a4Error ? (
        <div className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">
          Could not load ledger and receivable data for the A4 report.
        </div>
      ) : reportType === "a4" && ledgerQuery.data && receivablesQuery.data ? (
        <div className="rounded-md bg-muted/40 p-5 print:bg-transparent print:p-0">
          <CashPlanningA4Report
            day={day}
            ledger={ledgerQuery.data}
            receivables={receivablesQuery.data}
            reportDate={date}
          />
        </div>
      ) : reportType === "a4Queue" ? (
        <div className="rounded-md bg-muted/40 p-5 print:bg-transparent print:p-0">
          <CashPlanningQueueA4Report day={day} reportDate={date} />
        </div>
      ) : (
        <div className="rounded-md bg-muted/40 p-5 print:bg-transparent print:p-0">
          <DayCloseReport day={day} />
        </div>
      )}
    </div>
  );
}
