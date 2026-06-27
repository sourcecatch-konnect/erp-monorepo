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

  // Σ approved payments tagged to each account (paise).
  const taggedByAccount = new Map<string, number>();
  for (const p of approved) {
    if (!p.fromAccountId) continue;
    taggedByAccount.set(
      p.fromAccountId,
      (taggedByAccount.get(p.fromAccountId) ?? 0) + p.amount,
    );
  }

  const balances = day.balances.map((b) => ({
    ...b,
    closingBalance: b.openingBalance - (taggedByAccount.get(b.accountId) ?? 0),
  }));

  const totalOpening = balances.reduce((s, b) => s + b.openingBalance, 0);
  const approvedTotal = approved.reduce((s, p) => s + p.amount, 0);
  const pendingTotal = payments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + p.amount, 0);

  return {
    ...day,
    balances,
    payments,
    totalOpening,
    approvedTotal,
    pendingTotal,
    availableCash: totalOpening - approvedTotal,
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
