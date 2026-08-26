import type {
  Prisma,
  LedgerDirection,
  LedgerSourceType,
  CreditorCategory,
} from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";

export type RecordLedgerEntryParams = {
  direction: LedgerDirection;
  amountPaise: bigint;
  cashAccountId?: string | null;
  customerId?: string | null;
  creditorId?: string | null;
  category?: CreditorCategory | null;
  sourceType: LedgerSourceType;
  sourceId: string;
  occurredAt: Date;
  description: string;
  createdById: string;
};

/**
 * Writes one LedgerEntry row. MUST be called with the same
 * `Prisma.TransactionClient` as the source mutation (receipt / payment /
 * adjustment write) — unlike `audit.service.ts#recordAuditEntry`, this does
 * NOT catch/swallow errors and does NOT use the base `db` client. A ledger
 * write failure must roll back the whole transaction: the Bank/Cash/Debtor/
 * Creditor/Expense ledger reports depend on this table being a complete,
 * accurate mirror of every money-moving event, unlike audit logging which is
 * best-effort by design.
 */
export async function recordLedgerEntry(
  client: Prisma.TransactionClient,
  params: RecordLedgerEntryParams,
) {
  if (params.amountPaise === 0n) return null;
  return client.ledgerEntry.create({
    data: {
      occurredAt: params.occurredAt,
      direction: params.direction,
      amountPaise: params.amountPaise,
      cashAccountId: params.cashAccountId ?? null,
      customerId: params.customerId ?? null,
      creditorId: params.creditorId ?? null,
      category: params.category ?? null,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      description: params.description,
      createdById: params.createdById,
    },
  });
}

export type LedgerDateRange = { from?: string; to?: string };

type LedgerRow = {
  id: string;
  occurredAt: Date;
  direction: LedgerDirection;
  amountPaise: bigint;
  cashAccountId: string | null;
  customerId: string | null;
  creditorId: string | null;
  category: CreditorCategory | null;
  sourceType: LedgerSourceType;
  sourceId: string;
  description: string;
  createdById: string;
  createdAt: Date;
};

/**
 * Shared "fetch full history, compute running balance, slice to range" core
 * for all 4 read views. Running balance is computed over the account/party's
 * complete history (not just the filtered range) so `openingBalance` for a
 * mid-history `from` date comes out correct, then the loop keeps only rows
 * inside [from, to]. No stored running-balance column — same reasoning as
 * `cash-planning.compute.ts`'s fix earlier this session, computed at query
 * time so it can never go stale.
 */
function buildLedgerView(rows: LedgerRow[], range: LedgerDateRange) {
  const fromDate = range.from ? new Date(`${range.from}T00:00:00.000Z`) : null;
  const toDate = range.to ? new Date(`${range.to}T23:59:59.999Z`) : null;

  let running = 0;
  let openingBalance = 0;
  const entries: Array<Omit<LedgerRow, "amountPaise"> & { amountPaise: number; runningBalance: number }> = [];

  for (const row of rows) {
    const signed = row.direction === "IN" ? Number(row.amountPaise) : -Number(row.amountPaise);
    running += signed;

    const inRange = (!fromDate || row.occurredAt >= fromDate) && (!toDate || row.occurredAt <= toDate);
    if (!inRange) {
      if (!fromDate || row.occurredAt < fromDate) openingBalance = running;
      continue;
    }
    entries.push({ ...row, amountPaise: Number(row.amountPaise), runningBalance: running });
  }

  const totalIn = entries.reduce((s, e) => s + (e.direction === "IN" ? e.amountPaise : 0), 0);
  const totalOut = entries.reduce((s, e) => s + (e.direction === "OUT" ? e.amountPaise : 0), 0);
  const closingBalance = entries.length > 0 ? entries[entries.length - 1]!.runningBalance : openingBalance;

  return { entries, openingBalance, closingBalance, totalIn, totalOut };
}

const orderChronological = [{ occurredAt: "asc" as const }, { createdAt: "asc" as const }];

/** Bank or Cash ledger — which one it "is" is just this account's own `type`. */
export async function ledgerForAccount(accountId: string, range: LedgerDateRange = {}) {
  const rows = await db.ledgerEntry.findMany({
    where: { cashAccountId: accountId },
    orderBy: orderChronological,
  });
  return buildLedgerView(rows, range);
}

/** Debtor (Customer) ledger. */
export async function ledgerForCustomer(customerId: string, range: LedgerDateRange = {}) {
  const rows = await db.ledgerEntry.findMany({
    where: { customerId },
    orderBy: orderChronological,
  });
  return buildLedgerView(rows, range);
}

/** Creditor ledger. */
export async function ledgerForCreditor(creditorId: string, range: LedgerDateRange = {}) {
  const rows = await db.ledgerEntry.findMany({
    where: { creditorId },
    orderBy: orderChronological,
  });
  return buildLedgerView(rows, range);
}

/**
 * Expense ledger — flat, not party-scoped: every PAYMENT-sourced entry whose
 * category snapshot is EXPENSE, across all creditors/payees. `runningBalance`
 * here reads as "net expense so far" (OUT entries minus any IN reversal rows
 * from an un-approved/deleted expense payment), not an account balance.
 */
export async function ledgerForExpenseCategory(range: LedgerDateRange = {}) {
  const rows = await db.ledgerEntry.findMany({
    where: { sourceType: "PAYMENT", category: "EXPENSE" },
    orderBy: orderChronological,
  });
  return buildLedgerView(rows, range);
}
