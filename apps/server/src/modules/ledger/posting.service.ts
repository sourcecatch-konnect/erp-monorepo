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
  | { pumpId: string }
  | { sparePartSupplierId: string }
  | { driverId: string };

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
          : "pumpId" in ref
            ? { pumpId: ref.pumpId }
            : "sparePartSupplierId" in ref
              ? { sparePartSupplierId: ref.sparePartSupplierId }
              : { driverId: ref.driverId };

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
  } else if ("pumpId" in ref) {
    const row = await tx.pump.findUnique({
      where: { id: ref.pumpId },
      select: { name: true },
    });
    if (!row) throw new BadRequestError("Pump not found");
    name = row.name;
    group = "SUNDRY_CREDITOR";
  } else if ("sparePartSupplierId" in ref) {
    const row = await tx.sparePartSupplier.findUnique({
      where: { id: ref.sparePartSupplierId },
      select: { name: true },
    });
    if (!row) throw new BadRequestError("Spare part supplier not found");
    name = row.name;
    group = "SUNDRY_CREDITOR";
  } else {
    const row = await tx.driver.findUnique({
      where: { id: ref.driverId },
      select: { name: true },
    });
    if (!row) throw new BadRequestError("Driver not found");
    name = row.name;
    // A driver's ledger swings both ways: it's a Dr balance (receivable —
    // they still owe unspent advance) most of the time, but Cr (payable —
    // company owes them a settlement) whenever cash expenses exceed the
    // advance. CURRENT_ASSET is the more common case; the balance itself
    // is signed either way regardless of the group bucket.
    group = "CURRENT_ASSET";
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

  // Parent row, then lines via createManyAndReturn — nested `lines: {
  // create: [...] }` issues one INSERT per line instead of a single batched
  // statement; every voucher across every module (Spare Inward, Job Card,
  // Service Bill, Supplier Replacement, Billing, Receipts) goes through
  // this one function, so this was a systemic cost, not a one-off.
  const entryRow = await tx.journalEntry.create({
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
    },
  });

  const createdLines = await tx.journalLine.createManyAndReturn({
    data: args.lines.map((line, index) => ({
      journalEntryId: entryRow.id,
      lineNumber: index + 1,
      ledgerId: line.ledgerId,
      debitPaise: line.debitPaise,
      creditPaise: line.creditPaise,
      narration: line.narration ?? null,
    })),
  });
  // createManyAndReturn doesn't guarantee row order matches input order —
  // sort explicitly (mirrors the previous `orderBy: { lineNumber: "asc" }`
  // on the nested include) since callers index into `entry.lines` by
  // position (see `allocations` below).
  const lines = [...createdLines].sort((a, b) => a.lineNumber - b.lineNumber);
  const entry = { ...entryRow, lines };

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

export type SpareInwardVoucherArgs = {
  inwardId: string;
  inwardNumber: string;
  inwardDate: Date;
  branchId: string;
  fyCode: string;
  supplierId: string;
  payableAmountPaise: bigint;
  createdById: string;
};

/**
 * Post the accrual voucher for a posted SpareInward:
 *   Dr  Spare Parts Inventory (GL)
 *   Cr  supplier party ledger      = payable amount (net of discount)
 * Voucher number is the inward number — a SpareInward is billed 1:1, like a
 * SALES voucher reuses the bill number.
 */
export async function postSpareInwardVoucher(tx: Tx, args: SpareInwardVoucherArgs) {
  const [inventoryLedger, supplierLedger] = await Promise.all([
    getGLLedger(tx, "SPARE_PARTS_INVENTORY"),
    getOrCreatePartyLedger(tx, { sparePartSupplierId: args.supplierId }),
  ]);

  const lineNarration = `Inward ${args.inwardNumber}`;

  return postJournal(tx, {
    voucherType: "JOURNAL",
    voucherNumber: args.inwardNumber,
    voucherDate: args.inwardDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: lineNarration,
    sourceType: "PURCHASE_INWARD",
    sourceId: args.inwardId,
    sourceNumber: args.inwardNumber,
    createdById: args.createdById,
    lines: [
      {
        ledgerId: inventoryLedger.id,
        debitPaise: args.payableAmountPaise,
        creditPaise: 0n,
        narration: lineNarration,
      },
      {
        ledgerId: supplierLedger.id,
        debitPaise: 0n,
        creditPaise: args.payableAmountPaise,
        narration: lineNarration,
      },
    ],
  });
}

