"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconCheck,
  IconPlayerPause,
  IconX,
  IconTrash,
  IconSparkles,
  IconGripVertical,
  IconBolt,
  IconInbox,
  IconClock,
  IconFileInvoice,
} from "@tabler/icons-react";

import { PERMS } from "@skerp/types";
import type {
  CashPlanDayView,
  CashPaymentWithCreditor,
  PaymentStatus,
  CashSegment,
} from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { formatPaise, formatPaiseCompact } from "@/lib/money";
import { useCan } from "@/features/auth";
import { VoucherDialog } from "@/features/ledger/components/VoucherDialog";
import { ledgerApi } from "@/features/ledger/api/ledger.service";

import { cashPlanningApi } from "../api/cash-planning.service";
import { cashPlanningKeys } from "../api/cash-planning.keys";
import { recomputeDayView } from "../lib/cash-planning.compute";
import { CompactMoney } from "../components/CompactMoney";
import PaymentEntryForm from "./PaymentEntryForm";

type Props = {
  day: CashPlanDayView;
  date: string;
  canEnter: boolean;
  canApprove: boolean;
};

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

/** One row of the queue — a dnd-kit sortable item. Memoised so unaffected rows
 *  don't re-render on every drag move / optimistic patch. */
const PaymentRow = React.memo(function PaymentRow({
  p,
  index,
  remainingAfter,
  fits,
  accountShort,
  editable,
  approvable,
  canViewVoucher,
  pending,
  onStatus,
  onDelete,
  onViewVoucher,
}: {
  p: CashPaymentWithCreditor;
  index: number;
  remainingAfter: number;
  fits: boolean;
  accountShort: boolean;
  editable: boolean;
  approvable: boolean;
  canViewVoucher: boolean;
  pending: boolean;
  onStatus: (id: string, next: PaymentStatus) => void;
  onDelete: (id: string) => void;
  onViewVoucher: (journalEntryId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: p.id, disabled: !editable });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid min-w-0 grid-cols-[auto_auto_auto_minmax(0,1fr)_auto]
      items-center gap-x-2 gap-y-2 bg-card px-3 py-3
      ${isDragging ? "relative z-10 opacity-80 shadow-sm" : ""}
      ${accountShort ? "bg-amber-50/50" : !fits ? "bg-red-50/40" : ""}
      ${pending ? "opacity-60" : ""}`}
    >
      {editable ? (
        <button
          type="button"
          aria-label="Drag to reprioritise"
          className="shrink-0 cursor-grab touch-none text-muted-foreground/50 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <IconGripVertical size={15} />
        </button>
      ) : (
        <span />
      )}

      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
        {index + 1}
      </span>

      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {p.payeeName.charAt(0).toUpperCase()}
      </span>

      {/* Payee information */}
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span
            className="min-w-0 truncate text-sm font-medium"
            title={p.payeeName}
          >
            {p.payeeName}
          </span>

          {p.isLate ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
              <IconSparkles size={11} />
              new
            </span>
          ) : null}

          {p.segment ? (
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${segmentBadge[p.segment]
                }`}
            >
              {p.segment}
            </span>
          ) : null}
        </div>

        <div
          className="mt-0.5 truncate text-xs text-muted-foreground"
          title={`${labelOf(p.category)} · ${labelOf(p.mode)}${p.fromAccount ? ` · ${p.fromAccount.name}` : ""
            }`}
        >
          {labelOf(p.category)} · {labelOf(p.mode)}
          {p.fromAccount ? ` · ${p.fromAccount.name}` : ""}
        </div>
      </div>

      {/* Amount */}
      <div className="shrink-0 text-right">
        <CompactMoney className="text-sm font-semibold" value={p.amount} />

        <div
          className={`whitespace-nowrap text-[11px] ${accountShort || remainingAfter < 0
              ? "text-amber-700"
              : "text-muted-foreground"
            }`}
          title={
            accountShort
              ? `Exceeds ${p.fromAccount?.name ?? "the tagged account"}'s available balance`
              : formatPaise(Math.abs(remainingAfter))
          }
        >
          {accountShort
            ? `exceeds ${p.fromAccount?.name ?? "account"}`
            : remainingAfter < 0
              ? `over by ${formatPaiseCompact(-remainingAfter)}`
              : `${formatPaiseCompact(remainingAfter)} left`}
        </div>
      </div>

      {/* Status and actions move to a second line */}
      <div className="col-span-full flex items-center justify-end gap-1 border-t pt-2">
        <span
          className={`mr-1 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusBadge[p.status]
            }`}
        >
          {labelOf(p.status)}
        </span>

        {canViewVoucher && p.status === "APPROVED" && p.journalEntryId ? (
          <Button
            size="icon-sm"
            variant="ghost"
            title="View voucher"
            className="text-muted-foreground hover:bg-muted"
            onClick={() => onViewVoucher(p.journalEntryId!)}
          >
            <IconFileInvoice size={15} />
          </Button>
        ) : null}

        {approvable ? (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              title="Approve"
              className="text-emerald-600 hover:bg-emerald-50"
              disabled={pending || p.status === "APPROVED"}
              onClick={() => onStatus(p.id, "APPROVED")}
            >
              <IconCheck size={15} />
            </Button>

            <Button
              size="icon-sm"
              variant="ghost"
              title="Hold"
              className="text-amber-600 hover:bg-amber-50"
              disabled={pending || p.status === "HOLD"}
              onClick={() => onStatus(p.id, "HOLD")}
            >
              <IconPlayerPause size={15} />
            </Button>

            <Button
              size="icon-sm"
              variant="ghost"
              title="Reject"
              className="text-red-600 hover:bg-red-50"
              disabled={pending || p.status === "REJECTED"}
              onClick={() => onStatus(p.id, "REJECTED")}
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
            disabled={pending}
            onClick={() => onDelete(p.id)}
          >
            <IconTrash size={15} />
          </Button>
        ) : null}
      </div>
    </div>
  );
});

