import { db } from "../../../prisma/prisma.js";
import type { AgeingReportView } from "@skerp/types";

import {
  RECEIVABLE_BILL_STATUSES,
  computeBillOutstanding,
  num as n,
  type BillLite,
  type CreditNoteLite,
  type SettlementLite,
} from "./customer-statement.compute.js";
import {
  bucketBills,
  emptyBuckets,
  type AgeingBillLite,
} from "./ageing.compute.js";

/**
 * Ageing report (ACCT-R5) — DB layer. One row per customer, each unpaid bill
 * (same bill-wise outstanding math as ACCT-R4) bucketed by days overdue.
 * Pure bucketing lives in ./ageing.compute.ts (unit-tested).
 */

export type AgeingFilters = {
  branchWhere?: Record<string, unknown>;
  fyCode?: string;
  asOf?: Date;
};

export async function buildAgeingReport(
  filters: AgeingFilters = {},
): Promise<AgeingReportView> {
  const { branchWhere = {}, fyCode } = filters;
  const asOf = filters.asOf ?? new Date();
  const fyWhere = fyCode ? { fyCode } : {};

  const bills = await db.bill.findMany({
    where: {
      status: { in: [...RECEIVABLE_BILL_STATUSES] },
      ...branchWhere,
      ...fyWhere,
    },
    select: {
      id: true,
      billNumber: true,
      billingCustomerId: true,
      billDate: true,
      dueDate: true,
      totalAmountPaise: true,
    },
  });
  if (bills.length === 0) {
    return {
      asOf: asOf.toISOString(),
      rows: [],
      totals: { ...emptyBuckets(), totalPaise: 0 },
    };
  }

  const billIds = bills.map((b) => b.id);
  const customerByBill = new Map(bills.map((b) => [b.id, b.billingCustomerId]));

  const [allocations, creditNotes, customers] = await Promise.all([
    db.receiptAllocation.findMany({
      where: { billId: { in: billIds }, receipt: { status: "POSTED" } },
      select: {
        billId: true,
        amountAppliedPaise: true,
        tdsAmountPaise: true,
        damageAmountPaise: true,
        rateDiffAmountPaise: true,
        receipt: { select: { receivedAt: true } },
      },
    }),
    db.ledgerAllocation.findMany({
      where: {
        billId: { in: billIds },
        refType: "AGAINST_REF",
        journalEntry: { status: "POSTED", voucherType: "CREDIT_NOTE" },
      },
      select: {
        billId: true,
        amountPaise: true,
        journalEntry: { select: { voucherDate: true } },
      },
    }),
    db.customer.findMany({
      where: { id: { in: [...new Set(bills.map((b) => b.billingCustomerId))] } },
      select: { id: true, name: true },
    }),
  ]);

  const settlements: SettlementLite[] = allocations.map((a) => ({
    billId: a.billId,
    settledPaise:
      n(a.amountAppliedPaise) +
      n(a.tdsAmountPaise) +
      n(a.damageAmountPaise) +
      n(a.rateDiffAmountPaise),
    at: a.receipt.receivedAt,
  }));
  const cnLites: CreditNoteLite[] = creditNotes.map((c) => ({
    // billId is non-null here — the query above filters `billId: { in: billIds } }`
    // (a list of real bill ids), which a null-billId row (a vendor-payment
    // allocation) can never match. Prisma just doesn't narrow the select type on it.
    billId: c.billId!,
    amountPaise: n(c.amountPaise),
    at: c.journalEntry.voucherDate,
  }));
  const billLites: BillLite[] = bills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    billDate: b.billDate,
    dueDate: b.dueDate,
    totalAmountPaise: n(b.totalAmountPaise),
  }));

  const outstanding = computeBillOutstanding(billLites, settlements, cnLites, asOf);

  const ageingBills: AgeingBillLite[] = outstanding.map((row) => ({
    customerId: customerByBill.get(row.billId)!,
    billDate: new Date(row.billDate),
    dueDate: row.dueDate ? new Date(row.dueDate) : null,
    outstandingPaise: row.outstandingPaise,
  }));

  const names = new Map(customers.map((c) => [c.id, c.name]));
  const { rows, totals } = bucketBills(ageingBills, asOf, names);

  return { asOf: asOf.toISOString(), rows, totals };
}