export type JobCardVoucherArgs = {
  jobCardId: string;
  jobCardNumber: string;
  finaliseDate: Date;
  branchId: string;
  fyCode: string;
  totalPartsAmountPaise: bigint;
  createdById: string;
};

/**
 * Post the parts-consumption voucher when a Job Card is finalised:
 *   Dr  Vehicle Repair & Maintenance Expense
 *   Cr  Spare Parts Inventory        = Σ part line amounts (batch cost)
 * Service lines carry no entry here — they're billed later by Service Bill.
 */
export async function postJobCardPartsVoucher(tx: Tx, args: JobCardVoucherArgs) {
  // Independent lookups — run together instead of one after another.
  const [expenseLedger, inventoryLedger] = await Promise.all([
    getGLLedger(tx, "REPAIR_EXPENSE"),
    getGLLedger(tx, "SPARE_PARTS_INVENTORY"),
  ]);

  const lineNarration = `Job Card ${args.jobCardNumber} — parts consumed`;

  return postJournal(tx, {
    voucherType: "JOURNAL",
    voucherNumber: args.jobCardNumber,
    voucherDate: args.finaliseDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: lineNarration,
    sourceType: "JOB_CARD",
    sourceId: args.jobCardId,
    sourceNumber: args.jobCardNumber,
    createdById: args.createdById,
    lines: [
      {
        ledgerId: expenseLedger.id,
        debitPaise: args.totalPartsAmountPaise,
        creditPaise: 0n,
        narration: lineNarration,
      },
      {
        ledgerId: inventoryLedger.id,
        debitPaise: 0n,
        creditPaise: args.totalPartsAmountPaise,
        narration: lineNarration,
      },
    ],
  });
}

export type PartReturnVoucherArgs = {
  removedPartId: string;
  voucherNumber: string;
  voucherDate: Date;
  branchId: string;
  fyCode: string;
  amountPaise: bigint;
  createdById: string;
};

/**
 * A REUSABLE removed part re-entering stock un-does the expense it caused
 * when originally issued — the mirror image of postJobCardPartsVoucher:
 *   Dr  Spare Parts Inventory
 *   Cr  Vehicle Repair & Maintenance Expense
 * A fresh voucher, not reverseJournal — the original Job Card voucher may
 * cover several parts and this only credits back one of them.
 */
export async function postPartReturnVoucher(tx: Tx, args: PartReturnVoucherArgs) {
  const [inventoryLedger, expenseLedger] = await Promise.all([
    getGLLedger(tx, "SPARE_PARTS_INVENTORY"),
    getGLLedger(tx, "REPAIR_EXPENSE"),
  ]);

  const lineNarration = `Reusable part returned to stock`;

  return postJournal(tx, {
    voucherType: "JOURNAL",
    voucherNumber: args.voucherNumber,
    voucherDate: args.voucherDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: lineNarration,
    sourceType: "JOB_CARD",
    sourceId: args.removedPartId,
    createdById: args.createdById,
    lines: [
      {
        ledgerId: inventoryLedger.id,
        debitPaise: args.amountPaise,
        creditPaise: 0n,
        narration: lineNarration,
      },
      {
        ledgerId: expenseLedger.id,
        debitPaise: 0n,
        creditPaise: args.amountPaise,
        narration: lineNarration,
      },
    ],
  });
}

export type ServiceBillVoucherArgs = {
  serviceBillId: string;
  serviceBillNumber: string;
  billDate: Date;
  branchId: string;
  fyCode: string;
  serviceProviderId: string;
  netAmountPaise: bigint;
  createdById: string;
};

