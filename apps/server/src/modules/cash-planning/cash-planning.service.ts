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

type ActivityEntry = {
  id: string;
  label: string;
  detail?: string;
  amountPaise: number;
  at: Date;
  tag: "receipt" | "manual" | "payment" | "correction";
};

type AccountActivity = { inPaise: number; outPaise: number; inEntries: ActivityEntry[]; outEntries: ActivityEntry[] };

const SOURCE_LABEL: Record<string, string> = {
  RECEIPT: "Receipt",
  VENDOR_PAYMENT: "Payment",
  DRIVER_PAYOUT: "Driver payment",
  DRIVER_SALARY_ADVANCE: "Salary advance",
  OPENING_BALANCE: "Opening balance",
  MANUAL: "Journal",
};

/**
 * Every voucher that moved money in or out of these cash / bank accounts on
 * `date` (the accounting books) — receipts, Cash Planning and vendor
 * payments, driver salaries / advances / payouts, opening balances.
 * Reversed entries are left out. Map of CashAccount id → totals and entries.
 */
export async function booksDayActivity(
  client: Prisma.TransactionClient | typeof db,
  date: Date,
  accountIds: string[],
): Promise<Map<string, AccountActivity>> {
  const result = new Map<string, AccountActivity>(
    accountIds.map((id) => [id, { inPaise: 0, outPaise: 0, inEntries: [], outEntries: [] }]),
  );
  const ledgers = await client.ledger.findMany({
    where: { cashAccountId: { in: accountIds } },
    select: { id: true, cashAccountId: true },
  });
  if (!ledgers.length) return result;
  const accountByLedger = new Map(ledgers.map((l) => [l.id, l.cashAccountId!]));
  const next = new Date(date.getTime() + 86_400_000);
  const lines = await client.journalLine.findMany({
    where: {
      ledgerId: { in: [...accountByLedger.keys()] },
      journalEntry: { ...LIVE_VOUCHERS, voucherDate: { gte: date, lt: next } },
    },
    select: {
      id: true,
      ledgerId: true,
      debitPaise: true,
      creditPaise: true,
      narration: true,
      journalEntry: {
        select: {
          id: true,
          voucherNumber: true,
          narration: true,
          sourceType: true,
          reversesId: true,
          createdAt: true,
        },
      },
    },
  });
  for (const line of lines) {
    const act = result.get(accountByLedger.get(line.ledgerId)!)!;
    const je = line.journalEntry;
    const debit = Number(line.debitPaise);
    const credit = Number(line.creditPaise);
    const entry = {
      id: line.id,
      label: line.narration?.trim() || je.narration?.trim() || SOURCE_LABEL[je.sourceType] || je.voucherNumber,
      detail: je.voucherNumber,
      at: je.createdAt,
    };
    if (debit > 0) {
      act.inPaise += debit;
      act.inEntries.push({
        ...entry,
        // A later-day reversal of a payment = money back: show it as such.
        amountPaise: debit,
        tag: je.sourceType === "RECEIPT" ? "receipt" : "manual",
      });
    } else if (credit > 0) {
      act.outPaise += credit;
      act.outEntries.push({
        ...entry,
        amountPaise: credit,
        tag: "payment",
      });
    }
  }
  return result;
}

const newestFirst = (a: ActivityEntry, b: ActivityEntry) => b.at.getTime() - a.at.getTime();

/**
 * Build the API view from a loaded day and the day's money movements in the
 * books: per account, opening (books, start of day) + received − payment =
 * closing. Cash Planning items with no voucher are added on top so nothing is
 * lost: approved payments without a voucher (no branch / account) and manual
 * "add funds" entries. Adjustments created by receipts are skipped — the
 * receipt's own voucher is already in the books. All money is paise (number).
 */