export default function PaymentQueue({ day, date, canEnter, canApprove }: Props) {
  const queryClient = useQueryClient();
  const editable = canEnter && day.status === "OPEN";
  const approvable = canApprove && day.status === "OPEN";
  const canViewVoucher = useCan(PERMS.LEDGER.VOUCHER_VIEW);

  const [voucherJeId, setVoucherJeId] = React.useState<string | null>(null);
  const voucherQuery = useQuery({
    queryKey: ["ledger", "voucher", voucherJeId],
    queryFn: () => ledgerApi.voucher(voucherJeId!),
    enabled: Boolean(voucherJeId),
  });
  const onViewVoucher = React.useCallback(
    (journalEntryId: string) => setVoucherJeId(journalEntryId),
    [],
  );

  const dayKey = cashPlanningKeys.day(date);
  const setDay = (view: CashPlanDayView) =>
    queryClient.setQueryData(dayKey, view);

  // Local order buffer, set only during a drag→persist window. Rendering the
  // sortable from local state (not the query cache, which re-renders via the
  // parent's useQuery) is what lets dnd-kit flush its drop animation without the
  // item flicking back to its old slot first. See dnd-kit discussion #1522.
  const [tempPayments, setTempPayments] =
    React.useState<CashPaymentWithCreditor[] | null>(null);
  const dragItems = tempPayments ?? day.payments;

  // Ids currently mid-mutation — disables just that row, never the whole list.
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const markPending = (id: string, on: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /**
   * Apply an optimistic transform to the cached day's payments, returning the
   * previous snapshot for rollback. Derived totals are recomputed locally so
   * the cash position / waterline update instantly.
   */
  const patchDay = async (
    transform: (payments: CashPaymentWithCreditor[]) => CashPaymentWithCreditor[],
  ): Promise<CashPlanDayView | undefined> => {
    await queryClient.cancelQueries({ queryKey: dayKey });
    const prev = queryClient.getQueryData<CashPlanDayView>(dayKey);
    if (prev) {
      setDay(recomputeDayView(prev, transform(prev.payments)));
    }
    return prev;
  };

  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: PaymentStatus }) =>
      cashPlanningApi.setStatus(id, next),
    onMutate: async ({ id, next }) => {
      markPending(id, true);
      const prev = await patchDay((payments) =>
        payments.map((p) => (p.id === id ? { ...p, status: next } : p)),
      );
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) setDay(ctx.prev);
      toast.error(e instanceof Error ? e.message : "Action failed");
    },
    onSuccess: (view) => setDay(view),
    onSettled: (_d, _e, { id }) => markPending(id, false),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cashPlanningApi.deletePayment(id),
    onMutate: async (id) => {
      markPending(id, true);
      const prev = await patchDay((payments) =>
        payments.filter((p) => p.id !== id),
      );
      return { prev };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) setDay(ctx.prev);
      toast.error(e instanceof Error ? e.message : "Delete failed");
    },
    onSuccess: (view) => setDay(view),
    onSettled: (_d, _e, id) => markPending(id, false),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      cashPlanningApi.reorder(day.id, orderedIds),
    // Optimistically write the new order + recomputed totals to the cache so the
    // Cash Position panel updates too. The visual order is held by tempPayments
    // (above) through the drop; this keeps the cache consistent underneath.
    onMutate: (orderedIds) => {
      const prev = queryClient.getQueryData<CashPlanDayView>(dayKey);
      if (prev) {
        const byId = new Map(prev.payments.map((p) => [p.id, p]));
        const payments = orderedIds
          .map((id) => byId.get(id))
          .filter((p): p is CashPaymentWithCreditor => !!p);
        setDay(recomputeDayView(prev, payments));
      }
      return { prev };
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.prev) setDay(ctx.prev);
      toast.error(e instanceof Error ? e.message : "Reorder failed");
    },
    onSuccess: (view) => setDay(view),
  });

  const bulkApprove = useMutation({
    mutationFn: (ids: string[]) => cashPlanningApi.approveBulk(day.id, ids),
    onMutate: async (ids) => {
      const set = new Set(ids);
      const prev = await patchDay((payments) =>
        payments.map((p) => (set.has(p.id) ? { ...p, status: "APPROVED" } : p)),
      );
      return { prev };
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.prev) setDay(ctx.prev);
      toast.error(e instanceof Error ? e.message : "Bulk approve failed");
    },
    onSuccess: (view) => {
      setDay(view);
      toast.success("Approved all payments that fit available cash");
    },
  });

  // ── waterline computation ──
  // Mirrors the backend guards exactly (cash-planning.route.ts): the pool
  // check is a hard stop — once the whole pool would be exceeded, every
  // later consuming payment is treated as out too, since the queue is
  // priority-ordered and pool cash only depletes going down the list. The
  // per-account check only skips the one payment whose specific account is
  // short — a later payment on a different, still-solvent account can still
  // fit, so it does NOT propagate like the pool check does.
  const computed = React.useMemo(() => {
    const poolCeiling = day.totalOpening + day.totalAdjustments;
    const accountCeiling = new Map(
      day.balances.map((b) => [b.accountId, b.openingBalance + b.adjustmentsTotal]),
    );
    const accountRunning = new Map<string, number>();
    let poolRunning = 0;
    let poolExhausted = false;

    return dragItems.map((p) => {
      const consumes = p.status !== "REJECTED" && p.status !== "HOLD";
      if (!consumes) {
        return {
          p,
          remainingAfter: poolCeiling - poolRunning,
          fits: true,
          accountShort: false,
          poolShort: false,
          consumes,
        };
      }

      let accountShort = false;
      if (p.fromAccountId) {
        const ceiling = accountCeiling.get(p.fromAccountId) ?? 0;
        const running = accountRunning.get(p.fromAccountId) ?? 0;
        accountShort = running + p.amount > ceiling;
        if (!accountShort) accountRunning.set(p.fromAccountId, running + p.amount);
      }

      let poolShort = false;
      if (!accountShort) {
        if (!poolExhausted && poolRunning + p.amount > poolCeiling) poolExhausted = true;
        poolShort = poolExhausted;
        if (!poolShort) poolRunning += p.amount;
      }

      return {
        p,
        remainingAfter: poolCeiling - poolRunning,
        fits: !accountShort && !poolShort,
        accountShort,
        poolShort,
        consumes,
      };
    });
  }, [dragItems, day.totalOpening, day.totalAdjustments, day.balances]);

  const waterlineIndex = computed.findIndex((c) => c.poolShort);
  const pendingThatFit = computed
    .filter((c) => c.p.status === "PENDING" && c.fits)
    .map((c) => c.p.id);

  const approvedCount = day.payments.filter((p) => p.status === "APPROVED").length;
  const pendingCount = day.payments.filter((p) => p.status === "PENDING").length;

  // ── dnd-kit ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const itemIds = React.useMemo(() => dragItems.map((p) => p.id), [dragItems]);

  const onStatus = React.useCallback(
    (id: string, next: PaymentStatus) => status.mutate({ id, next }),
    [status],
  );
  const onDelete = React.useCallback((id: string) => remove.mutate(id), [remove]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    // 1) Buffer the new order in local state so dnd-kit renders a stable list
    //    through its drop animation — this is what kills the flick-back race.
    const reordered = arrayMove(dragItems, oldIndex, newIndex);
    setTempPayments(reordered);
    try {
      // 2) Persist; onMutate also writes the new order + totals to the cache.
      await reorder.mutateAsync(reordered.map((p) => p.id));
    } finally {
      // 3) Hand rendering back to the (now server-authoritative) cache.
      setTempPayments(null);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">Payment Queue</h2>
          <p className="text-xs text-muted-foreground">
            Priority order — drag to reprioritise
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            <IconCheck size={12} />
            <CompactMoney value={day.approvedTotal} />
            <span className="opacity-70">· {approvedCount}</span>
          </span>
          {day.pendingTotal > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              <IconClock size={12} />
              <CompactMoney value={day.pendingTotal} />
              <span className="opacity-70">· {pendingCount}</span>
            </span>
          ) : null}
          {approvable && pendingThatFit.length > 0 ? (
            <Button
              size="sm"
              onClick={() => bulkApprove.mutate(pendingThatFit)}
              disabled={bulkApprove.isPending}
            >
              <IconBolt size={14} className="mr-1" />
              Approve all that fit ({pendingThatFit.length})
            </Button>
          ) : null}
        </div>
      </div>

      {/* fast-entry row — isolated so typing doesn't re-render the queue/DnD */}
      {editable ? <PaymentEntryForm day={day} date={date} /> : null}

      {/* rows */}
      {day.payments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
          <IconInbox size={26} className="text-muted-foreground/70" />
          No payments queued yet.{editable ? " Add one above to begin." : ""}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="divide-y">
              {computed.map(({ p, remainingAfter, fits, accountShort }, index) => (
                <React.Fragment key={p.id}>
                  {index === waterlineIndex ? (
                    <div className="flex items-center gap-2 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-600">
                      <span className="h-px flex-1 bg-red-300" />
                      cash runs out here — below this exceeds available cash
                      <span className="h-px flex-1 bg-red-300" />
                    </div>
                  ) : null}
                  <PaymentRow
                    p={p}
                    index={index}
                    remainingAfter={remainingAfter}
                    fits={fits}
                    accountShort={accountShort}
                    editable={editable}
                    approvable={approvable}
                    canViewVoucher={canViewVoucher}
                    pending={pendingIds.has(p.id)}
                    onStatus={onStatus}
                    onDelete={onDelete}
                    onViewVoucher={onViewVoucher}
                  />
                </React.Fragment>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <VoucherDialog
        open={Boolean(voucherJeId)}
        onOpenChange={(open) => !open && setVoucherJeId(null)}
        voucher={voucherQuery.data}
        isLoading={voucherQuery.isLoading}
        isError={voucherQuery.isError}
        errorMessage={
          voucherQuery.error instanceof Error
            ? voucherQuery.error.message
            : undefined
        }
      />
    </div>
  );
}