/**
 * Post the accrual voucher when a ServiceBill is posted:
 *   Dr  Vehicle Repair & Maintenance Expense
 *   Cr  service provider party ledger  = net amount (net of discount)
 * This is the ONLY place a JobCardServiceLine's cost hits the ledger — Job
 * Card Finalise deliberately skips it (see JobCard flow doc).
 */
export async function postServiceBillVoucher(tx: Tx, args: ServiceBillVoucherArgs) {
  const [expenseLedger, providerLedger] = await Promise.all([
    getGLLedger(tx, "REPAIR_EXPENSE"),
    getOrCreatePartyLedger(tx, { sparePartSupplierId: args.serviceProviderId }),
  ]);

  const lineNarration = `Service Bill ${args.serviceBillNumber}`;

  return postJournal(tx, {
    voucherType: "JOURNAL",
    voucherNumber: args.serviceBillNumber,
    voucherDate: args.billDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: lineNarration,
    sourceType: "SERVICE_BILL",
    sourceId: args.serviceBillId,
    sourceNumber: args.serviceBillNumber,
    createdById: args.createdById,
    lines: [
      {
        ledgerId: expenseLedger.id,
        debitPaise: args.netAmountPaise,
        creditPaise: 0n,
        narration: lineNarration,
      },
      {
        ledgerId: providerLedger.id,
        debitPaise: 0n,
        creditPaise: args.netAmountPaise,
        narration: lineNarration,
      },
    ],
  });
}

export type ServiceBillPaymentVoucherArgs = {
  paymentId: string;
  voucherNumber: string;
  paymentDate: Date;
  branchId: string;
  fyCode: string;
  serviceProviderId: string;
  cashAccountId: string;
  paidPaise: bigint;
  tdsPaise: bigint;
  createdById: string;
};

/**
 * Settle a ServiceBillPayment:
 *   Dr  service provider party ledger
 *   Cr  Bank/Cash account          = paid amount
 * Partial-pay aware at the call site (ServiceBill.paidAmountPaise tracks
 * the running total) — each disbursement gets its own voucher.
 */
/**
 * Settle a ServiceBillPayment. When TDS is withheld it's a 3-line voucher —
 * the provider is credited (settled) for paid+TDS combined, but only the
 * cash portion actually leaves the bank; the TDS portion moves to a
 * liability (owed to the tax department, not the provider) instead:
 *   Dr  service provider party ledger   = paidPaise + tdsPaise
 *   Cr  Bank/Cash account               = paidPaise
 *   Cr  TDS Payable (Contractor)        = tdsPaise
 */
export async function postServiceBillPaymentVoucher(tx: Tx, args: ServiceBillPaymentVoucherArgs) {
  const [cashLedger, providerLedger] = await Promise.all([
    getCashLedger(tx, args.cashAccountId),
    getOrCreatePartyLedger(tx, { sparePartSupplierId: args.serviceProviderId }),
  ]);

  const lineNarration = `Service bill payment ${args.voucherNumber}`;
  const settledPaise = args.paidPaise + args.tdsPaise;

  const lines = [
    {
      ledgerId: providerLedger.id,
      debitPaise: settledPaise,
      creditPaise: 0n,
      narration: lineNarration,
    },
    {
      ledgerId: cashLedger.id,
      debitPaise: 0n,
      creditPaise: args.paidPaise,
      narration: lineNarration,
    },
  ];

  if (args.tdsPaise > 0n) {
    const tdsLedger = await getGLLedger(tx, "TDS_PAYABLE");
    lines.push({
      ledgerId: tdsLedger.id,
      debitPaise: 0n,
      creditPaise: args.tdsPaise,
      narration: lineNarration,
    });
  }

  return postJournal(tx, {
    voucherType: "PAYMENT",
    voucherNumber: args.voucherNumber,
    voucherDate: args.paymentDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: lineNarration,
    sourceType: "SERVICE_BILL",
    sourceId: args.paymentId,
    createdById: args.createdById,
    lines,
  });
}