export function buildDayView(day: DayWithRelations, books: Map<string, AccountActivity>) {
  const approvedPayments = day.payments.filter((p) => p.status === APPROVED);

  const balances = day.balances.map((b) => {
    const act = books.get(b.accountId) ?? { inPaise: 0, outPaise: 0, inEntries: [], outEntries: [] };
    const inEntries = [...act.inEntries];
    const outEntries = [...act.outEntries];
    let received = act.inPaise;
    let payment = act.outPaise;

    // Cash Planning items that never reached the books.
    for (const a of day.adjustments) {
      if (a.accountId !== b.accountId || a.receiptId) continue;
      const amt = Number(a.amountPaise);
      if (amt > 0) {
        received += amt;
        inEntries.push({ id: a.id, label: "Manual add funds", detail: a.reason, amountPaise: amt, at: a.createdAt, tag: "manual" });
      } else if (amt < 0) {
        payment += -amt;
        outEntries.push({ id: a.id, label: "Correction", detail: a.reason, amountPaise: -amt, at: a.createdAt, tag: "correction" });
      }
    }
    for (const pmt of approvedPayments) {
      if (pmt.fromAccountId !== b.accountId || pmt.journalEntryId) continue;
      const amt = Number(pmt.amount);
      payment += amt;
      outEntries.push({
        id: pmt.id,
        label: pmt.payeeName,
        detail: pmt.creditor?.name,
        amountPaise: amt,
        at: pmt.approvedAt ?? pmt.createdAt,
        tag: "payment",
      });
    }

    const opening = Number(b.openingBalance);
    return {
      ...b,
      openingBalance: opening,
      carriedOpening: b.carriedOpening === null ? null : Number(b.carriedOpening),
      adjustmentsTotal: day.adjustments
        .filter((a) => a.accountId === b.accountId)
        .reduce((s, a) => s + Number(a.amountPaise), 0),
      receivedTotal: received,
      paymentTotal: payment,
      closingBalance: opening + received - payment,
      receivedEntries: inEntries.sort(newestFirst),
      paymentEntries: outEntries.sort(newestFirst),
    };
  });

  const totalOpening = balances.reduce((s, b) => s + b.openingBalance, 0);
  const approvedTotal = approvedPayments.reduce((s, p) => s + Number(p.amount), 0);
  const untaggedApproved = approvedPayments
    .filter((p) => !p.fromAccountId)
    .reduce((s, p) => s + Number(p.amount), 0);
  const pendingTotal = day.payments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalAdjustments = day.adjustments.reduce((s, a) => s + Number(a.amountPaise), 0);
  const totalReceived = balances.reduce((s, b) => s + b.receivedTotal, 0);
  const totalPayment = balances.reduce((s, b) => s + b.paymentTotal, 0);
  const totalClosing = balances.reduce((s, b) => s + b.closingBalance, 0);

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
    // Money left across the accounts, less approved payments not tied to one.
    availableCash: totalClosing - untaggedApproved,
  };
}

