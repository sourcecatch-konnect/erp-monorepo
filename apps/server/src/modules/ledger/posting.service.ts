import {
  Prisma,
  type AllocationRefType,
  type BillTaxType,
  type CreditorCategory,
  type JournalSourceType,
  type LedgerAccountGroup,
  type LRChargeEffect,
  type LRChargeType,
  type VoucherType,
} from "../../../generated/prisma/index.js";
import { BadRequestError } from "../../lib/error.js";

type Tx = Prisma.TransactionClient;

/* ------------------------------------------------------------------ */
/* Chart-of-accounts lookups                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch a seeded GL ledger by its stable `code`. Throws (not user error —
 * a setup problem) if the chart of accounts has not been seeded.
 */
export async function getGLLedger(tx: Tx, code: string) {
  const ledger = await tx.ledger.findUnique({ where: { code } });
  if (!ledger)
    throw new BadRequestError(
      `Chart of accounts is missing the "${code}" ledger. Run: pnpm exec tsx prisma/seed-ledger.ts`,
    );
  return ledger;
}

/** Bank / Cash ledger for a CashAccount — created lazily if the seed missed it. */
export async function getCashLedger(tx: Tx, cashAccountId: string) {
  const existing = await tx.ledger.findUnique({ where: { cashAccountId } });
  if (existing) return existing;
  const account = await tx.cashAccount.findUnique({
    where: { id: cashAccountId },
    select: { id: true, name: true, type: true },
  });
  if (!account) throw new BadRequestError("Cash account not found");
  return tx.ledger.create({
    data: {
      kind: "GL",
      name: account.name,
      group: account.type === "BANK" ? "BANK" : "CASH",
      cashAccountId: account.id,
    },
  });
}

export type PartyRef =
  | { customerId: string }
  | { transportId: string }
  | { creditorId: string }
  | { labourId: string }
  | { pumpId: string };

/** The single party FK for this ref, as a plain object usable in both
 *  `findUnique({ where })` and `create({ data })`. */
const partyFk = (ref: PartyRef) =>
  "customerId" in ref
    ? { customerId: ref.customerId }
    : "transportId" in ref
      ? { transportId: ref.transportId }
      : "creditorId" in ref
        ? { creditorId: ref.creditorId }
        : "labourId" in ref
          ? { labourId: ref.labourId }
          : { pumpId: ref.pumpId };

/**
 * Get the party ledger for a customer / vendor, creating it on first use.
 * Idempotent — the party FK is `@unique`. Two masters can legitimately share
 * a display name, so name is NOT unique; a P2002 here can only be a race on
 * the same party FK, which we recover by re-reading.
 */
