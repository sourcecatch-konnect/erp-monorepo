"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { JourneyLeg, TripExpense, DriverAdvance } from "@skerp/types";
import { PERMS } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Skeleton } from "@skerp/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skerp/ui/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@skerp/ui/components/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skerp/ui/components/dropdown";
import {
  IconPlus,
  IconDotsVertical,
  IconTruckDelivery,
  IconCircleCheck,
  IconBan,
  IconReceipt2,
  IconCash,
  IconFileInvoice,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";

import { useCan } from "@/features/auth";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import ReasonDialog from "@/components/feedback/ReasonDialog";
import { formatPaise } from "@/lib/money";
import getErrorMessage from "../masters/_shared/hooks/useMasterMutation";

import { journeyApi, expenseApi, advanceApi } from "./journey.service";
import { journeyKeys } from "./journey.keys";
import {
  JourneyStatusBadge,
  LegStatusBadge,
  ExpenseStatusBadge,
  SETTLEMENT_LABELS,
  LEG_TYPE_LABELS,
  formatDateTime,
} from "./journey-ui";
import JourneyTimeline from "./JourneyTimeline";
import CloseLegDialog from "./CloseLegDialog";
import TripExpenseDrawer from "./TripExpenseDrawer";
import AdvanceDialog from "./AdvanceDialog";

export default function VehicleJourneyDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const [closeLeg, setCloseLeg] = React.useState<JourneyLeg | null>(null);
  const [dispatchLeg, setDispatchLeg] = React.useState<JourneyLeg | null>(null);
  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [editExpense, setEditExpense] = React.useState<TripExpense | null>(null);
  const [advanceOpen, setAdvanceOpen] = React.useState(false);
  const [markReadyOpen, setMarkReadyOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [forceCloseOpen, setForceCloseOpen] = React.useState(false);
  const [rejectExpense, setRejectExpense] = React.useState<TripExpense | null>(null);
  const [reverseExpense, setReverseExpense] = React.useState<TripExpense | null>(null);
  const [deleteExpense, setDeleteExpense] = React.useState<TripExpense | null>(null);
  const [reverseAdvance, setReverseAdvance] = React.useState<DriverAdvance | null>(null);

  const canUpdate = useCan(PERMS.VEHICLE_JOURNEY.UPDATE);
  const canClose = useCan(PERMS.VEHICLE_JOURNEY.CLOSE);
  const canCancel = useCan(PERMS.VEHICLE_JOURNEY.CANCEL);
  const canExpense = useCan(PERMS.TRIP_EXPENSE.CREATE);
  const canApproveExpense = useCan(PERMS.TRIP_EXPENSE.APPROVE);
  const canReverseExpense = useCan(PERMS.TRIP_EXPENSE.REVERSE);
  const canAdvance = useCan(PERMS.TRIP_ADVANCE.CREATE);
  const canReverseAdvance = useCan(PERMS.TRIP_ADVANCE.REVERSE);
  const canViewLogSlip = useCan(PERMS.LOGSLIP.VIEW);

  const query = useQuery({
    queryKey: journeyKeys.detail(id),
    queryFn: () => journeyApi.detail(id),
  });
  const journey = query.data;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: journeyKeys.all });

  const dispatch = useMutation({
    mutationFn: (tripId: string) => journeyApi.dispatchLeg(id, tripId),
    onSuccess: () => {
      toast.success("Leg dispatched");
      setDispatchLeg(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const markReady = useMutation({
    mutationFn: () => journeyApi.markReady(id),
    onSuccess: () => {
      toast.success("Journey is ready for log slip");
      setMarkReadyOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => journeyApi.cancel(id, { reason }),
    onSuccess: () => {
      toast.success("Journey cancelled");
      setCancelOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const forceClose = useMutation({
    mutationFn: (reason: string) => journeyApi.forceClose(id, { reason }),
    onSuccess: () => {
      toast.success("Journey closed away from base");
      setForceCloseOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const expenseAction = useMutation({
    mutationFn: async (vars: {
      action: "approve" | "reject" | "reverse" | "delete";
      expense: TripExpense;
      reason?: string;
    }) => {
      if (vars.action === "approve") return expenseApi.approve(vars.expense.id);
      if (vars.action === "reject")
        return expenseApi.reject(vars.expense.id, vars.reason!);
      if (vars.action === "reverse")
        return expenseApi.reverse(vars.expense.id, vars.reason!);
      return expenseApi.delete(vars.expense.id);
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.action === "approve"
          ? "Expense approved"
          : vars.action === "reject"
            ? "Expense rejected"
            : vars.action === "reverse"
              ? "Expense reversed"
              : "Expense deleted",
      );
      setRejectExpense(null);
      setReverseExpense(null);
      setDeleteExpense(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const advanceReverse = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      advanceApi.reverse(vars.id, vars.reason),
    onSuccess: () => {
      toast.success("Advance reversed");
      setReverseAdvance(null);
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (query.isLoading || !journey) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const legs = journey.trips ?? [];
  const activeLegs = legs.filter((l) => l.status !== "Cancelled");
  const lastLeg = activeLegs[activeLegs.length - 1] ?? null;
  const totals = journey.totals;

  // The next leg is created from the Trips page ("New Trip" auto-attaches
  // to this journey) — the journey page only visualises and settles.
  const nextLegReady =
    journey.status === "ACTIVE" && lastLeg?.status === "Closed";
  const canMarkReady = canUpdate && journey.status === "RETURNED";
  const moneyEntryAllowed = ["ACTIVE", "RETURNED"].includes(journey.status);
  const showLogSlipLink =
    canViewLogSlip &&
    ["RETURNED", "READY_FOR_LOGSLIP", "SETTLED"].includes(journey.status);

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">
                {journey.journeyNumber}
              </h1>
              <JourneyStatusBadge status={journey.status} />
              <span className="text-xs text-muted-foreground">
                {SETTLEMENT_LABELS[journey.settlementStatus]}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {journey.vehicle?.vehicleNumber} · {journey.driver?.name} · from{" "}
              {journey.startCity?.name} · returns at {journey.returnCity?.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Started {formatDateTime(journey.startedAt)}
              {journey.closedAt
                ? ` · Returned ${formatDateTime(journey.closedAt)}`
                : ""}{" "}
              · KM {journey.openingKm}
              {journey.closingKm !== null ? ` → ${journey.closingKm}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {nextLegReady ? (
              <Button asChild>
                <Link href="/trips/new">
                  <IconPlus size={16} className="mr-1" /> New Trip (next leg)
                </Link>
              </Button>
            ) : null}
            {canMarkReady ? (
              <Button onClick={() => setMarkReadyOpen(true)}>
                <IconCircleCheck size={16} className="mr-1" /> Mark Ready for
                Log Slip
              </Button>
            ) : null}
            {showLogSlipLink ? (
              <Button
                variant={canMarkReady ? "outline" : "default"}
                asChild
              >
                <Link href={`/vehicle-journeys/${journey.id}/log-slip`}>
                  <IconFileInvoice size={16} className="mr-1" /> Log Slip
                </Link>
              </Button>
            ) : null}
            {(canClose && journey.status === "ACTIVE") ||
            (canCancel && journey.status === "ACTIVE") ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline" aria-label="More">
                    <IconDotsVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canClose && journey.status === "ACTIVE" ? (
                    <DropdownMenuItem onClick={() => setForceCloseOpen(true)}>
                      <IconCircleCheck size={16} className="mr-2" /> Close away
                      from base
                    </DropdownMenuItem>
                  ) : null}
                  {canCancel && journey.status === "ACTIVE" ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setCancelOpen(true)}
                      >
                        <IconBan size={16} className="mr-2" /> Cancel journey
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <JourneyTimeline journey={journey} />

      {/* Running totals */}
      {totals ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Freight", value: formatPaise(totals.totalFreightPaise) },
            { label: "Advances", value: formatPaise(totals.totalAdvancePaise) },
            {
              label: `Diesel (${totals.totalDieselQty.toLocaleString("en-IN")} L)`,
              value: formatPaise(totals.totalDieselAmountPaise),
            },
            {
              label: "Cash expenses",
              value: formatPaise(totals.totalCashExpensePaise),
            },
            {
              label: "Credit expenses",
              value: formatPaise(totals.totalCreditExpensePaise),
            },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {totals && totals.unapprovedExpenseCount > 0 ? (
        <p className="text-xs text-amber-700">
          {totals.unapprovedExpenseCount} expense(s) awaiting approval.
        </p>
      ) : null}

      {/* Tabs */}
      <Tabs defaultValue="legs">
        <TabsList>
          <TabsTrigger value="legs">Legs ({activeLegs.length})</TabsTrigger>
          <TabsTrigger value="expenses">
            Expenses ({(journey.expenses ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="advances">
            Advances ({(journey.advances ?? []).length})
          </TabsTrigger>
        </TabsList>

        {/* ---- Legs ---- */}
        <TabsContent value="legs" className="mt-3">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {["#", "Route", "Type", "Freight", "KM", "Start", "End", "Status", ""].map(
                    (h) => (
                      <TableHead
                        key={h}
                        className="h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground"
                      >
                        {h}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {legs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      No legs yet
                    </TableCell>
                  </TableRow>
                ) : (
                  legs.map((leg) => (
                    <TableRow key={leg.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm">{leg.sequenceNo}</TableCell>
                      <TableCell className="text-sm">
                        <Link
                          href={`/trips/${leg.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {leg.fromCity?.name ?? "?"} → {leg.toCity?.name ?? "?"}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {leg.tripNumber}
                          {leg.consignor?.name ? ` · ${leg.consignor.name}` : ""}
                          {leg.chainExceptionReason ? " · chain exception" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {leg.legType ? LEG_TYPE_LABELS[leg.legType] : "—"}
                        {leg.isTripEmpty ? " (empty)" : ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatPaise(leg.onwardFreight)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {leg.openingKm}
                        {leg.closingKm !== null ? ` → ${leg.closingKm}` : ""}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(leg.startDateTime)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(leg.endDateTime)}
                      </TableCell>
                      <TableCell>
                        <LegStatusBadge status={leg.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {canUpdate && journey.status === "ACTIVE" ? (
                          leg.status === "Planned" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDispatchLeg(leg)}
                            >
                              <IconTruckDelivery size={14} className="mr-1" />
                              Dispatch
                            </Button>
                          ) : leg.status === "InTransit" ? (
                            <Button size="sm" onClick={() => setCloseLeg(leg)}>
                              <IconCircleCheck size={14} className="mr-1" />
                              Close
                            </Button>
                          ) : null
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ---- Expenses ---- */}
        <TabsContent value="expenses" className="mt-3 space-y-3">
          {canExpense && moneyEntryAllowed ? (
            <Button variant="outline" onClick={() => setExpenseOpen(true)}>
              <IconReceipt2 size={16} className="mr-1" /> Add Expense
            </Button>
          ) : null}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {["Date", "Type", "Leg", "Mode", "Qty", "Amount", "Status", ""].map((h) => (
                    <TableHead
                      key={h}
                      className="h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(journey.expenses ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No expenses recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  (journey.expenses ?? []).map((expense) => (
                    <TableRow key={expense.id} className="hover:bg-muted/30">
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(expense.expenseDate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {expense.expenseType}
                        <span className="block text-xs text-muted-foreground">
                          {expense.pump?.name ?? expense.city?.name ?? ""}
                          {expense.remarks ? ` · ${expense.remarks}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {expense.trip?.sequenceNo
                          ? `Leg ${expense.trip.sequenceNo}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {expense.paymentMode}
                        {expense.paidByDriver ? " · driver" : ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {expense.dieselQty
                          ? `${expense.dieselQty.toLocaleString("en-IN")} L`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatPaise(expense.amountPaise)}
                      </TableCell>
                      <TableCell>
                        <ExpenseStatusBadge status={expense.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canApproveExpense && expense.status === "DRAFT" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  expenseAction.mutate({
                                    action: "approve",
                                    expense,
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRejectExpense(expense)}
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                          {canExpense &&
                          expense.status === "DRAFT" &&
                          moneyEntryAllowed ? (
                            <>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Edit expense"
                                onClick={() => {
                                  setEditExpense(expense);
                                  setExpenseOpen(true);
                                }}
                              >
                                <IconEdit size={14} />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Delete expense"
                                onClick={() => setDeleteExpense(expense)}
                              >
                                <IconTrash size={14} />
                              </Button>
                            </>
                          ) : null}
                          {canReverseExpense &&
                          ["APPROVED", "POSTED"].includes(expense.status) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setReverseExpense(expense)}
                            >
                              Reverse
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ---- Advances ---- */}
        <TabsContent value="advances" className="mt-3 space-y-3">
          {canAdvance && moneyEntryAllowed ? (
            <Button variant="outline" onClick={() => setAdvanceOpen(true)}>
              <IconCash size={16} className="mr-1" /> Add Advance
            </Button>
          ) : null}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {["Paid at", "Mode", "Account", "Narration", "Amount", "Status", ""].map(
                    (h) => (
                      <TableHead
                        key={h}
                        className="h-10 whitespace-nowrap text-xs font-semibold uppercase text-muted-foreground"
                      >
                        {h}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(journey.advances ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No advances recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  (journey.advances ?? []).map((advance) => (
                    <TableRow key={advance.id} className="hover:bg-muted/30">
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateTime(advance.paidAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {advance.paymentMode}
                      </TableCell>
                      <TableCell className="text-xs">
                        {advance.cashAccount?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {advance.narration ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatPaise(advance.amountPaise)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {advance.status === "REVERSED" ? (
                          <span className="text-muted-foreground">
                            Reversed
                          </span>
                        ) : (
                          "Posted"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canReverseAdvance && advance.status === "POSTED" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setReverseAdvance(advance)}
                          >
                            Reverse
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CloseLegDialog
        open={Boolean(closeLeg)}
        onOpenChange={(open) => !open && setCloseLeg(null)}
        journey={journey}
        leg={closeLeg}
      />
      <TripExpenseDrawer
        open={expenseOpen}
        onOpenChange={(open) => {
          setExpenseOpen(open);
          if (!open) setEditExpense(null);
        }}
        journey={journey}
        expense={editExpense}
      />
      <AdvanceDialog
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
        journey={journey}
      />

      <ConfirmDialog
        open={Boolean(dispatchLeg)}
        onOpenChange={(open) => !open && setDispatchLeg(null)}
        title={`Dispatch leg ${dispatchLeg?.sequenceNo ?? ""}`}
        description="The leg moves to In Transit."
        confirmLabel="Dispatch"
        pendingLabel="Dispatching..."
        isPending={dispatch.isPending}
        onConfirm={() => {
          if (dispatchLeg) dispatch.mutate(dispatchLeg.id);
        }}
      />

      <ConfirmDialog
        open={markReadyOpen}
        onOpenChange={setMarkReadyOpen}
        title="Mark ready for log slip?"
        description="Confirms settlement review is complete: all legs closed, expenses approved or rejected, advances posted. Accounts can then generate the log slip."
        confirmLabel="Mark ready"
        pendingLabel="Marking..."
        isPending={markReady.isPending}
        onConfirm={() => markReady.mutate()}
      />

      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel journey ${journey.journeyNumber}`}
        description="Allowed only while no leg has been dispatched or closed."
        confirmLabel="Cancel journey"
        destructive
        isPending={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />

      <ReasonDialog
        open={forceCloseOpen}
        onOpenChange={setForceCloseOpen}
        title="Close journey away from base"
        description={`The vehicle has not returned to ${journey.returnCity?.name}. Give the reason for a non-base closure.`}
        confirmLabel="Close journey"
        isPending={forceClose.isPending}
        onConfirm={(reason) => forceClose.mutate(reason)}
      />

      <ReasonDialog
        open={Boolean(rejectExpense)}
        onOpenChange={(open) => !open && setRejectExpense(null)}
        title="Reject expense"
        description="The expense is excluded from the log slip."
        confirmLabel="Reject"
        destructive
        isPending={expenseAction.isPending}
        onConfirm={(reason) => {
          if (rejectExpense)
            expenseAction.mutate({ action: "reject", expense: rejectExpense, reason });
        }}
      />

      <ReasonDialog
        open={Boolean(reverseExpense)}
        onOpenChange={(open) => !open && setReverseExpense(null)}
        title="Reverse expense"
        description="Removes an approved expense from the settlement."
        confirmLabel="Reverse"
        destructive
        isPending={expenseAction.isPending}
        onConfirm={(reason) => {
          if (reverseExpense)
            expenseAction.mutate({ action: "reverse", expense: reverseExpense, reason });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteExpense)}
        onOpenChange={(open) => !open && setDeleteExpense(null)}
        title="Delete draft expense?"
        description="Only draft expenses can be deleted."
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        destructive
        isPending={expenseAction.isPending}
        onConfirm={() => {
          if (deleteExpense)
            expenseAction.mutate({ action: "delete", expense: deleteExpense });
        }}
      />

      <ReasonDialog
        open={Boolean(reverseAdvance)}
        onOpenChange={(open) => !open && setReverseAdvance(null)}
        title="Reverse advance"
        description="Removes the advance from the driver settlement."
        confirmLabel="Reverse"
        destructive
        isPending={advanceReverse.isPending}
        onConfirm={(reason) => {
          if (reverseAdvance)
            advanceReverse.mutate({ id: reverseAdvance.id, reason });
        }}
      />
    </div>
  );
}
