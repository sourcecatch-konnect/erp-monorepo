"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconCheck,
  IconPlayerPause,
  IconX,
  IconTrash,
  IconPlus,
  IconSparkles,
  IconGripVertical,
  IconBolt,
  IconInbox,
} from "@tabler/icons-react";

import type {
  CashPlanDayView,
  CashPaymentWithCreditor,
  CreateCashPaymentBody,
  Creditor,
  PaymentStatus,
  CashSegment,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { Input } from "@skerp/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@skerp/ui/components/select";
import { formatPaise, formatPaiseCompact } from "@/lib/money";

import { cashPlanningApi } from "./cash-planning.service";
import { cashPlanningKeys } from "./cash-planning.keys";
import { CompactMoney } from "./CompactMoney";
import { creditorApi } from "../masters/creditor/creditor.service";
import { creditorKeys } from "../masters/creditor/creditor.keys";

type Props = {
  day: CashPlanDayView;
  date: string;
  canEnter: boolean;
  canApprove: boolean;
};

const CATEGORIES = ["DIESEL", "RENT", "FREIGHT", "EXPENSE", "REPAIR", "OTHER"] as const;
const MODES = ["CASH", "BANK", "UPI", "CHEQUE"] as const;
const SEGMENTS: CashSegment[] = ["ROAD", "RAIL", "FCI"];
const NO_SEGMENT = "NONE";

const labelOf = (v: string) =>
  v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const statusBadge: Record<PaymentStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  APPROVED: "bg-emerald-100 text-emerald-700",
  HOLD: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700 line-through",
};

const segmentBadge: Record<CashSegment, string> = {
  ROAD: "bg-slate-100 text-slate-700",
  RAIL: "bg-indigo-100 text-indigo-700",
  FCI: "bg-teal-100 text-teal-700",
};

const fieldLabel = "text-xs font-medium text-muted-foreground";

