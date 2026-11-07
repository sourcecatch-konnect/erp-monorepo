/**
 * ERP-79 · LDC broker payment — read-only inventory.
 *
 * Sizes the seven unknowns behind the LDC rebuild (see docs/LDC_WORKFLOW_PLAN.md):
 * how many advances were never posted, what sits in the advance-recovery
 * ledger, how many challans would be blocked for want of an unloading date or
 * a matching slab, and how `paymentBy` is actually distributed.
 *
 * Run it against any environment before planning a migration:
 *
 *   pnpm --filter @skerp/server ldc:inventory
 *
 * This script only reads. There is no create/update/delete/raw-write anywhere
 * in it, so it is safe against production.
 */
import "dotenv/config";
import { db } from "./prisma.js";

const rupees = (paise: bigint | null | undefined) =>
  "₹" +
  (Number(paise ?? 0n) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const heading = (text: string) => {
  console.log("\n" + "─".repeat(66));
  console.log(text);
  console.log("─".repeat(66));
};

/** 1 — challans carrying an advance that was handed over but never posted. */
async function advancesOutstanding() {
  heading("1. ISSUED challans carrying an advance");

  const agg = await db.deliveryChallan.aggregate({
    where: { status: "ISSUED", advanceAmount: { gt: 0 } },
    _count: { _all: true },
    _sum: { advanceAmount: true },
  });
  const byBroker = await db.deliveryChallan.groupBy({
    by: ["transportId"],
    where: { status: "ISSUED", advanceAmount: { gt: 0 } },
    _count: { _all: true },
  });

  console.log("  challans with advance > 0 : " + agg._count._all);
  console.log("  total advance             : " + rupees(agg._sum.advanceAmount));
  console.log("  distinct brokers involved : " + byBroker.length);
}

/**
 * 2 — the advance-recovery ledger. A credit-only balance here is the known
 * defect: the vendor accrual credits this account but nothing ever debits it,
 * because challan advances are not posted when they are handed over.
 */
async function advanceLedgerBalance() {
  heading("2. TRANSPORTER_ADVANCE_RECOVERY ledger");

  const ledger = await db.ledger.findFirst({
    where: { code: "TRANSPORTER_ADVANCE_RECOVERY" },
    select: { id: true, name: true, group: true },
  });
  if (!ledger) {
    console.log("  not seeded in this database");
    return;
  }

  const bal = await db.journalLine.aggregate({
    where: { ledgerId: ledger.id, journalEntry: { status: "POSTED" } },
    _count: { _all: true },
    _sum: { debitPaise: true, creditPaise: true },
  });
  const dr = bal._sum.debitPaise ?? 0n;
  const cr = bal._sum.creditPaise ?? 0n;

  console.log("  " + ledger.name + "  (" + ledger.group + ")");
  console.log("  posted lines : " + bal._count._all);
  console.log("  total debit  : " + rupees(dr));
  console.log("  total credit : " + rupees(cr));
  console.log(
    "  net          : " +
      rupees(dr - cr) +
      (dr - cr < 0n ? "   ← unbacked credit balance, needs a correcting entry" : ""),
  );
}

/** 3 — LDC slips already posted, and how much advance they credited. */
async function postedSlips() {
  heading("3. LDC_BROKER slips");

  const byStatus = await db.vendorPaymentSlip.groupBy({
    by: ["status"],
    where: { type: "LDC_BROKER" },
    _count: { _all: true },
    _sum: { netPayablePaise: true },
  });
  if (byStatus.length === 0) console.log("  none");
  byStatus.forEach((row) => {
    console.log(
      "  " +
        row.status.padEnd(18) +
        String(row._count._all).padStart(5) +
        "   net " +
        rupees(row._sum.netPayablePaise),
    );
  });

  const posted = await db.vendorPaymentSlip.findMany({
    where: { type: "LDC_BROKER", accrualJournalEntryId: { not: null } },
    select: { id: true },
  });
  const lines = await db.vendorPaymentSlipLine.aggregate({
    where: { slipId: { in: posted.map((s) => s.id) } },
    _sum: { advancePaise: true, detentionPaise: true, freightPaise: true },
  });

  console.log("  slips with an accrual voucher : " + posted.length);
  console.log("  advance credited by them      : " + rupees(lines._sum.advancePaise));
  console.log("  freight on them               : " + rupees(lines._sum.freightPaise));
  console.log("  detention on them             : " + rupees(lines._sum.detentionPaise));
}

/**
 * 4/5 — `paymentBy` decides whether a challan is a broker payable at all, but
 * the column is nullable and has never been enforced. Legacy nulls go to a
 * review queue rather than being guessed at.
 */
async function paymentByDistribution() {
  heading("4/5. paymentBy on ISSUED challans");

  const rows = await db.deliveryChallan.groupBy({
    by: ["paymentBy"],
    where: { status: "ISSUED" },
    _count: { _all: true },
  });
  const total = rows.reduce((n, r) => n + r._count._all, 0);

  rows
    .sort((a, b) => b._count._all - a._count._all)
    .forEach((r) => {
      const label = r.paymentBy ?? "NULL (needs review)";
      const pct = total ? ((r._count._all / total) * 100).toFixed(1) : "0";
      console.log("  " + label.padEnd(22) + String(r._count._all).padStart(6) + "   " + pct + "%");
    });
  console.log("  " + "TOTAL".padEnd(22) + String(total).padStart(6));
}

/**
 * 6 — without an unscoped fallback slab, any challan whose broker/vehicle/
 * freight matches nothing silently prices detention at zero.
 */
async function slabCoverage() {
  heading("6. Detention slabs");

  const slabs = await db.detentionSlab.findMany({
    where: { deletedAt: null, isActive: true },
    select: {
      name: true,
      basis: true,
      transportId: true,
      vehicleTypeId: true,
      freightFromPaise: true,
      _count: { select: { bands: true } },
    },
    orderBy: { priority: "desc" },
  });

  const fallbacks = slabs.filter(
    (s) => !s.transportId && !s.vehicleTypeId && s.freightFromPaise === null,
  ).length;

  console.log("  active slabs                  : " + slabs.length);
  console.log(
    "  house/unscoped fallback slabs : " +
      fallbacks +
      (fallbacks === 0 ? "   ← unmatched challans price detention at zero" : ""),
  );
  slabs.slice(0, 15).forEach((s) => {
    const scope =
      [
        s.transportId ? "broker" : null,
        s.vehicleTypeId ? "vehicleType" : null,
        s.freightFromPaise !== null ? "freightBand" : null,
      ]
        .filter(Boolean)
        .join("+") || "any";
    console.log(
      "    · " +
        s.name.padEnd(28) +
        s.basis.padEnd(6) +
        "bands " +
        String(s._count.bands).padStart(2) +
        "   scope: " +
        scope,
    );
  });
}

/**
 * 7 — detention needs a final unloading date. Resolution goes via each item's
 * `lrNumberSnapshot` rather than the four-table relation chain, because that
 * chain passes through a nullable link and can drop an LR (see
 * detention.service.ts `loadChallanContext`).
 */
async function unloadingDateCoverage() {
  heading("7. ISSUED broker challans — LR unloading dates");

  const challans = await db.deliveryChallan.findMany({
    where: { status: "ISSUED", transportId: { not: null } },
    select: { id: true, items: { select: { lrNumberSnapshot: true } } },
  });

  const lrNumbers = [
    ...new Set(challans.flatMap((c) => c.items.map((i) => i.lrNumberSnapshot))),
  ];
  const lrs = await db.lorryReceipt.findMany({
    where: { lrNumber: { in: lrNumbers } },
    select: { lrNumber: true, delivery: { select: { unloadingAt: true } } },
  });
  const unloadingByLr = new Map(
    lrs.map((lr) => [lr.lrNumber, lr.delivery?.unloadingAt ?? null]),
  );

  let approvable = 0;
  let noUnloading = 0;
  let noItems = 0;
  let unresolved = 0;

  for (const challan of challans) {
    if (challan.items.length === 0) {
      noItems++;
      continue;
    }
    const numbers = challan.items.map((i) => i.lrNumberSnapshot);
    if (numbers.some((n) => !unloadingByLr.has(n))) unresolved++;
    if (numbers.some((n) => unloadingByLr.get(n))) approvable++;
    else noUnloading++;
  }

  console.log("  issued broker challans        : " + challans.length);
  console.log("  at least one unloading date   : " + approvable + "   ← approvable");
  console.log("  NO unloading date on any LR   : " + noUnloading + "   ← today these pay zero detention");
  console.log("  no items at all               : " + noItems);
  console.log("  some LR number unresolvable   : " + unresolved + "   ← understates detention");
}

async function main() {
  console.log("ERP-79 · LDC inventory (read-only)");
  console.log("Generated " + new Date().toISOString());

  await advancesOutstanding();
  await advanceLedgerBalance();
  await postedSlips();
  await paymentByDistribution();
  await slabCoverage();
  await unloadingDateCoverage();

  heading("Done — nothing was written.");
}

main()
  .catch((err: unknown) => {
    console.error("\nFAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
