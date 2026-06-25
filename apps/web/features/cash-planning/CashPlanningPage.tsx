"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconCalendar, IconLock, IconPlus } from "@tabler/icons-react";

import type { CashPlanDayView } from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@skerp/ui/components/tabs";
import { useCan } from "@/features/auth";
import { formatPaise } from "@/lib/money";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";
import CashPositionPanel from "./CashPositionPanel";
import PaymentQueue from "./PaymentQueue";
import CreditorLedgerView from "./CreditorLedgerView";
import ReceivablesPanel from "./ReceivablesPanel";

const todayIso = () => new Date().toISOString().slice(0, 10);

function HeaderStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm font-semibold ${
          tone === "bad"
            ? "text-destructive"
            : tone === "ok"
              ? "text-emerald-600"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function CashPlanningPage() {
  const queryClient = useQueryClient();
  const canEnter = useCan(PERMS.CASH_PLANNING.ENTER);
  const canApprove = useCan(PERMS.CASH_PLANNING.APPROVE);
  const canClose = useCan(PERMS.CASH_PLANNING.CLOSE);

  const [date, setDate] = React.useState(todayIso());

  const dayQuery = useQuery({
    queryKey: cashPlanningKeys.day(date),
    queryFn: () => cashPlanningApi.getDay(date),
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Cash Planning</h1>
          <p className="text-sm text-muted-foreground">
            Daily cash position, priority payment queue and stakeholder approvals
          </p>
        </div>

        <div className="flex items-end gap-3">
          {day ? (
            <div className="flex gap-2">
              <HeaderStat label="Available" value={formatPaise(day.availableCash)} tone={day.availableCash < 0 ? "bad" : "ok"} />
              <HeaderStat label="Pending" value={formatPaise(day.pendingTotal)} />
              <HeaderStat label="Projected" value={formatPaise(day.projectedCash)} />
            </div>
          ) : null}

          <div className="relative">
            <IconCalendar
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-card pl-8 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

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
          {day && day.status === "CLOSED" ? (
            <span className="inline-flex h-9 items-center rounded-md bg-muted px-3 text-xs font-medium text-muted-foreground">
              Closed
            </span>
          ) : null}
        </div>
      </div>

      {dayQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-md" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      ) : !day ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">No cash plan for {date}.</p>
          {canEnter ? (
            <Button onClick={() => openDay.mutate()} disabled={openDay.isPending}>
              <IconPlus size={15} className="mr-1" />
              {openDay.isPending ? "Opening…" : "Open this day"}
            </Button>
          ) : null}
        </div>
      ) : (
        <Tabs defaultValue="queue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queue">Payment Queue</TabsTrigger>
            <TabsTrigger value="ledger">Creditor Ledger</TabsTrigger>
            <TabsTrigger value="receivables">Receivables</TabsTrigger>
          </TabsList>

          <TabsContent value="queue">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
              <CashPositionPanel day={day} date={date} canEnter={canEnter} />
              <PaymentQueue
                day={day}
                date={date}
                canEnter={canEnter}
                canApprove={canApprove}
              />
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
  );
}