export type ReplacementInwardVoucherArgs = {
  replacementInwardId: string;
  replacementInwardNumber: string;
  inwardDate: Date;
  branchId: string;
  fyCode: string;
  supplierId: string;
  differentialAmountPaise: bigint;
  createdById: string;
};

/**
 * A PAYABLE replacement receipt posts only the DIFFERENTIAL — the base
 * value of the part was already booked at the original purchase, and the
 * outward/inward StockMovements at that same base cost net to zero for the
 * quantity swapped. FREE replacements never call this.
 *   Dr  Spare Parts Inventory
 *   Cr  supplier party ledger
 */
export async function postReplacementInwardVoucher(tx: Tx, args: ReplacementInwardVoucherArgs) {
  const [inventoryLedger, supplierLedger] = await Promise.all([
    getGLLedger(tx, "SPARE_PARTS_INVENTORY"),
    getOrCreatePartyLedger(tx, { sparePartSupplierId: args.supplierId }),
  ]);

  const lineNarration = `Replacement Inward ${args.replacementInwardNumber} (differential)`;

  return postJournal(tx, {
    voucherType: "JOURNAL",
    voucherNumber: args.replacementInwardNumber,
    voucherDate: args.inwardDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: lineNarration,
    sourceType: "SUPPLIER_REPLACEMENT",
    sourceId: args.replacementInwardId,
    sourceNumber: args.replacementInwardNumber,
    createdById: args.createdById,
    lines: [
      {
        ledgerId: inventoryLedger.id,
        debitPaise: args.differentialAmountPaise,
        creditPaise: 0n,
        narration: lineNarration,
      },
      {
        ledgerId: supplierLedger.id,
        debitPaise: 0n,
        creditPaise: args.differentialAmountPaise,
        narration: lineNarration,
      },
    ],
  });
}

export type ReplacementCreditNoteVoucherArgs = {
  replacementListId: string;
  voucherNumber: string;
  creditNoteDate: Date;
  branchId: string;
  fyCode: string;
  supplierId: string;
  amountPaise: bigint;
  createdById: string;
};

/**
 * A CREDIT_NOTE replacement line — the supplier can't physically replace the
 * part, so instead of a batch coming back they credit our account. Unlike
 * `postReplacementInwardVoucher` this never touches `SPARE_PARTS_INVENTORY`:
 * no part is moving. The failed part was already expensed once, at Job Card
 * time (Dr REPAIR_EXPENSE / Cr SPARE_PARTS_INVENTORY — see
 * `postJobCardPartsVoucher`), so the credit note is booked as a reduction of
 * that same REPAIR_EXPENSE head rather than a fresh GL account — the net
 * repair cost comes back down by what the supplier is refunding.
 *   Dr  supplier party ledger (reduces what we owe them)
 *   Cr  Repair Expense
 */
export async function postReplacementCreditNoteVoucher(tx: Tx, args: ReplacementCreditNoteVoucherArgs) {
  const [expenseLedger, supplierLedger] = await Promise.all([
    getGLLedger(tx, "REPAIR_EXPENSE"),
    getOrCreatePartyLedger(tx, { sparePartSupplierId: args.supplierId }),
  ]);

  const lineNarration = `Replacement Credit Note ${args.voucherNumber}`;

  return postJournal(tx, {
    voucherType: "JOURNAL",
    voucherNumber: args.voucherNumber,
    voucherDate: args.creditNoteDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: lineNarration,
    sourceType: "SUPPLIER_REPLACEMENT",
    sourceId: args.replacementListId,
    sourceNumber: args.voucherNumber,
    createdById: args.createdById,
    lines: [
      {
        ledgerId: supplierLedger.id,
        debitPaise: args.amountPaise,
        creditPaise: 0n,
        narration: lineNarration,
      },
      {
        ledgerId: expenseLedger.id,
        debitPaise: 0n,
        creditPaise: args.amountPaise,
        narration: lineNarration,
      },
    ],
  });
}

