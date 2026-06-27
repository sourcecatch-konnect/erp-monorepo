"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus } from "@tabler/icons-react";

import type {
  CashPlanDayView,
  CashPaymentWithCreditor,
  CreateCashPaymentBody,
  Creditor,
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

import { cashPlanningApi } from "../api/cash-planning.service";
import { cashPlanningKeys } from "../api/cash-planning.keys";
import { recomputeDayView } from "../lib/cash-planning.compute";
import CreditorAutocomplete from "./CreditorAutocomplete";

const CATEGORIES = ["DIESEL", "RENT", "FREIGHT", "EXPENSE", "REPAIR", "OTHER"] as const;
const MODES = ["CASH", "BANK", "UPI", "CHEQUE"] as const;
const SEGMENTS: CashSegment[] = ["ROAD", "RAIL", "FCI"];
const NO_SEGMENT = "NONE";

const labelOf = (v: string) =>
  v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const fieldLabel = "text-xs font-medium text-muted-foreground";

/**
 * Fast-entry strip for adding a payment. Lives in its own component so the
 * keystroke-heavy input state re-renders only this small subtree — not the
 * PaymentQueue's DnD tree and payment rows. Creditor suggestions are searched
 * server-side and loaded on scroll (see CreditorAutocomplete) rather than
 * fetching the whole table up front.
 */
export default function PaymentEntryForm({
  day,
  date,
}: {
  day: CashPlanDayView;
  date: string;
}) {
  const queryClient = useQueryClient();
  const dayKey = cashPlanningKeys.day(date);

  const [payeeName, setPayeeName] = React.useState("");
  const [creditorId, setCreditorId] = React.useState("");
  const [creditorBranchId, setCreditorBranchId] = React.useState<string | undefined>();
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number]>("OTHER");
  const [mode, setMode] = React.useState<(typeof MODES)[number]>("CASH");
  const [segment, setSegment] = React.useState<CashSegment | "">("");
  const payeeRef = React.useRef<HTMLInputElement>(null);

  const applyCreditor = (c: Creditor) => {
    setCreditorId(c.id);
    setCreditorBranchId(c.branchId ?? undefined);
    setPayeeName(c.name);
    setCategory(c.category);
    if (c.defaultMode) setMode(c.defaultMode);
    if (c.outstandingBalance > 0 && !amount) {
      setAmount((c.outstandingBalance / 100).toFixed(2));
    }
  };

  const resetForm = () => {
    setPayeeName("");
    setCreditorId("");
    setCreditorBranchId(undefined);
    setAmount("");
    setCategory("OTHER");
    setMode("CASH");
    setSegment("");
  };

  const buildBody = (): CreateCashPaymentBody => ({
    payeeName: payeeName.trim(),
    amount: Math.round(Number(amount) * 100),
    category,
    mode,
    segment: segment || undefined,
    creditorId: creditorId || undefined,
    branchId: creditorBranchId,
    fromAccountId: undefined,
    projectCode: undefined,
    note: undefined,
  });

  // Re-hydrate the form from a body, e.g. to restore input after a failed add.
  const restoreForm = (body: CreateCashPaymentBody) => {
    setPayeeName(body.payeeName);
    setCreditorId(body.creditorId ?? "");
    setCreditorBranchId(body.branchId ?? undefined);
    setAmount((body.amount / 100).toString());
    setCategory(body.category);
    setMode(body.mode);
    setSegment((body.segment ?? "") as CashSegment | "");
  };

  const add = useMutation({
    mutationFn: (body: CreateCashPaymentBody) =>
      cashPlanningApi.addPayment(day.id, body),
    // Optimistically append the row + clear the form so fast-entry feels
    // instant; reconcile with the server's authoritative day on success.
    onMutate: (body) => {
      const prev = queryClient.getQueryData<CashPlanDayView>(dayKey);
      if (prev) {
        const temp: CashPaymentWithCreditor = {
          id: `temp-${Date.now()}`,
          dayId: day.id,
          creditorId: body.creditorId ?? null,
          payeeName: body.payeeName,
          amount: body.amount,
          category: body.category,
          mode: body.mode,
          segment: body.segment ?? null,
          projectCode: null,
          priority: prev.payments.reduce((m, p) => Math.max(m, p.priority), 0) + 1,
          branchId: body.branchId ?? null,
          fromAccountId: null,
          status: "PENDING",
          isLate: prev.payments.some((p) => p.status === "APPROVED"),
          note: null,
          approvedById: null,
          approvedAt: null,
          createdById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          creditor: null,
          fromAccount: null,
          branch: null,
        };
        queryClient.setQueryData(
          dayKey,
          recomputeDayView(prev, [...prev.payments, temp]),
        );
      }
      resetForm();
      payeeRef.current?.focus();
      return { prev };
    },
    onError: (e, body, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(dayKey, ctx.prev);
      restoreForm(body); // don't lose what the user typed
      toast.error(e instanceof Error ? e.message : "Failed to add");
    },
    onSuccess: ({ day: view }) => queryClient.setQueryData(dayKey, view),
  });

  const canSubmit =
    payeeName.trim().length > 0 && Number(amount) > 0 && !add.isPending;
  const submit = () => {
    if (canSubmit) add.mutate(buildBody());
  };

  return (
    <div className="flex flex-wrap items-end gap-2 border-b bg-muted/30 px-4 py-3">
      <div className="grid gap-1">
        <label className={fieldLabel}>Payee</label>
        <CreditorAutocomplete
          inputRef={payeeRef}
          value={payeeName}
          onValueChange={(v) => {
            setPayeeName(v);
            // Editing the text unlinks any previously picked creditor.
            setCreditorId("");
            setCreditorBranchId(undefined);
          }}
          onSelectCreditor={applyCreditor}
          onEnterSubmit={submit}
        />
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
            if (e.key === "Enter") submit();
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

      <Button onClick={submit} disabled={!canSubmit}>
        <IconPlus size={15} className="mr-1" />
        Add payment
      </Button>
    </div>
  );
}
