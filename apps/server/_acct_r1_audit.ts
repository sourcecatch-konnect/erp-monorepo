// ACCT-R1 — read-only audit against the real DB. Mirrors docs/ACCT-R1-audit.md,
// via Prisma Client instead of raw SQL (no psql on this machine). Run with:
//   npx tsx _acct_r1_audit.ts
// No writes anywhere in this file.
import "dotenv/config";
import { db } from "./prisma/prisma.js";

const rupees = (v: bigint | number) => (Number(v) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const RECEIVABLE_STATUSES = ["FINALISED", "SENT", "PARTIALLY_PAID", "PAID"] as const;

function heading(title: string) {
  console.log(`\n${"=".repeat(70)}\n${title}\n${"=".repeat(70)}`);
}

/* -------------------------------------------------------------------- */
/* Step 1 — sample customers with a mix of paid / partial / unpaid       */
/* -------------------------------------------------------------------- */
heading("STEP 1 — sample customers (mix of paid/partial/unpaid)");

const allBills = await db.bill.findMany({
  select: {
    id: true,
    billingCustomerId: true,
    status: true,
    totalAmountPaise: true,
    outstandingAmountPaise: true,
    paidAmountPaise: true,
    billDate: true,
    dueDate: true,
    cancelledAt: true,
    cancelledById: true,
  },
});
console.log(`Total Bill rows in DB: ${allBills.length}`);

const byCustomer = new Map<string, typeof allBills>();
for (const b of allBills) {
  const list = byCustomer.get(b.billingCustomerId) ?? [];
  list.push(b);
  byCustomer.set(b.billingCustomerId, list);
}

const candidates = [...byCustomer.entries()]
  .map(([customerId, bills]) => ({
    customerId,
    bills,
    paid: bills.filter((b) => b.status === "PAID").length,
    partial: bills.filter((b) => b.status === "PARTIALLY_PAID").length,
    unpaid: bills.filter((b) => b.status === "FINALISED" || b.status === "SENT").length,
    cancelled: bills.filter((b) => b.status === "CANCELLED").length,
  }))
  .filter((c) => c.paid > 0 || c.partial > 0 || c.unpaid > 0)
  .sort((a, b) => b.bills.length - a.bills.length);

const mixed = candidates.filter((c) => c.paid > 0 && c.partial > 0 && c.unpaid > 0);
const sample = (mixed.length > 0 ? mixed : candidates).slice(0, 8);

if (sample.length === 0) {
  console.log("No customers with any FINALISED+ bills at all — nothing to sample.");
} else {
  const names = await db.customer.findMany({
    where: { id: { in: sample.map((s) => s.customerId) } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  for (const c of sample) {
    console.log(
      `- ${nameOf.get(c.customerId) ?? c.customerId} (${c.customerId}): ` +
        `${c.bills.length} bills — paid=${c.paid} partial=${c.partial} unpaid=${c.unpaid} cancelled=${c.cancelled}`,
    );
  }
}

/* -------------------------------------------------------------------- */
/* Step 2 — full trace for the top few sample customers                  */
/* -------------------------------------------------------------------- */
heading("STEP 2 — full trace for sample customers");

for (const c of sample.slice(0, 5)) {
  const receipts = await db.receipt.findMany({
    where: { customerId: c.customerId },
    select: {
      id: true,
      receiptNumber: true,
      status: true,
      receivedAt: true,
      amountPaise: true,
      unallocatedPaise: true,
      cancelledAt: true,
      allocations: {
        select: {
          billId: true,
          amountAppliedPaise: true,
          tdsAmountPaise: true,
          tdsSection: true,
          damageAmountPaise: true,
          rateDiffAmountPaise: true,
        },
      },
    },
    orderBy: { receivedAt: "asc" },
  });

  const partyLedger = await db.ledger.findUnique({
    where: { customerId: c.customerId },
    select: { id: true },
  });
  const adjustments = partyLedger
    ? await db.journalLine.findMany({
        where: {
          ledgerId: partyLedger.id,
          journalEntry: { voucherType: { in: ["CREDIT_NOTE", "DEBIT_NOTE", "JOURNAL"] } },
        },
        select: {
          debitPaise: true,
          creditPaise: true,
          journalEntry: { select: { voucherType: true, voucherNumber: true, status: true, voucherDate: true } },
        },
      })
    : [];

  console.log(`\n--- Customer ${c.customerId} ---`);
  console.log(`Bills (${c.bills.length}):`);
  for (const b of c.bills)
    console.log(
      `  ${b.id} ${b.status.padEnd(15)} total=${rupees(b.totalAmountPaise)} ` +
        `paid=${rupees(b.paidAmountPaise)} outstanding=${rupees(b.outstandingAmountPaise)} ` +
        `billDate=${b.billDate.toISOString().slice(0, 10)} dueDate=${b.dueDate?.toISOString().slice(0, 10) ?? "—"}` +
        (b.status === "CANCELLED" ? ` cancelledAt=${b.cancelledAt ?? "MISSING"} cancelledBy=${b.cancelledById ?? "MISSING"}` : ""),
    );
  console.log(`Receipts (${receipts.length}):`);
  for (const r of receipts) {
    console.log(
      `  ${r.id} ${r.status.padEnd(15)} amount=${rupees(r.amountPaise)} unallocated=${rupees(r.unallocatedPaise)} ` +
        `receivedAt=${r.receivedAt.toISOString().slice(0, 10)}${r.status === "CANCELLED" ? ` cancelledAt=${r.cancelledAt ?? "MISSING"}` : ""}`,
    );
    for (const a of r.allocations)
      console.log(
        `      -> bill ${a.billId} applied=${rupees(a.amountAppliedPaise)} tds=${rupees(a.tdsAmountPaise)}${a.tdsSection ? ` (${a.tdsSection})` : ""} damage=${rupees(a.damageAmountPaise)} rateDiff=${rupees(a.rateDiffAmountPaise)}`,
      );
  }
  console.log(`Credit/Debit notes + manual JV on party ledger (${adjustments.length}):`);
  for (const a of adjustments)
    console.log(
      `  ${a.journalEntry.voucherType} ${a.journalEntry.voucherNumber} status=${a.journalEntry.status} ` +
        `date=${a.journalEntry.voucherDate.toISOString().slice(0, 10)} dr=${rupees(a.debitPaise)} cr=${rupees(a.creditPaise)}`,
    );
}

/* -------------------------------------------------------------------- */
/* Step 3 — integrity checks (whole table)                               */
/* -------------------------------------------------------------------- */
heading("STEP 3 — integrity checks (all rows)");

// 3a/4B — outstanding drift: denormalised column vs first-principles
const allAllocations = await db.receiptAllocation.findMany({
  select: {
    billId: true,
    amountAppliedPaise: true,
    tdsAmountPaise: true,
    damageAmountPaise: true,
    rateDiffAmountPaise: true,
    receipt: { select: { status: true } },
  },
});
const settledByBill = new Map<string, bigint>();
for (const a of allAllocations) {
  if (a.receipt.status !== "POSTED") continue;
  const settled = a.amountAppliedPaise + a.tdsAmountPaise + a.damageAmountPaise + a.rateDiffAmountPaise;
  settledByBill.set(a.billId, (settledByBill.get(a.billId) ?? 0n) + settled);
}
const allCnAllocations = await db.ledgerAllocation.findMany({
  where: { refType: "AGAINST_REF", journalEntry: { status: "POSTED", voucherType: "CREDIT_NOTE" } },
  select: { billId: true, amountPaise: true },
});
const cnByBill = new Map<string, bigint>();
for (const c of allCnAllocations) cnByBill.set(c.billId, (cnByBill.get(c.billId) ?? 0n) + c.amountPaise);

let driftCount = 0;
let maxDrift = 0n;
for (const b of allBills) {
  if (b.status === "CANCELLED") continue;
  const recomputed = b.totalAmountPaise - (settledByBill.get(b.id) ?? 0n) - (cnByBill.get(b.id) ?? 0n);
  const diff = b.outstandingAmountPaise - recomputed;
  if (diff !== 0n) {
    driftCount++;
    if (diff > maxDrift || -diff > maxDrift) maxDrift = diff > 0n ? diff : -diff;
  }
}
console.log(`3a. Bill.outstandingAmountPaise vs first-principles drift: ${driftCount} bill(s) differ, max drift ₹${rupees(maxDrift)}`);

// 3b — total = paid + outstanding
const totalPaidMismatch = allBills.filter(
  (b) => b.status !== "CANCELLED" && b.totalAmountPaise !== b.paidAmountPaise + b.outstandingAmountPaise,
);
console.log(`3b. total != paid+outstanding: ${totalPaidMismatch.length} bill(s)`);

// 3c — receipt fully accounted for
const allReceipts = await db.receipt.findMany({
  where: { status: "POSTED" },
  select: {
    id: true,
    receiptNumber: true,
    amountPaise: true,
    unallocatedPaise: true,
    allocations: {
      select: { amountAppliedPaise: true, tdsAmountPaise: true, damageAmountPaise: true, rateDiffAmountPaise: true },
    },
  },
});
// NOTE: amountPaise is CASH received only — receipt.route.ts sets it to
// Σ amountAppliedPaise at creation (TDS/damage/rateDiff are non-cash bill
// deductions, not part of the receipt's own amount). The correct invariant
// is amountPaise == Σ amountApplied + unallocated, NOT + tds/damage/rateDiff
// (an earlier draft of this check conflated the two — corrected here).
let receiptMismatch = 0;
for (const r of allReceipts) {
  const cashApplied = r.allocations.reduce((s, a) => s + a.amountAppliedPaise, 0n);
  if (r.amountPaise !== cashApplied + r.unallocatedPaise) receiptMismatch++;
}
console.log(`3c. POSTED receipts where amount != cashApplied+unallocated: ${receiptMismatch} of ${allReceipts.length}`);

// 3d — allocations pointing at a cancelled bill
const cancelledBillIds = new Set(allBills.filter((b) => b.status === "CANCELLED").map((b) => b.id));
const badAllocations = await db.receiptAllocation.findMany({
  where: { billId: { in: [...cancelledBillIds] } },
  select: { id: true, billId: true, receipt: { select: { status: true, receiptNumber: true } } },
});
const liveBadAllocations = badAllocations.filter((a) => a.receipt.status !== "CANCELLED");
console.log(
  `3d. Allocations against a CANCELLED bill: ${badAllocations.length} total, ${liveBadAllocations.length} from a non-cancelled receipt (bad)`,
);

// 3e — cancelled bills/receipts missing metadata
const cancelledBillsMissingMeta = allBills.filter(
  (b) => b.status === "CANCELLED" && (!b.cancelledAt || !b.cancelledById),
);
const allCancelledReceipts = await db.receipt.findMany({
  where: { status: "CANCELLED" },
  select: { id: true, receiptNumber: true, cancelledAt: true, cancelledById: true },
});
const cancelledReceiptsMissingMeta = allCancelledReceipts.filter((r) => !r.cancelledAt || !r.cancelledById);
console.log(
  `3e. Cancelled docs missing cancelledAt/cancelledById: ${cancelledBillsMissingMeta.length} bills, ${cancelledReceiptsMissingMeta.length} receipts`,
);

// 3f — cancelled bill still showing outstanding > 0
const cancelledWithOutstanding = allBills.filter((b) => b.status === "CANCELLED" && b.outstandingAmountPaise !== 0n);
console.log(`3f. CANCELLED bills with outstanding != 0: ${cancelledWithOutstanding.length}`);

// 3g — multi-bill receipts
const multiAlloc = await db.receiptAllocation.groupBy({
  by: ["receiptId"],
  _count: { billId: true },
  having: { billId: { _count: { gt: 1 } } },
});
console.log(`3g. Receipts allocated across >1 bill: ${multiAlloc.length}`);

// 3h — TDS storage sanity
const tdsAgg = await db.receiptAllocation.aggregate({
  _count: { _all: true },
  _sum: { tdsAmountPaise: true },
});
const tdsRows = await db.receiptAllocation.findMany({ where: { tdsAmountPaise: { gt: 0 } }, select: { tdsSection: true } });
const tdsMissingSection = tdsRows.filter((r) => !r.tdsSection).length;
console.log(
  `3h. Allocations total=${tdsAgg._count._all}, with TDS>0=${tdsRows.length} (missing section=${tdsMissingSection}), Σ TDS=₹${rupees(tdsAgg._sum.tdsAmountPaise ?? 0n)}`,
);

// 3i — bills with no due date
const receivableBills = allBills.filter((b) => (RECEIVABLE_STATUSES as readonly string[]).includes(b.status));
const noDueDate = receivableBills.filter((b) => !b.dueDate).length;
console.log(`3i. FINALISED+ bills with no due date: ${noDueDate} of ${receivableBills.length}`);

/* -------------------------------------------------------------------- */
/* Step 4 — company-wide reconciliation                                  */
/* -------------------------------------------------------------------- */
heading("STEP 4 — company-wide receivables reconciliation");

// IMPORTANT: scope to RECEIVABLE_STATUSES (FINALISED+), same as
// customer-statement.service.ts / ageing.service.ts actually query — NOT
// merely "non-cancelled". A DRAFT/PENDING_REVIEW/APPROVED bill carries a
// nonzero outstandingAmountPaise too (it's just not billed yet), and
// including those inflates this sum against what the app's own reports show.
const receivableStatusBills = allBills.filter((b) =>
  (RECEIVABLE_STATUSES as readonly string[]).includes(b.status),
);
const sumOutstandingCol = receivableStatusBills.reduce((s, b) => s + b.outstandingAmountPaise, 0n);
const sumRecomputed = receivableStatusBills.reduce(
  (s, b) => s + (b.totalAmountPaise - (settledByBill.get(b.id) ?? 0n) - (cnByBill.get(b.id) ?? 0n)),
  0n,
);
const cashReceivableAgg = await db.cashReceivable.aggregate({
  where: { source: "BILL" },
  _sum: { totalAmount: true },
});

console.log(`A. Σ Bill.outstandingAmountPaise (non-cancelled):     ₹${rupees(sumOutstandingCol)}`);
console.log(`B. Σ first-principles recompute:                     ₹${rupees(sumRecomputed)}`);
console.log(`C. Σ CashReceivable.totalAmount (source=BILL):        ₹${rupees(cashReceivableAgg._sum.totalAmount ?? 0n)}`);
console.log(`   (C is what GET /cash-planning/receivables reports today — the closest thing to a "tracked" figure.)`);

await db.$disconnect();
console.log("\nDone.");