/** Load a day and its money movements from the books, and build its view. */
export async function dayView(client: Prisma.TransactionClient | typeof db, dayId: string) {
  const day = await client.cashPlanDay.findUnique({ where: { id: dayId }, include: dayInclude });
  if (!day) return null;
  const books = await booksDayActivity(
    client,
    day.date,
    day.balances.map((b) => b.accountId),
  );
  return buildDayView(day, books);
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

/** An approved payment being re-approved is added back (it's already in). */
async function addBack(client: Prisma.TransactionClient, excludePaymentId?: string, accountId?: string) {
  if (!excludePaymentId) return 0;
  const p = await client.cashPayment.findUnique({
    where: { id: excludePaymentId },
    select: { status: true, amount: true, fromAccountId: true },
  });
  if (!p || p.status !== APPROVED) return 0;
  if (accountId !== undefined && p.fromAccountId !== accountId) return 0;
  return Number(p.amount);
}

/**
 * Pooled cash for the approval guard — the same books-based figure the day
 * shows (Σ closing balances − approved payments not tied to an account).
 * Uses the provided client so it can run inside a transaction.
 */
export async function poolTotals(
  client: Prisma.TransactionClient,
  dayId: string,
  excludePaymentId?: string,
) {
  const view = await dayView(client, dayId);
  const back = await addBack(client, excludePaymentId);
  return {
    totalOpening: view?.totalOpening ?? 0,
    approvedTotal: view?.approvedTotal ?? 0,
    totalAdjustments: view?.totalAdjustments ?? 0,
    availableCash: (view?.availableCash ?? 0) + back,
  };
}

/**
 * Same for one account — its closing balance for the day (books + Cash
 * Planning items), so a payment can't overdraw the account it is tagged to.
 */
export async function accountTotals(
  client: Prisma.TransactionClient,
  dayId: string,
  accountId: string,
  excludePaymentId?: string,
) {
  const view = await dayView(client, dayId);
  const balance = view?.balances.find((b) => b.accountId === accountId);
  const back = await addBack(client, excludePaymentId, accountId);
  return {
    openingBalance: balance?.openingBalance ?? 0,
    approvedTotal: 0,
    adjustmentsTotal: balance?.adjustmentsTotal ?? 0,
    availableCash: (balance?.closingBalance ?? 0) + back,
  };
}

/* ------------------------------------------------------------------ */
/* Openings from the accounting books (Cash Planning ↔ books, step 1)   */
/* ------------------------------------------------------------------ */

/**
 * Vouchers that count in Cash Planning: posted and not reversed. A reversal
 * means the entry was a mistake and never happened, so the reversed voucher
 * and its reversal are both left out, on whatever days they fall — the
 * balance is the same as counting both, without fake "received" / "paid"
 * lines. (Ledgers → Cash / Bank still lists both for audit.)
 */
const LIVE_VOUCHERS = { status: "POSTED" as const, reversesId: null };

/**
 * Each cash / bank account's balance in the accounting books at the start of
 * `date` — every voucher dated before it, including the account's opening
 * balance (Finance → Opening Balances). Reversed vouchers and their reversals
 * are left out (they cancel out anyway). Map of CashAccount id → paise.
 */
export async function booksOpenings(
  client: Prisma.TransactionClient | typeof db,
  date: Date,
  accountIds: string[],
): Promise<Map<string, number>> {
  const ledgers = await client.ledger.findMany({
    where: { cashAccountId: { in: accountIds } },
    select: { id: true, cashAccountId: true },
  });
  const sums = ledgers.length
    ? await client.journalLine.groupBy({
        by: ["ledgerId"],
        where: {
          ledgerId: { in: ledgers.map((l) => l.id) },
          journalEntry: { ...LIVE_VOUCHERS, voucherDate: { lt: date } },
        },
        _sum: { debitPaise: true, creditPaise: true },
      })
    : [];
  const byLedger = new Map(
    sums.map((s) => [s.ledgerId, Number((s._sum.debitPaise ?? 0n) - (s._sum.creditPaise ?? 0n))]),
  );
  const result = new Map<string, number>(accountIds.map((id) => [id, 0]));
  for (const l of ledgers) result.set(l.cashAccountId!, byLedger.get(l.id) ?? 0);
  return result;
}

/**
 * Refresh an OPEN day's openings from the books (a voucher posted late for an
 * earlier day still lands in today's opening) and add a row for any account
 * created since the day was opened. A CLOSED day keeps its numbers.
 */
export async function syncOpenDayFromBooks(client: Prisma.TransactionClient | typeof db, dayId: string) {
  const day = await client.cashPlanDay.findUnique({
    where: { id: dayId },
    select: { id: true, date: true, status: true, balances: { select: { accountId: true } } },
  });
  if (!day || day.status !== "OPEN") return;
  const accounts = await client.cashAccount.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
  });
  const ids = [...new Set([...accounts.map((a) => a.id), ...day.balances.map((b) => b.accountId)])];
  const openings = await booksOpenings(client, day.date, ids);
  for (const accountId of ids) {
    const opening = BigInt(openings.get(accountId) ?? 0);
    await client.cashAccountBalance.upsert({
      where: { dayId_accountId: { dayId, accountId } },
      update: { openingBalance: opening, carriedOpening: opening },
      create: { dayId, accountId, openingBalance: opening, carriedOpening: opening },
    });
  }
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
