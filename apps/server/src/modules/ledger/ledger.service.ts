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

/**
 * Bank or Cash ledger — which one it "is" is just this account's own `type`.
 * Reads the real double-entry `JournalLine`s on the account's GL ledger
 * (Ledger.cashAccountId), like the Creditor fix: the legacy `LedgerEntry`
 * table only ever got Receipts and Cash Planning, so vendor disbursements,
 * driver salary / advances / payments and every other voucher that moves
 * cash or bank were missing. Receipts post a voucher too, so they still show.
 * A debit is money in (`IN`), a credit money out (`OUT`). Reversed vouchers
 * and their reversals are both counted — they cancel out.
 */
export async function ledgerForAccount(accountId: string, range: LedgerDateRange = {}) {
  const ledger = await db.ledger.findUnique({
    where: { cashAccountId: accountId },
    select: { id: true },
  });
  if (!ledger) return buildLedgerView([], range);
  const lines = await db.journalLine.findMany({
    where: {
      ledgerId: ledger.id,
      journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
    },
    select: {
      id: true,
      debitPaise: true,
      creditPaise: true,
      narration: true,
      lineNumber: true,
      journalEntry: {
        select: {
          voucherDate: true,
          voucherType: true,
          voucherNumber: true,
          narration: true,
          sourceType: true,
          sourceId: true,
          createdAt: true,
        },
      },
    },
    orderBy: [
      { journalEntry: { voucherDate: "asc" } },
      { journalEntry: { createdAt: "asc" } },
      { lineNumber: "asc" },
    ],
  });
  // On the same date the opening balance comes first, so the running balance
  // starts from it.
  const day = (d: Date) => d.toISOString().slice(0, 10);
  lines.sort((a, b) => {
    const byDay = day(a.journalEntry.voucherDate).localeCompare(day(b.journalEntry.voucherDate));
    if (byDay) return byDay;
    const aOpen = a.journalEntry.sourceType === "OPENING_BALANCE" ? 0 : 1;
    const bOpen = b.journalEntry.sourceType === "OPENING_BALANCE" ? 0 : 1;
    return aOpen - bOpen;
  });
  // Asset account: the mapper's liability reading is flipped (debit = in).
  const rows = lines.map((l) => {
    const row = journalLineToLedgerRow(l);
    return { ...row, cashAccountId: accountId, direction: row.direction === "IN" ? "OUT" : "IN" } as const;
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

/**
 * Creditor ledger — reads the real double-entry `JournalLine`s posted against
 * this party's `Ledger` row (`kind: "PARTY"`, group `SUNDRY_CREDITOR`),
 * exactly like the Debtor statement fix: `LedgerEntry` is a cash-movement
 * mirror that Workshop postings (PO/Inward/Job Card/Service Bill — see
 * `posting.service.ts`) never write to, so it silently hid that activity.
 * `ledgerId` here is the `Ledger.id`, not a `Creditor.id` — the party picker
 * now sources both `Creditor` and `SparePartSupplier` rows from
 * `GET /ledger/accounts?group=SUNDRY_CREDITOR`, which already returns
 * `Ledger.id`. A credit line increases what we owe (liability up, `IN`); a
 * debit line (payment / credit note) reduces it (`OUT`).
 */
export async function ledgerForCreditor(ledgerId: string, range: LedgerDateRange = {}) {
  const lines = await db.journalLine.findMany({
    where: {
      ledgerId,
      // POSTED *and* REVERSED: a reversed voucher and its contra cancel out.
      // Counting POSTED only kept the contra alone, so a reversal swung the
      // balance the wrong way instead of back to zero.
      journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
    },
    select: {
      id: true,
      debitPaise: true,
      creditPaise: true,
      narration: true,
      lineNumber: true,
      journalEntry: {
        select: {
          voucherDate: true,
          voucherType: true,
          voucherNumber: true,
          narration: true,
          sourceType: true,
          sourceId: true,
          createdAt: true,
        },
      },
    },
    orderBy: [
      { journalEntry: { voucherDate: "asc" } },
      { journalEntry: { createdAt: "asc" } },
      { lineNumber: "asc" },
    ],
  });
  return buildLedgerView(lines.map(journalLineToLedgerRow), range);
}

/**
 * Expense ledger — flat, not party-scoped: every `JournalLine` posted to a
 * DIRECT_EXPENSE/INDIRECT_EXPENSE GL head (e.g. `REPAIR_EXPENSE`), across all
 * sources. Reads `JournalLine`/`Ledger` for the same reason as the Creditor
 * fix above — the old `LedgerEntry`-based read never saw Workshop's
 * `REPAIR_EXPENSE` postings. `runningBalance` reads as "net expense so far":
 * a debit (expense incurred) is `OUT`, a credit (reversal/return) is `IN`.
 */
export async function ledgerForExpenseCategory(range: LedgerDateRange = {}) {
  const lines = await db.journalLine.findMany({
    where: {
      // POSTED *and* REVERSED: a reversed voucher and its contra cancel out.
      // Counting POSTED only kept the contra alone, so a reversal swung the
      // balance the wrong way instead of back to zero.
      journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
      ledger: { group: { in: ["DIRECT_EXPENSE", "INDIRECT_EXPENSE"] } },
    },
    select: {
      id: true,
      debitPaise: true,
      creditPaise: true,
      narration: true,
      lineNumber: true,
      journalEntry: {
        select: {
          voucherDate: true,
          voucherType: true,
          voucherNumber: true,
          narration: true,
          sourceType: true,
          sourceId: true,
          createdAt: true,
        },
      },
    },
    orderBy: [
      { journalEntry: { voucherDate: "asc" } },
      { journalEntry: { createdAt: "asc" } },
      { lineNumber: "asc" },
    ],
  });
  return buildLedgerView(lines.map(journalLineToLedgerRow), range);
}

type JournalLineForLedger = {
  id: string;
  debitPaise: bigint;
  creditPaise: bigint;
  narration: string | null;
  lineNumber: number;
  journalEntry: {
    voucherDate: Date;
    voucherType: string;
    voucherNumber: string;
    narration: string | null;
    sourceType: string;
    sourceId: string;
    createdAt: Date;
  };
};

/**
 * `LedgerEntryRow.sourceType` (shared @skerp/types) is the 3-value
 * `LedgerSourceType` the Bank/Cash tabs' `LedgerEntry` rows use; a
 * `JournalEntry` carries the richer `JournalSourceType` (BILL, PURCHASE_INWARD,
 * JOB_CARD, SERVICE_BILL, ...). Rather than widen the shared UI type just for
 * badge coloring, collapse to the closest bucket: an actual outgoing payment
 * reads as PAYMENT, everything else posted here (bills/accruals — PO Inward,
 * Job Card, Service Bill, Supplier Replacement, manual/credit-note journals)
 * reads as ADJUSTMENT, same as non-cash entries already do on the legacy tabs.
 */
function journalSourceTypeToLedgerSourceType(sourceType: string): LedgerSourceType {
  if (
    sourceType === "VENDOR_PAYMENT" ||
    sourceType === "DRIVER_PAYOUT" ||
    sourceType === "DRIVER_SALARY_ADVANCE"
  )
    return "PAYMENT";
  if (sourceType === "RECEIPT") return "RECEIPT";
  return "ADJUSTMENT";
}

/** Debit line -> "OUT" (paid / expense incurred), credit line -> "IN"
 *  (owed / reversed) — matches the `LedgerRow` shape `buildLedgerView`
 *  already knows how to run a balance over. */
function journalLineToLedgerRow(l: JournalLineForLedger): LedgerRow {
  const isDebit = Number(l.debitPaise) > 0;
  return {
    id: l.id,
    occurredAt: l.journalEntry.voucherDate,
    direction: isDebit ? "OUT" : "IN",
    amountPaise: isDebit ? l.debitPaise : l.creditPaise,
    cashAccountId: null,
    customerId: null,
    creditorId: null,
    category: null,
    sourceType: journalSourceTypeToLedgerSourceType(l.journalEntry.sourceType),
    sourceId: l.journalEntry.sourceId,
    description:
      l.narration?.trim() ||
      l.journalEntry.narration?.trim() ||
      `${l.journalEntry.voucherType} · ${l.journalEntry.voucherNumber}`,
    createdById: "",
    createdAt: l.journalEntry.createdAt,
  };
}
