import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError, NotFoundError } from "../../lib/error.js";
import { fyCodeFor } from "../_shared/doc-number.js";
import { getCashLedger, postJournal, reverseJournal } from "./posting.service.js";

/**
 * Opening balances for cash / bank accounts. The ERP only knows money it
 * recorded, so an account that already held cash when the ERP started shows
 * too little (often negative). The user types the REAL balance as on a date;
 * we post the difference against "Opening Balance (Suspense)" so the ERP
 * balance at the start of that date equals what they typed:
 *
 *   adjustment = typed balance − ERP balance before that date
 *   Dr Cash/Bank, Cr Suspense  (or the other way round when negative)
 *
 * Correcting it reverses the previous adjustment and posts a new one.
 */

type Tx = Prisma.TransactionClient;

export const OPENING_BALANCE_SUSPENSE_CODE = "OPENING_BALANCE";

/** The suspense GL — created here if the chart of accounts seed missed it. */
async function suspenseLedger(tx: Tx) {
  const existing = await tx.ledger.findUnique({ where: { code: OPENING_BALANCE_SUSPENSE_CODE } });
  if (existing) return existing;
  return tx.ledger.create({
    data: {
      kind: "GL",
      code: OPENING_BALANCE_SUSPENSE_CODE,
      name: "Opening Balance (Suspense)",
      group: "CURRENT_LIABILITY",
    },
  });
}

/** Every voucher except opening-balance adjustments and their reversals. */
const notOpeningBalance: Prisma.JournalEntryWhereInput = {
  sourceType: { not: "OPENING_BALANCE" },
  OR: [{ reversesId: null }, { reverses: { sourceType: { not: "OPENING_BALANCE" } } }],
};

/** Dr − Cr on a cash / bank ledger (positive = money in the account). */
async function ledgerSum(client: Tx | typeof db, where: Prisma.JournalLineWhereInput) {
  const sums = await client.journalLine.aggregate({
    where,
    _sum: { debitPaise: true, creditPaise: true },
  });
  return (sums._sum.debitPaise ?? 0n) - (sums._sum.creditPaise ?? 0n);
}

/** Balance of a cash / bank ledger now (everything posted, reversals net out). */
export async function cashLedgerBalance(client: Tx | typeof db, ledgerId: string) {
  return ledgerSum(client, {
    ledgerId,
    journalEntry: { status: { in: ["POSTED", "REVERSED"] } },
  });
}

/** Every active cash / bank account with its opening balance and balance now. */
export async function listOpeningBalances() {
  const accounts = await db.cashAccount.findMany({
    where: { deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      bankName: true,
      accountLast4: true,
      ledger: { select: { id: true } },
      opening: {
        select: {
          asOf: true,
          amountPaise: true,
          updatedAt: true,
          updatedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return Promise.all(
    accounts.map(async (a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      bankName: a.bankName,
      accountLast4: a.accountLast4,
      opening: a.opening,
      balancePaise: a.ledger ? await cashLedgerBalance(db, a.ledger.id) : 0n,
    })),
  );
}

/**
 * Set (or correct) an account's opening balance as on `asOf`. `amountPaise`
 * may be negative (an overdrawn bank).
 */
export async function setOpeningBalance(input: {
  cashAccountId: string;
  asOf: Date;
  amountPaise: bigint;
  actorId: string;
}) {
  const account = await db.cashAccount.findFirst({
    where: { id: input.cashAccountId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!account) throw new NotFoundError("Cash / bank account not found");
  if (input.asOf > new Date())
    throw new BadRequestError("The opening balance date cannot be in the future");

  const ho = await db.branch.findFirst({ where: { isHeadOffice: true }, select: { id: true } });
  if (!ho) throw new BadRequestError("No head-office branch is set in the Branch master");

  return db.$transaction(async (tx) => {
    const cashLedger = await getCashLedger(tx, account.id);
    const suspense = await suspenseLedger(tx);
    const previous = await tx.cashAccountOpening.findUnique({
      where: { cashAccountId: account.id },
    });

    // Undo the previous adjustment first, so it isn't counted below.
    if (previous?.journalEntryId) {
      const prevEntry = await tx.journalEntry.findUnique({
        where: { id: previous.journalEntryId },
        select: { status: true },
      });
      if (prevEntry?.status === "POSTED")
        await reverseJournal(tx, previous.journalEntryId, "Opening balance corrected", input.actorId);
    }

    const erpBefore = await ledgerSum(tx, {
      ledgerId: cashLedger.id,
      journalEntry: {
        status: { in: ["POSTED", "REVERSED"] },
        voucherDate: { lt: input.asOf },
        ...notOpeningBalance,
      },
    });
    const adjustment = input.amountPaise - erpBefore;

    let journalEntryId: string | null = null;
    if (adjustment !== 0n) {
      const version = (await tx.journalEntry.count({
        where: { sourceType: "OPENING_BALANCE", sourceId: { startsWith: `${account.id}:` } },
      })) + 1;
      const amount = adjustment > 0n ? adjustment : -adjustment;
      const narration = `Opening balance ${account.name} as on ${input.asOf
        .toISOString()
        .slice(0, 10)}`;
      const entry = await postJournal(tx, {
        voucherType: "JOURNAL",
        voucherNumber: `OB/${account.id.slice(-6).toUpperCase()}/${version}`,
        voucherDate: input.asOf,
        fyCode: fyCodeFor(input.asOf),
        branchId: ho.id,
        narration,
        sourceType: "OPENING_BALANCE",
        sourceId: `${account.id}:${version}`,
        sourceNumber: account.name,
        createdById: input.actorId,
        lines:
          adjustment > 0n
            ? [
                { ledgerId: cashLedger.id, debitPaise: amount, creditPaise: 0n, narration },
                { ledgerId: suspense.id, debitPaise: 0n, creditPaise: amount, narration },
              ]
            : [
                { ledgerId: suspense.id, debitPaise: amount, creditPaise: 0n, narration },
                { ledgerId: cashLedger.id, debitPaise: 0n, creditPaise: amount, narration },
              ],
      });
      journalEntryId = entry.id;
    }

    return tx.cashAccountOpening.upsert({
      where: { cashAccountId: account.id },
      create: {
        cashAccountId: account.id,
        asOf: input.asOf,
        amountPaise: input.amountPaise,
        journalEntryId,
        updatedById: input.actorId,
      },
      update: {
        asOf: input.asOf,
        amountPaise: input.amountPaise,
        journalEntryId,
        updatedById: input.actorId,
      },
    });
  });
}
