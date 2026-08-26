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
  adjustments: true,
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

  // Σ manual/receipt adjustments tagged to each account (paise, signed), split
  // into "received" (positive — receipt credits + manual add-funds) and
  // "payment" (negative — manual corrections, shown as an outflow) buckets so
  // the UI can render them as separate columns.
  const adjustedByAccount = new Map<string, number>();
  const receivedByAccount = new Map<string, number>();
  const correctionByAccount = new Map<string, number>();
  for (const a of day.adjustments) {
    const amt = Number(a.amountPaise);
    adjustedByAccount.set(a.accountId, (adjustedByAccount.get(a.accountId) ?? 0) + amt);
    if (amt > 0) {
      receivedByAccount.set(a.accountId, (receivedByAccount.get(a.accountId) ?? 0) + amt);
    } else if (amt < 0) {
      correctionByAccount.set(a.accountId, (correctionByAccount.get(a.accountId) ?? 0) - amt);
    }
  }

  const balances = day.balances.map((b) => {
    const opening = Number(b.openingBalance);
    const adjustmentsTotal = adjustedByAccount.get(b.accountId) ?? 0;
    const approvedForAccount = taggedByAccount.get(b.accountId) ?? 0;
    const closingBalance = opening - approvedForAccount + adjustmentsTotal;
    return {
      ...b,
      openingBalance: opening,
      carriedOpening: b.carriedOpening === null ? null : Number(b.carriedOpening),
      adjustmentsTotal,
      receivedTotal: receivedByAccount.get(b.accountId) ?? 0,
      paymentTotal: approvedForAccount + (correctionByAccount.get(b.accountId) ?? 0),
      closingBalance,
    };
  });

  const totalOpening = balances.reduce((s, b) => s + b.openingBalance, 0);
  const approvedTotal = approvedPayments.reduce((s, p) => s + Number(p.amount), 0);
  const pendingTotal = day.payments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalAdjustments = day.adjustments.reduce(
    (s, a) => s + Number(a.amountPaise),
    0,
  );
  const totalReceived = balances.reduce((s, b) => s + b.receivedTotal, 0);
  const totalPayment = balances.reduce((s, b) => s + b.paymentTotal, 0);

  return {
    ...day,
    balances,
    payments: day.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    adjustments: day.adjustments.map((a) => ({ ...a, amountPaise: Number(a.amountPaise) })),
    totalOpening,
    approvedTotal,
    pendingTotal,
    totalAdjustments,
    totalReceived,
    totalPayment,
    availableCash: totalOpening + totalAdjustments - approvedTotal,
  };
}

/**
 * Build the global receivables ledger: every receivable ordered by expected
 * date, plus pending/expected subtotals (unreceived only). All money is paise.
 *
 * Bill-linked rows (source: "BILL") are grouped by customerId into a single
 * display line summing their totals — a customer with 3 open bills shows as
 * one row, matching how manual entries have always displayed. Manual rows
 * (no customerId) are never grouped; each stays its own line, unchanged.
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

  // Bill-linked rows group by customer; manual rows pass through untouched.
  const billRows = receivables.filter((r) => r.source === "BILL" && r.customerId);
  const manualRows = receivables.filter((r) => !(r.source === "BILL" && r.customerId));

  const byCustomer = new Map<string, typeof billRows>();
  for (const r of billRows) {
    const list = byCustomer.get(r.customerId!) ?? [];
    list.push(r);
    byCustomer.set(r.customerId!, list);
  }

  const groupedBillRows = Array.from(byCustomer.entries()).map(([customerId, group]) => {
    // `group` is always non-empty here — byCustomer only ever gets an entry
    // via push-then-set, so this destructure is safe despite the array type.
    const [first, ...rest] = group;
    if (!first) throw new Error("Unreachable: grouped receivable with no rows");

    const withDate = group
      .filter((r) => r.expectedDate)
      .sort((a, b) => a.expectedDate!.getTime() - b.expectedDate!.getTime());
    const allReceipts = group
      .flatMap((r) => r.receipts)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    const anyReceived = group.some((r) => r.receivedAmount !== null);

    return {
      id: `customer:${customerId}`,
      partyName: first.partyName,
      source: "BILL" as const,
      billId: null,
      customerId,
      totalAmount: group.reduce((s, r) => s + r.totalAmount, 0),
      expectedAmount: group.reduce((s, r) => s + r.expectedAmount, 0),
      expectedDate: withDate[0]?.expectedDate ?? null,
      receivedAmount: anyReceived
        ? group.reduce((s, r) => s + (r.receivedAmount ?? 0), 0)
        : null,
      ackReceived: group.every((r) => r.ackReceived),
      note: null,
      createdAt: first.createdAt,
      updatedAt: rest.reduce(
        (latest, r) => (r.updatedAt > latest ? r.updatedAt : latest),
        first.updatedAt,
      ),
      receipts: allReceipts,
      linkedEntries: group.map((r) => ({ id: r.id, billId: r.billId, totalAmount: r.totalAmount })),
    };
  });
  const display = [...manualRows.map((r) => ({ ...r, linkedEntries: undefined })), ...groupedBillRows].sort(
    (a, b) => {
      const ad = a.expectedDate?.getTime() ?? Infinity;
      const bd = b.expectedDate?.getTime() ?? Infinity;
      return ad - bd || a.createdAt.getTime() - b.createdAt.getTime();
    },
  );

  const open = display.filter((r) => !r.ackReceived);
  return {
    receivables: display,
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
  const [balanceAgg, approvedAgg, adjustmentAgg] = await Promise.all([
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
    client.cashAccountAdjustment.aggregate({
      where: { dayId },
      _sum: { amountPaise: true },
    }),
  ]);

  const totalOpening = Number(balanceAgg._sum.openingBalance ?? 0n);
  const approvedTotal = Number(approvedAgg._sum.amount ?? 0n);
  const totalAdjustments = Number(adjustmentAgg._sum.amountPaise ?? 0n);
  return {
    totalOpening,
    approvedTotal,
    totalAdjustments,
    availableCash: totalOpening + totalAdjustments - approvedTotal,
  };
}

/**
 * Same as poolTotals but scoped to one cash account — used to guard that
 * approving a payment doesn't overdraw the specific account it's tagged to,
 * even if the combined pool across all accounts still has room.
 */
