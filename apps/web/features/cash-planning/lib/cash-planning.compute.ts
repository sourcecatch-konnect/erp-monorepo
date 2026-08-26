import type {
  CashPlanDayView,
  CashPaymentWithCreditor,
  ReceivablesView,
} from "@skerp/types";

/**
 * Client mirror of the server's `buildDayView` derived-field math. Used for
 * optimistic updates: after mutating the `payments` array (status change,
 * delete, reorder) we recompute closing balances + pooled totals locally so the
 * UI reflects the change instantly, before the server round-trip lands.
 *
 * Keep this in sync with `apps/server/.../cash-planning.service.ts#buildDayView`.
 */
export function recomputeDayView(
  day: CashPlanDayView,
  payments: CashPaymentWithCreditor[],
): CashPlanDayView {
  const approved = payments.filter((p) => p.status === "APPROVED");
  const oldApproved = day.payments.filter((p) => p.status === "APPROVED");

  // Σ approved payments tagged to each account (paise), before and after the
  // transform — the delta isolates just the payment-queue contribution to
  // paymentTotal, so the correction/adjustment portion (untouched by this
  // transform) carries over unchanged.
  const taggedByAccount = new Map<string, number>();
  for (const p of approved) {
    if (!p.fromAccountId) continue;
    taggedByAccount.set(
      p.fromAccountId,
      (taggedByAccount.get(p.fromAccountId) ?? 0) + p.amount,
    );
  }
  const oldTaggedByAccount = new Map<string, number>();
  for (const p of oldApproved) {
    if (!p.fromAccountId) continue;
    oldTaggedByAccount.set(
      p.fromAccountId,
      (oldTaggedByAccount.get(p.fromAccountId) ?? 0) + p.amount,
    );
  }

  const balances = day.balances.map((b) => {
    const approvedForAccount = taggedByAccount.get(b.accountId) ?? 0;
    const correctionOutflow = b.paymentTotal - (oldTaggedByAccount.get(b.accountId) ?? 0);
    return {
      ...b,
      paymentTotal: approvedForAccount + correctionOutflow,
      closingBalance: b.openingBalance - approvedForAccount + b.adjustmentsTotal,
    };
  });

  const totalOpening = balances.reduce((s, b) => s + b.openingBalance, 0);
  const approvedTotal = approved.reduce((s, p) => s + p.amount, 0);
  const pendingTotal = payments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + p.amount, 0);
  const totalReceived = balances.reduce((s, b) => s + b.receivedTotal, 0);
  const totalPayment = balances.reduce((s, b) => s + b.paymentTotal, 0);

  return {
    ...day,
    balances,
    payments,
    totalOpening,
    approvedTotal,
    pendingTotal,
    totalReceived,
    totalPayment,
    availableCash: totalOpening + day.totalAdjustments - approvedTotal,
  };
}

/**
 * Client mirror of the server's partial-receipt math, for optimistic updates.
 * Deducts `amount` from the receivable's outstanding total, accumulates it into
 * the received running total, consumes the expected slice, closes the row when
 * nothing's left, then recomputes the pending/expected subtotals.
 *
 * Keep in sync with the `/receivables/:id/received` route.
 */
export function applyReceiptOptimistic(
  view: ReceivablesView,
  id: string,
  amount: number,
): ReceivablesView {
  const receivables = view.receivables.map((r) => {
    if (r.id !== id) return r;
    const receivedNow = Math.min(amount, r.totalAmount);
    const newOutstanding = r.totalAmount - receivedNow;
    return {
      ...r,
      totalAmount: newOutstanding,
      receivedAmount: (r.receivedAmount ?? 0) + receivedNow,
      expectedAmount: 0,
      expectedDate: null,
      ackReceived: newOutstanding === 0,
      receipts:
        receivedNow > 0
          ? [
              {
                id: `temp-${Date.now()}`,
                receivableId: r.id,
                amount: receivedNow,
                receivedAt: new Date(),
                note: null,
                createdAt: new Date(),
              },
              ...r.receipts,
            ]
          : r.receipts,
    };
  });

  const open = receivables.filter((r) => !r.ackReceived);
  return {
    receivables,
    totalPending: open.reduce((s, r) => s + r.totalAmount, 0),
    totalExpected: open.reduce((s, r) => s + r.expectedAmount, 0),
  };
}