export default function PaymentQueue({ day, date, canEnter, canApprove }: Props) {
  const queryClient = useQueryClient();
  const editable = canEnter && day.status === "OPEN";
  const approvable = canApprove && day.status === "OPEN";

  const setDay = (view: CashPlanDayView) =>
    queryClient.setQueryData(cashPlanningKeys.day(date), view);

  // ── fast-entry state ──
  const [payeeName, setPayeeName] = React.useState("");
  const [creditorId, setCreditorId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number]>("OTHER");
  const [mode, setMode] = React.useState<(typeof MODES)[number]>("CASH");
  const [segment, setSegment] = React.useState<CashSegment | "">("");

  const { data: creditorData } = useQuery({
    queryKey: creditorKeys.list({ page: 0, size: 200, sort: "name:asc" }),
    queryFn: () => creditorApi.list({ page: 0, size: 200, sort: "name:asc" }),
  });
  const creditors: Creditor[] = creditorData?.data ?? [];

  const applyCreditor = (c: Creditor) => {
    setCreditorId(c.id);
    setPayeeName(c.name);
    setCategory(c.category);
    if (c.defaultMode) setMode(c.defaultMode);
    // Prefill amount with the outstanding balance if any.
    if (c.outstandingBalance > 0 && !amount) {
      setAmount((c.outstandingBalance / 100).toFixed(2));
    }
  };

  const resetForm = () => {
    setPayeeName("");
    setCreditorId("");
    setAmount("");
    setCategory("OTHER");
    setMode("CASH");
    setSegment("");
  };

  const add = useMutation({
    mutationFn: () => {
      const body: CreateCashPaymentBody = {
        payeeName: payeeName.trim(),
        amount: Math.round(Number(amount) * 100),
        category,
        mode,
        segment: segment || undefined,
        creditorId: creditorId || undefined,
        branchId:
          creditors.find((c) => c.id === creditorId)?.branchId ?? undefined,
        fromAccountId: undefined,
        projectCode: undefined,
        note: undefined,
      };
      return cashPlanningApi.addPayment(day.id, body);
    },
    onSuccess: ({ day: view }) => {
      setDay(view);
      resetForm();
      payeeRef.current?.focus();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: PaymentStatus }) =>
      cashPlanningApi.setStatus(id, next),
    onSuccess: (view) => setDay(view),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cashPlanningApi.deletePayment(id),
    onSuccess: (view) => setDay(view),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      cashPlanningApi.reorder(day.id, orderedIds),
    onSuccess: (view) => setDay(view),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Reorder failed"),
  });

  const approveAllThatFit = useMutation({
    mutationFn: async (ids: string[]) => {
      let view: CashPlanDayView = day;
      for (const id of ids) view = await cashPlanningApi.setStatus(id, "APPROVED");
      return view;
    },
    onSuccess: (view) => {
      setDay(view);
      toast.success("Approved all payments that fit available cash");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk approve failed"),
  });

  const payeeRef = React.useRef<HTMLInputElement>(null);
  const canSubmit = payeeName.trim().length > 0 && Number(amount) > 0 && !add.isPending;

  // ── waterline computation (top-down running total vs available opening) ──
  const computed = React.useMemo(() => {
    let cum = 0;
    return day.payments.map((p) => {
      const consumes = p.status !== "REJECTED" && p.status !== "HOLD";
      if (consumes) cum += p.amount;
      return { p, remainingAfter: day.totalOpening - cum, fits: cum <= day.totalOpening, consumes };
    });
  }, [day.payments, day.totalOpening]);

  const waterlineIndex = computed.findIndex((c) => c.consumes && !c.fits);
  const pendingThatFit = computed
    .filter((c, i) => c.p.status === "PENDING" && (waterlineIndex === -1 || i < waterlineIndex))
    .map((c) => c.p.id);

  // ── drag reorder ──
  const [dragId, setDragId] = React.useState<string | null>(null);
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return setDragId(null);
    const ids = day.payments.map((p) => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    setDragId(null);
    reorder.mutate(ids);
  };

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          Payment Queue
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            priority order — drag to reprioritise
          </span>
        </h2>
        {approvable && pendingThatFit.length > 0 ? (
          <Button
            size="sm"
            onClick={() => approveAllThatFit.mutate(pendingThatFit)}
            disabled={approveAllThatFit.isPending}
          >
            <IconBolt size={14} className="mr-1" />
            Approve all that fit ({pendingThatFit.length})
          </Button>
        ) : null}
      </div>

      {/* fast-entry row */}
      {editable ? (
        <div className="flex flex-wrap items-end gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="grid gap-1">
            <label className={fieldLabel}>Payee</label>
            <Input
              ref={payeeRef}
              list="creditor-suggestions"
              className="h-9 w-48"
              placeholder="Type payee…"
              value={payeeName}
              onChange={(e) => {
                const v = e.target.value;
                setPayeeName(v);
                const match = creditors.find((c) => c.name === v);
                if (match) applyCreditor(match);
                else setCreditorId("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) add.mutate();
              }}
            />
            <datalist id="creditor-suggestions">
              {creditors.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.outstandingBalance > 0
                    ? `outstanding ${formatPaiseCompact(c.outstandingBalance)}`
                    : ""}
                </option>
              ))}
            </datalist>
          </div>

          <div className="grid gap-1">
            <label className={fieldLabel}>Amount (₹)</label>
            <Input
              type="number"
              step="0.01"
              className="h-9 w-28 text-right"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) add.mutate();
              }}
            />
          </div>

          <div className="grid gap-1">
            <label className={fieldLabel}>Category</label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as typeof category)}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {labelOf(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <label className={fieldLabel}>Mode</label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {labelOf(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <label className={fieldLabel}>Segment</label>
            <Select
              value={segment === "" ? NO_SEGMENT : segment}
              onValueChange={(v) =>
                setSegment(v === NO_SEGMENT ? "" : (v as CashSegment))
              }
            >
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SEGMENT}>—</SelectItem>
                {SEGMENTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {labelOf(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => add.mutate()} disabled={!canSubmit}>
            <IconPlus size={15} className="mr-1" />
            Add payment
          </Button>
        </div>
      ) : null}

      {/* rows */}
      <div className="divide-y">
        {day.payments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
            <IconInbox size={26} className="text-muted-foreground/70" />
            No payments queued yet.{editable ? " Add one above to begin." : ""}
          </div>
        ) : (
          computed.map(({ p, remainingAfter, fits }, index) => (
            <React.Fragment key={p.id}>
              {index === waterlineIndex ? (
                <div className="flex items-center gap-2 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-600">
                  <span className="h-px flex-1 bg-red-300" />
                  cash runs out here — below this exceeds available cash
                  <span className="h-px flex-1 bg-red-300" />
                </div>
              ) : null}

              <div
                draggable={editable}
                onDragStart={() => setDragId(p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(p.id)}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  dragId === p.id ? "opacity-50" : ""
                } ${!fits ? "bg-red-50/40" : ""}`}
              >
                {editable ? (
                  <IconGripVertical
                    size={15}
                    className="shrink-0 cursor-grab text-muted-foreground/50"
                  />
                ) : null}
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                  {index + 1}
                </span>

                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {p.payeeName.charAt(0).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{p.payeeName}</span>
                    {p.isLate ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
                        <IconSparkles size={11} /> new
                      </span>
                    ) : null}
                    {p.segment ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${segmentBadge[p.segment]}`}
                      >
                        {p.segment}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {labelOf(p.category)} · {labelOf(p.mode)}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <CompactMoney
                    className="text-sm font-semibold"
                    value={p.amount}
                  />
                  <div
                    className={`text-[11px] ${
                      remainingAfter < 0 ? "text-red-600" : "text-muted-foreground"
                    }`}
                    title={formatPaise(Math.abs(remainingAfter))}
                  >
                    {remainingAfter < 0
                      ? `over by ${formatPaiseCompact(-remainingAfter)}`
                      : `${formatPaiseCompact(remainingAfter)} left`}
                  </div>
                </div>

                <span
                  className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusBadge[p.status]}`}
                >
                  {labelOf(p.status)}
                </span>

                <div className="flex shrink-0 items-center gap-0.5">
                  {approvable ? (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Approve"
                        className="text-emerald-600 hover:bg-emerald-50"
                        disabled={status.isPending || p.status === "APPROVED"}
                        onClick={() => status.mutate({ id: p.id, next: "APPROVED" })}
                      >
                        <IconCheck size={15} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Hold"
                        className="text-amber-600 hover:bg-amber-50"
                        disabled={status.isPending || p.status === "HOLD"}
                        onClick={() => status.mutate({ id: p.id, next: "HOLD" })}
                      >
                        <IconPlayerPause size={15} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Reject"
                        className="text-red-600 hover:bg-red-50"
                        disabled={status.isPending || p.status === "REJECTED"}
                        onClick={() => status.mutate({ id: p.id, next: "REJECTED" })}
                      >
                        <IconX size={15} />
                      </Button>
                    </>
                  ) : null}
                  {editable ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Delete"
                      className="text-muted-foreground hover:bg-muted"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(p.id)}
                    >
                      <IconTrash size={15} />
                    </Button>
                  ) : null}
                </div>
              </div>
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}