export type BillCreditNoteVoucherArgs = {
  billCreditNoteId: string;
  noteType: Extract<VoucherType, "CREDIT_NOTE" | "DEBIT_NOTE">;
  noteNumber: string;
  noteDate: Date;
  branchId: string;
  fyCode: string;
  customerId: string;
  amountPaise: bigint;
  createdById: string;
};

/**
 * Post a correction against a FINALISED+ bill (see BillCreditNote in
 * schema.prisma). Booked against SALES_ADJUSTMENT rather than the original
 * income head so the original SALES voucher and this correction both stay
 * visible in the ledger — nothing here reverses the bill's own voucher.
 *   CREDIT_NOTE (customer owes less): Dr SALES_ADJUSTMENT / Cr customer ledger
 *   DEBIT_NOTE  (customer owes more): Dr customer ledger / Cr SALES_ADJUSTMENT
 */
export async function postBillCreditNoteVoucher(tx: Tx, args: BillCreditNoteVoucherArgs) {
  const [adjustmentLedger, customerLedger] = await Promise.all([
    getGLLedger(tx, "SALES_ADJUSTMENT"),
    getOrCreatePartyLedger(tx, { customerId: args.customerId }),
  ]);

  const lineNarration = `${args.noteType === "CREDIT_NOTE" ? "Credit" : "Debit"} Note ${args.noteNumber}`;
  const isCredit = args.noteType === "CREDIT_NOTE";

  return postJournal(tx, {
    voucherType: args.noteType,
    voucherNumber: args.noteNumber,
    voucherDate: args.noteDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: lineNarration,
    // JournalSourceType has no DEBIT_NOTE value — CREDIT_NOTE tags "this
    // module" for both; voucherType (CREDIT_NOTE/DEBIT_NOTE) carries the
    // actual accounting direction and keeps the uniqueness constraint apart.
    sourceType: "CREDIT_NOTE",
    sourceId: args.billCreditNoteId,
    sourceNumber: args.noteNumber,
    createdById: args.createdById,
    lines: [
      {
        ledgerId: adjustmentLedger.id,
        debitPaise: isCredit ? args.amountPaise : 0n,
        creditPaise: isCredit ? 0n : args.amountPaise,
        narration: lineNarration,
      },
      {
        ledgerId: customerLedger.id,
        debitPaise: isCredit ? 0n : args.amountPaise,
        creditPaise: isCredit ? args.amountPaise : 0n,
        narration: lineNarration,
      },
    ],
  });
}

export type LogSlipVoucherArgs = {
  logSlipId: string;
  logSlipNumber: string;
  /** Overrides the voucher number — used when re-posting a reopened slip. */
  voucherNumber?: string;
  /** Overrides the source id (unique per voucherType+source) on re-post. */
  sourceId?: string;
  logSlipDate: Date;
  branchId: string;
  fyCode: string;
  driverId: string;
  totalFreightPaise: bigint;
  totalExpensePaise: bigint;
  netVehicleResultPaise: bigint;
  driverReceivablePaise: bigint;
  driverPayablePaise: bigint;
  createdById: string;
};

/**
 * Consolidated Log Slip settlement (TRIP_JOURNEY_LOGSLIP_PLAN.md §7.2,
 * "Log Slip Posting"). v1: everything posts in one voucher here, at journey
 * close — individual DriverAdvance/TripExpense rows are NOT posted as they
 * occur (their journalEntryId columns stay null; that immediate-posting path
 * is a deliberately separate follow-up, not done here).
 *
 * This is a lite INTERNAL P&L overlay (see plan §5.3 "Authority": Tally is
 * the statutory source, this ledger is for internal vehicle P&L) — freight
 * here is the vehicle's own internal onward-freight figure, not the
 * customer-billed SALES voucher amount, so it is booked against a dedicated
 * VEHICLE_FREIGHT_INCOME head, never FREIGHT_INCOME, to avoid conflating the
 * two.
 *
 *   Dr VEHICLE_TRIP_EXPENSE            = totalExpensePaise
 *   Cr VEHICLE_FREIGHT_INCOME          = totalFreightPaise
 *   Dr/Cr VEHICLE_JOURNEY_RESULT       = balances the above (the net result)
 *   Dr driver ledger (receivable)      = driverReceivablePaise, or
 *   Cr driver ledger (payable)         = driverPayablePaise
 *   Cr/Dr VEHICLE_JOURNEY_RESULT       = mirrors whichever driver line fired
 *
 * VEHICLE_JOURNEY_RESULT is a clearing account: its running balance is the
 * accumulated internal vehicle P&L pending any future closure to equity.
 */
