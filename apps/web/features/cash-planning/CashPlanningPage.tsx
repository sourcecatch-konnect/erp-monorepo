"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconLock,
  IconPlus,
  IconFileText,
  IconWallet,
  IconCalendarPlus,
  IconListCheck,
  IconReceipt2,
  IconCoins,
} from "@tabler/icons-react";

import type { CashPlanDayView } from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { DatePicker } from "@skerp/ui/components/datepicker";
import { TooltipProvider } from "@skerp/ui/components/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@skerp/ui/components/tabs";
import { useCan } from "@/features/auth";

import { cashPlanningApi } from "./api/cash-planning.service";
import { cashPlanningKeys } from "./api/cash-planning.keys";
import CashPositionPanel from "./queue/CashPositionPanel";
import PaymentQueue from "./queue/PaymentQueue";
import CreditorLedgerView from "./ledger/CreditorLedgerView";
import ReceivablesPanel from "./receivables/ReceivablesPanel";
import {
  CashPositionSkeleton,
  PaymentQueueSkeleton,
} from "./components/CashPlanningSkeletons";

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Local-date YYYY-MM-DD (avoids the UTC shift from toISOString). */
const toIsoDate = (d: Date): string => {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

function TabCount({ n }: { n: number }) {
  return (
    <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[11px] font-medium text-foreground/70">
      {n}
    </span>
  );
}

export default function CashPlanningPage() {
  const queryClient = useQueryClient();
  const canEnter = useCan(PERMS.CASH_PLANNING.ENTER);
  const canApprove = useCan(PERMS.CASH_PLANNING.APPROVE);
  const canClose = useCan(PERMS.CASH_PLANNING.CLOSE);

  const router = useRouter();
  const [date, setDate] = React.useState(todayIso());

  const dayQuery = useQuery({
    queryKey: cashPlanningKeys.day(date),
    queryFn: () => cashPlanningApi.getDay(date),
  });

  // Global receivables — used here for the Receivables tab count badge.
  const receivablesQuery = useQuery({
    queryKey: cashPlanningKeys.receivables(),
    queryFn: () => cashPlanningApi.listReceivables(),
  });

  const openDay = useMutation({
    mutationFn: () => cashPlanningApi.openDay(date),
    onSuccess: (view) => {
      queryClient.setQueryData(cashPlanningKeys.day(date), view);
      toast.success("Day opened");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to open day"),
  });

  const closeDay = useMutation({
    mutationFn: (dayId: string) => cashPlanningApi.closeDay(dayId),
    onSuccess: (view) => {
      queryClient.setQueryData(cashPlanningKeys.day(date), view);
      toast.success("Day closed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to close day"),
  });

  const day: CashPlanDayView | null | undefined = dayQuery.data;
  const openReceivables =
    receivablesQuery.data?.receivables.filter((r) => !r.ackReceived).length ?? 0;

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconWallet size={20} />
            </span>
            <div className="space-y-0.5">
              <h1 className="text-xl font-semibold tracking-tight">
                Cash Planning
              </h1>
              <p className="text-sm text-muted-foreground">
                Daily cash position, priority payment queue and stakeholder
                approvals
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <DatePicker
                selected={new Date(`${date}T00:00:00`)}
                onSelect={(d) => d && setDate(toIsoDate(d))}
                clearable={false}
              />
            </div>

            {day ? (
              <span
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${day.status === "CLOSED"
                  ? "bg-muted text-muted-foreground"
                  : "bg-emerald-100 text-emerald-700"
                  }`}
              >
                <span
                  className={`size-1.5 rounded-full ${day.status === "CLOSED" ? "bg-muted-foreground" : "bg-emerald-500"
                    }`}
                />
                {day.status === "CLOSED" ? "Closed" : "Open"}
              </span>
            ) : null}

            {day ? (
              <Button
                variant="outline"
                onClick={() => router.push(`/cash-planning/report/${date}`)}
              >
                <IconFileText size={15} className="mr-1" />
                Day report
              </Button>
            ) : null}
            {day && day.status === "OPEN" && canClose ? (
              <Button
                variant="outline"
                onClick={() => closeDay.mutate(day.id)}
                disabled={closeDay.isPending}
              >
                <IconLock size={15} className="mr-1" />
                {closeDay.isPending ? "Closing…" : "Close day"}
              </Button>
            ) : null}
          </div>
        </div>

        {dayQuery.isLoading ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
            <CashPositionSkeleton />
            <PaymentQueueSkeleton />
          </div>
        ) : !day ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <IconCalendarPlus size={24} />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">No cash plan for this day</p>
              <p className="text-xs text-muted-foreground">
                Open the day to carry forward balances and start the queue.
              </p>
            </div>
            {canEnter ? (
              <Button onClick={() => openDay.mutate()} disabled={openDay.isPending}>
                <IconPlus size={15} className="mr-1" />
                {openDay.isPending ? "Opening…" : "Open this day"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                You don&apos;t have permission to open a day.
              </p>
            )}
          </div>
        ) : (
          <Tabs defaultValue="queue" className="space-y-4">
            <TabsList>
              <TabsTrigger value="queue" className="gap-1.5">
                <IconListCheck size={15} />
                Payment Queue
                <TabCount n={day.payments.length} />
              </TabsTrigger>
              <TabsTrigger value="ledger" className="gap-1.5">
                <IconReceipt2 size={15} />
                Creditor Ledger
              </TabsTrigger>
              <TabsTrigger value="receivables" className="gap-1.5">
                <IconCoins size={15} />
                Receivables
                <TabCount n={openReceivables} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="queue">
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="min-w-0">
                  <CashPositionPanel day={day} date={date} canEnter={canEnter} />
                </div>

                <div className="min-w-0">
                  <PaymentQueue
                    day={day}
                    date={date}
                    canEnter={canEnter}
                    canApprove={canApprove}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ledger">
              <CreditorLedgerView />
            </TabsContent>

            <TabsContent value="receivables">
              <ReceivablesPanel day={day} date={date} canEnter={canEnter} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </TooltipProvider>
  );
}