export async function accountTotals(
  client: Prisma.TransactionClient,
  dayId: string,
  accountId: string,
  excludePaymentId?: string,
) {
  const [balance, approvedAgg, adjustmentAgg] = await Promise.all([
    client.cashAccountBalance.findUnique({
      where: { dayId_accountId: { dayId, accountId } },
      select: { openingBalance: true },
    }),
    client.cashPayment.aggregate({
      where: {
        dayId,
        fromAccountId: accountId,
        status: APPROVED,
        ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
      },
      _sum: { amount: true },
    }),
    client.cashAccountAdjustment.aggregate({
      where: { dayId, accountId },
      _sum: { amountPaise: true },
    }),
  ]);

  const openingBalance = Number(balance?.openingBalance ?? 0n);
  const approvedTotal = Number(approvedAgg._sum.amount ?? 0n);
  const adjustmentsTotal = Number(adjustmentAgg._sum.amountPaise ?? 0n);
  return {
    openingBalance,
    approvedTotal,
    adjustmentsTotal,
    availableCash: openingBalance + adjustmentsTotal - approvedTotal,
  };
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

const toDateOnly = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Resolve which CashPlanDay a Receipt's cash credit should land on: the day
 * matching its received date if that day is still OPEN, otherwise the most
 * recently opened day. Returns null if no day is open at all — the credit is
 * skipped rather than attached to a closed day.
 */
export async function resolveCreditDay(
  client: Prisma.TransactionClient,
  receivedAt: Date,
) {
  const date = toDateOnly(receivedAt);
  const exact = await client.cashPlanDay.findUnique({ where: { date } });
  if (exact && exact.status === "OPEN") return exact;

  // Closest OPEN day on or after the receipt's date (e.g. 22 Aug receipt,
  // 22 Aug closed -> lands on 23 Aug if that's open, not whichever OPEN day
  // happens to be furthest in the future).
  const nextOpen = await client.cashPlanDay.findFirst({
    where: { status: "OPEN", date: { gte: date } },
    orderBy: { date: "asc" },
  });
  if (nextOpen) return nextOpen;

  // Nothing open on or after — fall back to the closest OPEN day before it.
  return client.cashPlanDay.findFirst({
    where: { status: "OPEN", date: { lt: date } },
    orderBy: { date: "desc" },
  });
}
/**
 * Credit a cash account for a posted Receipt — the mirror of "Pay from" on
 * the payment side. No-ops (and returns null) if there's nowhere open to
 * post it; the money just isn't reflected in Cash Planning until a day is
 * opened, rather than being silently attached to a closed one.
 */
export async function creditAccountForReceipt(
  client: Prisma.TransactionClient,
  params: {
    receivedAt: Date;
    accountId: string;
    amountPaise: bigint;
    reason: string;
    receiptId: string;
    createdById: string;
  },
) {
  if (params.amountPaise === 0n) return null;
  const day = await resolveCreditDay(client, params.receivedAt);
  if (!day) return null;
  return client.cashAccountAdjustment.create({
    data: {
      dayId: day.id,
      accountId: params.accountId,
      amountPaise: params.amountPaise,
      reason: params.reason,
      receiptId: params.receiptId,
      createdById: params.createdById,
    },
  });
}

/**
 * Reverse whatever account credits a Receipt previously posted (on cancel).
 * Reverses the exact original adjustment rows by id rather than re-resolving
 * "today's open day" — the credit may have landed on a day that's since
 * closed, and the reversal must net out against that same day, not a later
 * one.
 */
export async function reverseAccountAdjustmentsForReceipt(
  client: Prisma.TransactionClient,
  receiptId: string,
  reason: string,
  createdById: string,
) {
  const original = await client.cashAccountAdjustment.findMany({
    where: { receiptId, amountPaise: { gt: 0n } },
  });
  for (const adj of original) {
    await client.cashAccountAdjustment.create({
      data: {
        dayId: adj.dayId,
        accountId: adj.accountId,
        amountPaise: -adj.amountPaise,
        reason,
        receiptId,
        createdById,
      },
    });
  }
}