export async function postLogSlipVoucher(tx: Tx, args: LogSlipVoucherArgs) {
  const [expenseLedger, freightLedger, resultLedger, driverLedger] =
    await Promise.all([
      getGLLedger(tx, "VEHICLE_TRIP_EXPENSE"),
      getGLLedger(tx, "VEHICLE_FREIGHT_INCOME"),
      getGLLedger(tx, "VEHICLE_JOURNEY_RESULT"),
      getOrCreatePartyLedger(tx, { driverId: args.driverId }),
    ]);

  const lineNarration = `Log Slip ${args.logSlipNumber}`;
  const lines: DraftLine[] = [];

  if (args.totalExpensePaise > 0n)
    lines.push({
      ledgerId: expenseLedger.id,
      debitPaise: args.totalExpensePaise,
      creditPaise: 0n,
      narration: `${lineNarration} — trip expenses`,
    });
  if (args.totalFreightPaise > 0n)
    lines.push({
      ledgerId: freightLedger.id,
      debitPaise: 0n,
      creditPaise: args.totalFreightPaise,
      narration: `${lineNarration} — onward freight`,
    });

  // Net result = freight - expense. Positive means the two lines above put
  // more on the credit side than debit so far, so a debit to the clearing
  // account balances it (and vice versa for a loss).
  const net = args.netVehicleResultPaise;
  if (net > 0n)
    lines.push({
      ledgerId: resultLedger.id,
      debitPaise: net,
      creditPaise: 0n,
      narration: `${lineNarration} — net result`,
    });
  else if (net < 0n)
    lines.push({
      ledgerId: resultLedger.id,
      debitPaise: 0n,
      creditPaise: -net,
      narration: `${lineNarration} — net result`,
    });

  if (args.driverReceivablePaise > 0n) {
    lines.push({
      ledgerId: driverLedger.id,
      debitPaise: args.driverReceivablePaise,
      creditPaise: 0n,
      narration: `${lineNarration} — driver receivable`,
    });
    lines.push({
      ledgerId: resultLedger.id,
      debitPaise: 0n,
      creditPaise: args.driverReceivablePaise,
      narration: `${lineNarration} — driver settlement`,
    });
  } else if (args.driverPayablePaise > 0n) {
    lines.push({
      ledgerId: driverLedger.id,
      debitPaise: 0n,
      creditPaise: args.driverPayablePaise,
      narration: `${lineNarration} — driver payable`,
    });
    lines.push({
      ledgerId: resultLedger.id,
      debitPaise: args.driverPayablePaise,
      creditPaise: 0n,
      narration: `${lineNarration} — driver settlement`,
    });
  }

  if (lines.length < 2)
    throw new BadRequestError(
      "This journey has no freight, expense, or driver settlement to post",
    );

  return postJournal(tx, {
    voucherType: "JOURNAL",
    voucherNumber: args.voucherNumber ?? args.logSlipNumber,
    voucherDate: args.logSlipDate,
    fyCode: args.fyCode,
    branchId: args.branchId,
    narration: lineNarration,
    sourceType: "LOG_SLIP",
    sourceId: args.sourceId ?? args.logSlipId,
    sourceNumber: args.logSlipNumber,
    createdById: args.createdById,
    lines,
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
