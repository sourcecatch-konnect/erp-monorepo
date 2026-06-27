import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";

/** Eager-load shape for a full day view. */
export const dayInclude = {
  balances: {
    include: { account: { select: { id: true, name: true, type: true } } },
    orderBy: { account: { name: "asc" } },
  },
  payments: {
    include: {
      creditor: { select: { id: true, name: true, category: true } },
      fromAccount: { select: { id: true, name: true, type: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.CashPlanDayInclude;

type DayWithRelations = Prisma.CashPlanDayGetPayload<{ include: typeof dayInclude }>;

const APPROVED = "APPROVED" as const;

/**
 * Build the API view from a loaded day: per-account closing balances and the
 * pooled opening / approved / available totals. All money is paise (number).
 */
export function buildDayView(day: DayWithRelations) {
  const approvedPayments = day.payments.filter((p) => p.status === APPROVED);

  // Σ approved payments tagged to each account (paise).
  const taggedByAccount = new Map<string, number>();
  for (const p of approvedPayments) {
    if (!p.fromAccountId) continue;
    taggedByAccount.set(
      p.fromAccountId,
      (taggedByAccount.get(p.fromAccountId) ?? 0) + Number(p.amount),
    );
  }

  const balances = day.balances.map((b) => {
    const opening = Number(b.openingBalance);
    const closingBalance = opening - (taggedByAccount.get(b.accountId) ?? 0);
    return {
      ...b,
      openingBalance: opening,
      carriedOpening: b.carriedOpening === null ? null : Number(b.carriedOpening),
      closingBalance,
    };
  });

  const totalOpening = balances.reduce((s, b) => s + b.openingBalance, 0);
  const approvedTotal = approvedPayments.reduce((s, p) => s + Number(p.amount), 0);
  const pendingTotal = day.payments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + Number(p.amount), 0);

  return {
    ...day,
    balances,
    payments: day.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    totalOpening,
    approvedTotal,
    pendingTotal,
    availableCash: totalOpening - approvedTotal,
  };
}

/**
 * Build the global receivables ledger: every receivable ordered by expected
 * date, plus pending/expected subtotals (unreceived only). All money is paise.
 */
export async function buildReceivablesView() {
  const rows = await db.cashReceivable.findMany({
    orderBy: [{ expectedDate: "asc" }, { createdAt: "asc" }],
    include: { receipts: { orderBy: { receivedAt: "desc" } } },
  });

  const receivables = rows.map((r) => ({
    ...r,
    totalAmount: Number(r.totalAmount),
    expectedAmount: Number(r.expectedAmount),
    receivedAmount: r.receivedAmount === null ? null : Number(r.receivedAmount),
    receipts: r.receipts.map((rc) => ({ ...rc, amount: Number(rc.amount) })),
  }));

  const open = receivables.filter((r) => !r.ackReceived);
  return {
    receivables,
    totalPending: open.reduce((s, r) => s + r.totalAmount, 0),
    totalExpected: open.reduce((s, r) => s + r.expectedAmount, 0),
  };
}

/** Build the creditor ledger view grouped by category with auto subtotals. */
export async function buildLedgerView() {
  const creditors = await db.creditor.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true, name: true, category: true, outstandingBalance: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const byCategory = new Map<
    string,
    { id: string; name: string; outstandingBalance: number }[]
  >();
  for (const c of creditors) {
    const list = byCategory.get(c.category) ?? [];
    list.push({
      id: c.id,
      name: c.name,
      outstandingBalance: Number(c.outstandingBalance),
    });
    byCategory.set(c.category, list);
  }

  const groups = Array.from(byCategory.entries()).map(([category, list]) => ({
    category,
    creditors: list,
    subtotal: list.reduce((s, c) => s + c.outstandingBalance, 0),
  }));
  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0);

  return { groups, grandTotal };
}

/** Load a day by id with relations, or null. */
export function findDay(id: string) {
  return db.cashPlanDay.findUnique({ where: { id }, include: dayInclude });
}

/**
 * Pooled cash totals for the approval guard. `excludePaymentId` drops a
 * payment from the approved sum (used when re-approving an already-approved row).
 * Uses the provided client so it can run inside a transaction.
 */
export async function poolTotals(
  client: Prisma.TransactionClient,
  dayId: string,
  excludePaymentId?: string,
) {
  const [balanceAgg, approvedAgg] = await Promise.all([
    client.cashAccountBalance.aggregate({
      where: { dayId },
      _sum: { openingBalance: true },
    }),
    client.cashPayment.aggregate({
      where: {
        dayId,
        status: APPROVED,
        ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const totalOpening = Number(balanceAgg._sum.openingBalance ?? 0n);
  const approvedTotal = Number(approvedAgg._sum.amount ?? 0n);
  return { totalOpening, approvedTotal, availableCash: totalOpening - approvedTotal };
}

/**
 * Per-account closing balances of the most recent CLOSED day before `date`,
 * used to pre-seed the next day's opening (carry-forward). Returns a map of
 * accountId → closing paise. Untagged approved payments are not carried (the
 * opening field stays editable, deltas flagged in the UI).
 */
export async function priorClosings(date: Date): Promise<Map<string, number>> {
  const prior = await db.cashPlanDay.findFirst({
    where: { date: { lt: date }, status: "CLOSED" },
    orderBy: { date: "desc" },
    include: dayInclude,
  });

  const map = new Map<string, number>();
  if (!prior) return map;

  const view = buildDayView(prior);
  for (const b of view.balances) map.set(b.accountId, b.closingBalance);
  return map;
}
