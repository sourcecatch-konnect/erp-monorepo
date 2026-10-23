import type { AgeingBuckets, AgeingRow } from "@skerp/types";

/**
 * Pure ageing math (ACCT-R5). No Prisma. Each already-computed per-bill
 * outstanding is dropped into a bucket by `asOf − effectiveDueDate`, where
 * `effectiveDueDate = bill.dueDate ?? bill.billDate` (a bill with no due date
 * is treated as due on its bill date — see ACCT-R1 check 3i).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const emptyBuckets = (): AgeingBuckets => ({
  notDue: 0,
  d0_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90_plus: 0,
});

/** Which bucket a single bill's outstanding belongs to. */
export function bucketFor(effectiveDue: Date, asOf: Date): keyof AgeingBuckets {
  const daysOverdue = Math.floor(
    (asOf.getTime() - effectiveDue.getTime()) / DAY_MS,
  );
  if (daysOverdue <= 0) return "notDue";
  if (daysOverdue <= 30) return "d0_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90_plus";
}

export type AgeingBillLite = {
  customerId: string;
  billDate: Date;
  dueDate: Date | null;
  outstandingPaise: number;
};

/** Group per-bill outstanding into per-customer bucket rows, newest debt first. */
export function bucketBills(
  bills: AgeingBillLite[],
  asOf: Date,
  names: Map<string, string>,
): { rows: AgeingRow[]; totals: AgeingBuckets & { totalPaise: number } } {
  const byCustomer = new Map<string, AgeingBuckets>();

  for (const b of bills) {
    if (b.outstandingPaise <= 0) continue;
    const effectiveDue = b.dueDate ?? b.billDate;
    const bucket = bucketFor(effectiveDue, asOf);
    const buckets = byCustomer.get(b.customerId) ?? emptyBuckets();
    buckets[bucket] += b.outstandingPaise;
    byCustomer.set(b.customerId, buckets);
  }

  const rows: AgeingRow[] = [...byCustomer.entries()]
    .map(([customerId, buckets]) => ({
      customerId,
      customerName: names.get(customerId) ?? customerId,
      buckets,
      totalPaise:
        buckets.notDue +
        buckets.d0_30 +
        buckets.d31_60 +
        buckets.d61_90 +
        buckets.d90_plus,
    }))
    .filter((r) => r.totalPaise > 0)
    .sort((a, b) => b.totalPaise - a.totalPaise);

  const totals = rows.reduce(
    (acc, r) => {
      acc.notDue += r.buckets.notDue;
      acc.d0_30 += r.buckets.d0_30;
      acc.d31_60 += r.buckets.d31_60;
      acc.d61_90 += r.buckets.d61_90;
      acc.d90_plus += r.buckets.d90_plus;
      acc.totalPaise += r.totalPaise;
      return acc;
    },
    { ...emptyBuckets(), totalPaise: 0 },
  );

  return { rows, totals };
}