export async function getOrCreatePartyLedger(tx: Tx, ref: PartyRef) {
  const where = partyFk(ref);
  const existing = await tx.ledger.findUnique({ where });
  if (existing) return existing;

  let name: string;
  let group: LedgerAccountGroup;
  if ("customerId" in ref) {
    const row = await tx.customer.findUnique({
      where: { id: ref.customerId },
      select: { name: true },
    });
    if (!row) throw new BadRequestError("Customer not found");
    name = row.name;
    group = "SUNDRY_DEBTOR";
  } else if ("transportId" in ref) {
    const row = await tx.transport.findUnique({
      where: { id: ref.transportId },
      select: { name: true },
    });
    if (!row) throw new BadRequestError("Transport not found");
    name = row.name;
    group = "SUNDRY_CREDITOR";
  } else if ("creditorId" in ref) {
    const row = await tx.creditor.findUnique({
      where: { id: ref.creditorId },
      select: { name: true },
    });
    if (!row) throw new BadRequestError("Creditor not found");
    name = row.name;
    group = "SUNDRY_CREDITOR";
  } else if ("labourId" in ref) {
    const row = await tx.labour.findUnique({
      where: { id: ref.labourId },
      select: { name: true },
    });
    if (!row) throw new BadRequestError("Labour not found");
    name = row.name;
    group = "SUNDRY_CREDITOR";
  } else {
    const row = await tx.pump.findUnique({
      where: { id: ref.pumpId },
      select: { name: true },
    });
    if (!row) throw new BadRequestError("Pump not found");
    name = row.name;
    group = "SUNDRY_CREDITOR";
  }

  try {
    return await tx.ledger.create({
      data: {
        kind: "PARTY",
        name,
        group,
        ...where,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const again = await tx.ledger.findUnique({ where });
      if (again) return again;
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Core posting                                                        */
/* ------------------------------------------------------------------ */

export type DraftLine = {
  ledgerId: string;
  debitPaise: bigint;
  creditPaise: bigint;
  narration?: string | null;
};

export type DraftAllocation = {
  /** index into the `lines` array of the party line this ref sits on */
  lineIndex: number;
  billId: string;
  refType: AllocationRefType;
  amountPaise: bigint;
};

export type PostJournalArgs = {
  voucherType: VoucherType;
  voucherNumber: string;
  voucherDate: Date;
  fyCode: string;
  branchId: string;
  narration?: string | null;
  sourceType: JournalSourceType;
  sourceId: string;
  sourceNumber?: string | null;
  reversesId?: string | null;
  createdById: string;
  lines: DraftLine[];
  allocations?: DraftAllocation[];
};

/**
 * Write one balanced voucher (header + lines + optional bill allocations).
 * MUST run inside the caller's transaction. Rejects an unbalanced or
 * malformed voucher before any write.
 */
export async function postJournal(tx: Tx, args: PostJournalArgs) {
  if (args.lines.length < 2)
    throw new BadRequestError("A voucher needs at least two lines");

  let totalDebit = 0n;
  let totalCredit = 0n;
  for (const line of args.lines) {
    if (line.debitPaise < 0n || line.creditPaise < 0n)
      throw new BadRequestError("Journal line amounts must be non-negative");
    if (line.debitPaise > 0n === line.creditPaise > 0n)
      throw new BadRequestError(
        "Each journal line must be exactly one of debit or credit",
      );
    totalDebit += line.debitPaise;
    totalCredit += line.creditPaise;
  }
  if (totalDebit !== totalCredit)
    throw new BadRequestError(
      `Voucher does not balance: Dr ${totalDebit} vs Cr ${totalCredit}`,
    );

  const entry = await tx.journalEntry.create({
    data: {
      voucherType: args.voucherType,
      voucherNumber: args.voucherNumber,
      voucherDate: args.voucherDate,
      fyCode: args.fyCode,
      branchId: args.branchId,
      narration: args.narration ?? null,
      status: "POSTED",
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      sourceNumber: args.sourceNumber ?? null,
      reversesId: args.reversesId ?? null,
      createdById: args.createdById,
      postedById: args.createdById,
      postedAt: new Date(),
      lines: {
        create: args.lines.map((line, index) => ({
          lineNumber: index + 1,
          ledgerId: line.ledgerId,
          debitPaise: line.debitPaise,
          creditPaise: line.creditPaise,
          narration: line.narration ?? null,
        })),
      },
    },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });

  if (args.allocations?.length) {
    await tx.ledgerAllocation.createMany({
      data: args.allocations.map((alloc) => {
        const line = entry.lines[alloc.lineIndex];
        if (!line)
          throw new BadRequestError("Allocation points at a non-existent line");
        return {
          journalEntryId: entry.id,
          journalLineId: line.id,
          billId: alloc.billId,
          refType: alloc.refType,
          amountPaise: alloc.amountPaise,
        };
      }),
    });
  }

  return entry;
}

/* ------------------------------------------------------------------ */
/* Sales voucher (bill finalise)                                       */
/* ------------------------------------------------------------------ */

const INCOME_CODE: Record<LRChargeType, string> = {
  FREIGHT: "FREIGHT_INCOME",
  DETENTION: "DETENTION_INCOME",
  HAMALI: "UNLOADING_INCOME",
  UNLOADING: "UNLOADING_INCOME",
  TOLL: "FREIGHT_INCOME",
  MULTIPOINT: "FREIGHT_INCOME",
  FREIGHT_ADJUSTMENT: "FREIGHT_ADJUSTMENT",
  DAMAGE_DEDUCTION: "DAMAGE_DEDUCTION",
  OTHER: "FREIGHT_INCOME",
};

const TAX_CODE: Record<BillTaxType, string> = {
  CGST: "OUTPUT_CGST",
  SGST: "OUTPUT_SGST",
  IGST: "OUTPUT_IGST",
};

export type SalesVoucherArgs = {
  billId: string;
  billNumber: string;
  billDate: Date;
  branchId: string;
  fyCode: string;
  customerId: string;
  totalAmountPaise: bigint;
  roundOffPaise: bigint;
  lines: {
    chargeType: LRChargeType;
    effect: LRChargeEffect;
    amountPaise: bigint;
  }[];
  taxLines: { taxType: BillTaxType; taxAmountPaise: bigint }[];
  createdById: string;
};

/**
 * Post the SALES voucher for a finalised bill:
 *   Dr  customer party ledger        = bill total     (+ NEW_REF allocation)
 *   Cr  income GL per charge type    (Dr for DEDUCTION lines)
 *   Cr  OUTPUT_CGST / SGST / IGST    from the frozen tax lines
 *   Dr/Cr ROUND_OFF                  = the bill's round-off
 * The voucher number is the bill number (1:1).
 */
export async function postSalesVoucher(tx: Tx, args: SalesVoucherArgs) {
  // Net the movement per GL code so a code hit by both an addition and a
  // deduction collapses to a single line.
  const net = new Map<string, bigint>(); // code -> credit-positive net
  const add = (code: string, delta: bigint) =>
    net.set(code, (net.get(code) ?? 0n) + delta);

  for (const line of args.lines) {
    const code = INCOME_CODE[line.chargeType];
    add(code, line.effect === "DEDUCTION" ? -line.amountPaise : line.amountPaise);
  }
  for (const tax of args.taxLines) {
    if (tax.taxAmountPaise !== 0n) add(TAX_CODE[tax.taxType], tax.taxAmountPaise);
  }
  if (args.roundOffPaise !== 0n) add("ROUND_OFF", args.roundOffPaise);

  const customerLedger = await getOrCreatePartyLedger(tx, {
    customerId: args.customerId,
  });

  const lines: DraftLine[] = [
    {
      ledgerId: customerLedger.id,
      debitPaise: args.totalAmountPaise,
      creditPaise: 0n,
      narration: `Bill ${args.billNumber}`,
    },
  ];

  for (const [code, amount] of net) {
    if (amount === 0n) continue;
    const ledger = await getGLLedger(tx, code);
    lines.push(
      amount > 0n
        ? { ledgerId: ledger.id, debitPaise: 0n, creditPaise: amount }
        : { ledgerId: ledger.id, debitPaise: -amount, creditPaise: 0n },
    );
  }

  return postJournal(tx, {
    voucherType: "SALES",
    voucherNumber: args.billNumber,
    voucherDate: args.billDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: `Sales — bill ${args.billNumber}`,
    sourceType: "BILL",
    sourceId: args.billId,
    sourceNumber: args.billNumber,
    createdById: args.createdById,
    lines,
    allocations: [
      {
        lineIndex: 0,
        billId: args.billId,
        refType: "NEW_REF",
        amountPaise: args.totalAmountPaise,
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Receipt voucher (customer payment)                                  */
/* ------------------------------------------------------------------ */

export type ReceiptVoucherArgs = {
  receiptId: string;
  receiptNumber: string;
  receivedAt: Date;
  branchId: string;
  fyCode: string;
  customerId: string;
  cashAccountId: string;
  allocations: {
    billId: string;
    amountAppliedPaise: bigint;
    tdsAmountPaise: bigint;
    damageAmountPaise: bigint;
    rateDiffAmountPaise: bigint;
  }[];
  createdById: string;
};

/**
 * Post the RECEIPT voucher for a posted receipt:
 *   Dr  Bank/Cash account         = cash actually received
 *   Dr  TDS Receivable            = TDS deducted by the customer
 *   Dr  Damage Deduction          = damage claimed against the payment
 *   Dr/Cr Rate Difference         = net rate adjustment (either direction)
 *   Cr  customer party ledger     = total settled  (+ one AGAINST_REF
 *       allocation per bill in the receipt, closing what the sales
 *       voucher opened)
 * The voucher number is the receipt number (1:1), same pattern as SALES
 * reusing the bill number.
 */
export async function postReceiptVoucher(tx: Tx, args: ReceiptVoucherArgs) {
  const cashLedger = await getCashLedger(tx, args.cashAccountId);
  const customerLedger = await getOrCreatePartyLedger(tx, {
    customerId: args.customerId,
  });

  const amountAppliedTotal = args.allocations.reduce(
    (sum, a) => sum + a.amountAppliedPaise,
    0n,
  );

  // Net the deduction movement per GL code — debit-positive here (opposite
  // sign convention to postSalesVoucher's credit-positive net, because
  // these are all debits from the business's point of view).
  const net = new Map<string, bigint>();
  const add = (code: string, delta: bigint) =>
    net.set(code, (net.get(code) ?? 0n) + delta);
  for (const a of args.allocations) {
    if (a.tdsAmountPaise !== 0n) add("TDS_RECEIVABLE", a.tdsAmountPaise);
    if (a.damageAmountPaise !== 0n) add("DAMAGE_DEDUCTION", a.damageAmountPaise);
    if (a.rateDiffAmountPaise !== 0n) add("RATE_DIFFERENCE", a.rateDiffAmountPaise);
  }

  const lines: DraftLine[] = [];
  // A receipt fully absorbed by deductions (no cash at all) is a degenerate
  // edge case, but skip the cash line rather than post a zero-amount line —
  // postJournal rejects a line that is neither a debit nor a credit.
  if (amountAppliedTotal !== 0n) {
    lines.push({
      ledgerId: cashLedger.id,
      debitPaise: amountAppliedTotal,
      creditPaise: 0n,
      narration: `Receipt ${args.receiptNumber}`,
    });
  }

  for (const [code, amount] of net) {
    if (amount === 0n) continue;
    const ledger = await getGLLedger(tx, code);
    lines.push(
      amount > 0n
        ? { ledgerId: ledger.id, debitPaise: amount, creditPaise: 0n }
        : { ledgerId: ledger.id, debitPaise: 0n, creditPaise: -amount },
    );
  }

  const customerLineIndex = lines.length;
  const totalSettled = lines.reduce(
    (sum, line) => sum + line.debitPaise - line.creditPaise,
    0n,
  );
  lines.push({
    ledgerId: customerLedger.id,
    debitPaise: 0n,
    creditPaise: totalSettled,
    narration: `Receipt ${args.receiptNumber}`,
  });

  return postJournal(tx, {
    voucherType: "RECEIPT",
    voucherNumber: args.receiptNumber,
    voucherDate: args.receivedAt,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: `Receipt — ${args.receiptNumber}`,
    sourceType: "RECEIPT",
    sourceId: args.receiptId,
    sourceNumber: args.receiptNumber,
    createdById: args.createdById,
    lines,
    allocations: args.allocations.map((a) => ({
      lineIndex: customerLineIndex,
      billId: a.billId,
      refType: "AGAINST_REF" as const,
      amountPaise:
        a.amountAppliedPaise +
        a.tdsAmountPaise +
        a.damageAmountPaise +
        a.rateDiffAmountPaise,
    })),
  });
}

/* ------------------------------------------------------------------ */
/* Payment voucher (money paid out — CashPayment)                      */
/* ------------------------------------------------------------------ */

// Expense head debited for a payment with no creditor, keyed by the
// CashPayment's CreditorCategory. Codes must match seed-ledger.ts.
const PAYMENT_CATEGORY_EXPENSE_CODE: Record<CreditorCategory, string> = {
  DIESEL: "DIESEL_EXPENSE",
  RENT: "RENT_EXPENSE",
  FREIGHT: "FREIGHT_EXPENSE",
  EXPENSE: "GENERAL_EXPENSE",
  REPAIR: "REPAIR_EXPENSE",
  OTHER: "MISC_EXPENSE",
};

export type PaymentVoucherArgs = {
  paymentId: string;
  /** Voucher's `sourceId`; defaults to `paymentId`. The caller suffixes it
   *  (`<id>#2`) on re-approval so it stays unique across bounce cycles. */
  sourceId?: string;
  paymentNumber: string;
  paymentDate: Date;
  branchId: string;
  fyCode: string;
  cashAccountId: string;
  amountPaise: bigint;
  creditorId: string | null;
  category: CreditorCategory;
  payeeName: string;
  narration?: string | null;
  createdById: string;
};

/**
 * Post the PAYMENT voucher for an approved CashPayment:
 *   Dr  creditor party ledger    when a creditor is selected
 *   Dr  <category> expense GL     when the payee is an ad-hoc typed name
 *   Cr  Bank/Cash account         = amount paid
 * Voucher number is a PV-series number — a CashPayment has no number of its own.
 */
export async function postPaymentVoucher(tx: Tx, args: PaymentVoucherArgs) {
  const cashLedger = await getCashLedger(tx, args.cashAccountId);

  const debitLedger = args.creditorId
    ? await getOrCreatePartyLedger(tx, { creditorId: args.creditorId })
    : await getGLLedger(tx, PAYMENT_CATEGORY_EXPENSE_CODE[args.category]);

  const lineNarration = args.narration ?? `Payment to ${args.payeeName}`;

  return postJournal(tx, {
    voucherType: "PAYMENT",
    voucherNumber: args.paymentNumber,
    voucherDate: args.paymentDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: `Payment — ${args.paymentNumber}`,
    sourceType: "VENDOR_PAYMENT",
    sourceId: args.sourceId ?? args.paymentId,
    sourceNumber: args.paymentNumber,
    createdById: args.createdById,
    lines: [
      {
        ledgerId: debitLedger.id,
        debitPaise: args.amountPaise,
        creditPaise: 0n,
        narration: lineNarration,
      },
      {
        ledgerId: cashLedger.id,
        debitPaise: 0n,
        creditPaise: args.amountPaise,
        narration: lineNarration,
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Reversal (bill cancel / credit note)                                */
/* ------------------------------------------------------------------ */

/**
 * Post a contra JOURNAL voucher that cancels `journalEntryId` (lines swapped
 * Dr<->Cr) and mark the original REVERSED. Idempotent — a second call on an
 * already-reversed voucher is a no-op.
 */
export async function reverseJournal(
  tx: Tx,
  journalEntryId: string,
  reason: string,
  createdById: string,
) {
  const original = await tx.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: {
      lines: { orderBy: { lineNumber: "asc" } },
      allocations: true,
    },
  });
  if (!original) throw new BadRequestError("Voucher not found");
  if (original.status === "REVERSED") return original;

  const lineIndexById = new Map(
    original.lines.map((line, index) => [line.id, index]),
  );

  const contra = await postJournal(tx, {
    voucherType: "JOURNAL",
    voucherNumber: `REV/${original.voucherNumber}`,
    voucherDate: new Date(),
    fyCode: original.fyCode,
    branchId: original.branchId,
    narration: `Reversal of ${original.voucherType} ${original.voucherNumber} — ${reason}`,
    sourceType: "MANUAL",
    sourceId: original.id,
    sourceNumber: original.voucherNumber,
    reversesId: original.id,
    createdById,
    lines: original.lines.map((line) => ({
      ledgerId: line.ledgerId,
      debitPaise: line.creditPaise,
      creditPaise: line.debitPaise,
    })),
    // Mirror every allocation onto the contra with its refType flipped:
    // a NEW_REF (e.g. a sale opening the bill's outstanding) closes as
    // AGAINST_REF, and an AGAINST_REF (e.g. a receipt settling the bill)
    // reopens as NEW_REF. Symmetric regardless of which voucher type — a
    // sales voucher or a receipt voucher — is being reversed.
    allocations: original.allocations.map((alloc) => ({
      lineIndex: lineIndexById.get(alloc.journalLineId) ?? 0,
      billId: alloc.billId,
      refType:
        alloc.refType === "NEW_REF"
          ? ("AGAINST_REF" as const)
          : ("NEW_REF" as const),
      amountPaise: alloc.amountPaise,
    })),
  });

  await tx.journalEntry.update({
    where: { id: original.id },
    data: { status: "REVERSED" },
  });

  return contra;
}
