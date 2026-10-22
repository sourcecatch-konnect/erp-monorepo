import type { Request } from "express";
import type {
  DashboardAgeing,
  DashboardAgeingBucket,
  DashboardAttentionRow,
  DashboardCustomerRow,
  DashboardFleet,
  DashboardFunnelStep,
  DashboardGlance,
  DashboardMonthPoint,
  DashboardPeriod,
  DashboardRange,
  DashboardRevenue,
} from "@skerp/types";

import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { branchFilter } from "../../auth/branch-scope.js";

/**
 * Dashboard widgets. One exported function per card, each a status + date
 * aggregate over the tables the module already owns. To add a card: add one
 * function here, one field to DashboardResponse, and one call in the route.
 *
 * Deliberately no raw SQL — the row counts involved (bills and open
 * receivables inside one branch scope) are small enough to group in JS, which
 * keeps every figure checkable against the Prisma schema.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A bill counts as revenue once it is past review. DRAFT and PENDING_REVIEW
 * are not yet revenue; CANCELLED never was.
 */
const REVENUE_STATUSES = [
  "APPROVED",
  "FINALISED",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
] as const;

/** A bill the customer still owes money on. */
const openBillWhere = (req: Request): Prisma.BillWhereInput => ({
  ...branchFilter(req, "branchId"),
  status: { in: ["FINALISED", "SENT", "PARTIALLY_PAID"] },
  outstandingAmountPaise: { gt: 0 },
});

/**
 * LRs carry no branch of their own — the branch lives on their group, which
 * has three of them (origin, railhead, destination). Matching any one keeps
 * an LR visible to every branch that handles it. Mirrors the same helper in
 * my-work/queues.ts.
 */
const lrBranchWhere = (req: Request): Prisma.LorryReceiptWhereInput => {
  if (!req.ctx || req.ctx.branchScope === "ALL") return {};
  if (req.ctx.branchIds.length === 0) return { id: { in: [] } };
  return {
    group: {
      OR: [
        { originBranchId: { in: req.ctx.branchIds } },
        { railheadBranchId: { in: req.ctx.branchIds } },
        { destinationBranchId: { in: req.ctx.branchIds } },
      ],
    },
  };
};

const MONTH_INITIALS = "JFMAMJJASOND";
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export type DashboardWindow = {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
};

/**
 * The window for a period, plus the comparable earlier window. Every window
 * runs from its calendar start to now; the earlier window starts one calendar
 * unit back and covers the same elapsed length, so a month-to-date figure is
 * compared against the same days of last month rather than a whole month.
 */
export const resolveRange = (
  period: DashboardPeriod,
  now: Date,
): DashboardWindow & { range: DashboardRange } => {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  let previousFrom = new Date(from);
  let label: string;
  let previousLabel: string;

  switch (period) {
    case "today":
      previousFrom = new Date(from.getTime() - DAY_MS);
      label = "Today";
      previousLabel = "yesterday";
      break;
    case "week": {
      // Weeks start Monday.
      const back = (from.getDay() + 6) % 7;
      from.setDate(from.getDate() - back);
      previousFrom = new Date(from.getTime() - 7 * DAY_MS);
      label = "This week";
      previousLabel = "last week";
      break;
    }
    case "quarter": {
      from.setMonth(Math.floor(from.getMonth() / 3) * 3, 1);
      previousFrom = new Date(from);
      previousFrom.setMonth(previousFrom.getMonth() - 3);
      label = `Q${Math.floor(from.getMonth() / 3) + 1} ${from.getFullYear()}`;
      previousLabel = "last quarter";
      break;
    }
    case "month":
    default:
      from.setDate(1);
      previousFrom = new Date(from);
      previousFrom.setMonth(previousFrom.getMonth() - 1);
      label = `${MONTH_NAMES[from.getMonth()]} ${from.getFullYear()}`;
      previousLabel = "last month";
      break;
  }

  const elapsed = now.getTime() - from.getTime();
  const previousTo = new Date(previousFrom.getTime() + elapsed);

  return {
    from,
    to: now,
    previousFrom,
    previousTo,
    range: {
      from: from.toISOString(),
      to: now.toISOString(),
      label,
      previousLabel,
    },
  };
};

/** Card 1 — revenue billed, with the 12-month trend behind it. */
export const revenue = async (
  req: Request,
  window: DashboardWindow,
  now: Date,
): Promise<DashboardRevenue> => {
  const branch = branchFilter(req, "branchId");
  const statuses = { in: [...REVENUE_STATUSES] };

  // The trend starts 11 months before the current month, so the series ends
  // with the month in progress.
  const seriesFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [current, previous, monthly] = await Promise.all([
    db.bill.aggregate({
      where: {
        ...branch,
        status: statuses,
        billDate: { gte: window.from, lte: window.to },
      },
      _sum: { totalAmountPaise: true },
      _count: true,
    }),
    db.bill.aggregate({
      where: {
        ...branch,
        status: statuses,
        billDate: { gte: window.previousFrom, lte: window.previousTo },
      },
      _sum: { totalAmountPaise: true },
    }),
    db.bill.findMany({
      where: { ...branch, status: statuses, billDate: { gte: seriesFrom } },
      select: { billDate: true, totalAmountPaise: true },
    }),
  ]);

  const totals = new Map<string, number>();
  for (const bill of monthly) {
    const key = monthKey(bill.billDate);
    totals.set(key, (totals.get(key) ?? 0) + Number(bill.totalAmountPaise));
  }

  const series: DashboardMonthPoint[] = [];
  for (let i = 0; i < 12; i += 1) {
    const month = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    series.push({
      month: monthKey(month),
      label: MONTH_INITIALS[month.getMonth()] ?? "",
      valuePaise: totals.get(monthKey(month)) ?? 0,
    });
  }

  const totalPaise = Number(current._sum.totalAmountPaise ?? 0);
  const previousPaise = Number(previous._sum.totalAmountPaise ?? 0);

  return {
    totalPaise,
    billCount: current._count,
    previousPaise,
    deltaPct:
      previousPaise > 0
        ? ((totalPaise - previousPaise) / previousPaise) * 100
        : null,
    series,
  };
};

/** Card 2 — the four-cell cluster. Each cell is null without its permission. */
export const glance = async (
  req: Request,
  window: DashboardWindow,
  now: Date,
  can: { billing: boolean; receipt: boolean; trip: boolean },
): Promise<DashboardGlance> => {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [collected, outstanding, running, closing, pending] = await Promise.all(
    [
      can.receipt
        ? db.receipt.aggregate({
            where: {
              ...branchFilter(req, "branchId"),
              status: "POSTED",
              receivedAt: { gte: window.from, lte: window.to },
            },
            _sum: { amountPaise: true },
          })
        : null,
      can.billing
        ? db.bill.aggregate({
            where: openBillWhere(req),
            _sum: { outstandingAmountPaise: true },
          })
        : null,
      can.trip
        ? db.vehicleTrip.count({
            where: { deletedAt: null, status: "InTransit" },
          })
        : null,
      can.trip
        ? db.vehicleTrip.count({
            where: {
              deletedAt: null,
              status: "InTransit",
              TripUnloadingPoint: {
                some: { plannedDate: { lte: endOfToday }, actualDate: null },
              },
            },
          })
        : null,
      can.billing
        ? db.bill.count({
            where: {
              ...branchFilter(req, "branchId"),
              status: "PENDING_REVIEW",
            },
          })
        : null,
    ],
  );

  return {
    collectedPaise: collected ? Number(collected._sum.amountPaise ?? 0) : null,
    outstandingPaise: outstanding
      ? Number(outstanding._sum.outstandingAmountPaise ?? 0)
      : null,
    tripsRunning: running,
    tripsClosingToday: closing,
    billsPendingReview: pending,
  };
};

/**
 * Card 3 — order to bill. Each step is a count on a real status in the
 * period; the gap between two steps is the point of the card.
 */
export const funnel = async (
  req: Request,
  window: DashboardWindow,
): Promise<DashboardFunnelStep[]> => {
  const created = { gte: window.from, lte: window.to };
  const lrBranch = lrBranchWhere(req);

  const [orders, lrs, dispatched, delivered, acknowledged, billed] =
    await Promise.all([
      db.order.count({
        where: {
          ...branchFilter(req, "fromBranchId"),
          deletedAt: null,
          status: { in: ["Confirmed", "LRCreated", "InProgress", "Completed"] },
          createdAt: created,
        },
      }),
      db.lorryReceipt.count({
        where: { ...lrBranch, deletedAt: null, createdAt: created },
      }),
      db.lorryReceipt.count({
        where: {
          ...lrBranch,
          deletedAt: null,
          createdAt: created,
          status: { in: ["FINALISED", "DELIVERED", "ACKNOWLEDGED"] },
        },
      }),
      db.lorryReceipt.count({
        where: {
          ...lrBranch,
          deletedAt: null,
          createdAt: created,
          status: { in: ["DELIVERED", "ACKNOWLEDGED"] },
        },
      }),
      db.lorryReceipt.count({
        where: {
          ...lrBranch,
          deletedAt: null,
          createdAt: created,
          status: "ACKNOWLEDGED",
        },
      }),
      db.lorryReceipt.count({
        where: {
          ...lrBranch,
          deletedAt: null,
          createdAt: created,
          billingStatus: { in: ["PARTIALLY_BILLED", "BILLED"] },
        },
      }),
    ]);

  return [
    { key: "orders", label: "Orders confirmed", count: orders },
    { key: "lr", label: "LR created", count: lrs },
    { key: "dispatched", label: "Dispatched", count: dispatched },
    { key: "delivered", label: "Delivered", count: delivered },
    { key: "acknowledged", label: "Acknowledged", count: acknowledged },
    { key: "billed", label: "Billed", count: billed },
  ];
};

/** Card 4 — receivables ageing, bucketed on how far past due each bill is. */
export const ageing = async (
  req: Request,
  now: Date,
): Promise<DashboardAgeing> => {
  const bills = await db.bill.findMany({
    where: openBillWhere(req),
    select: { dueDate: true, billDate: true, outstandingAmountPaise: true },
  });

  const buckets: DashboardAgeingBucket[] = [
    { key: "0-30", label: "0–30 days", amountPaise: 0, billCount: 0 },
    { key: "31-60", label: "31–60 days", amountPaise: 0, billCount: 0 },
    { key: "61-90", label: "61–90 days", amountPaise: 0, billCount: 0 },
    { key: "90+", label: "90+ days", amountPaise: 0, billCount: 0 },
  ];

  let totalPaise = 0;
  for (const bill of bills) {
    // A bill with no due date ages from its own date, so nothing is dropped.
    const from = bill.dueDate ?? bill.billDate;
    const days = Math.floor((now.getTime() - from.getTime()) / DAY_MS);
    const slot =
      days <= 30
        ? buckets[0]
        : days <= 60
          ? buckets[1]
          : days <= 90
            ? buckets[2]
            : buckets[3];
    const amount = Number(bill.outstandingAmountPaise);
    if (slot) {
      slot.amountPaise += amount;
      slot.billCount += 1;
    }
    totalPaise += amount;
  }

  return { totalPaise, buckets };
};

/**
 * Card 5 — top customers by revenue. Grouped on `serviceCustomerId`: who the
 * freight was hauled for, which is not always who pays the bill.
 */
export const topCustomers = async (
  req: Request,
  window: DashboardWindow,
  take = 10,
): Promise<DashboardCustomerRow[]> => {
  const grouped = await db.bill.groupBy({
    by: ["serviceCustomerId"],
    where: {
      ...branchFilter(req, "branchId"),
      status: { in: [...REVENUE_STATUSES] },
      billDate: { gte: window.from, lte: window.to },
    },
    _sum: { totalAmountPaise: true },
    _count: { _all: true },
    orderBy: { _sum: { totalAmountPaise: "desc" } },
    take,
  });

  if (grouped.length === 0) return [];

  const customers = await db.customer.findMany({
    where: { id: { in: grouped.map((g) => g.serviceCustomerId) } },
    select: { id: true, name: true },
  });
  const names = new Map(customers.map((c) => [c.id, c.name]));

  return grouped.map((g) => ({
    customerId: g.serviceCustomerId,
    name: names.get(g.serviceCustomerId) ?? "Unknown customer",
    amountPaise: Number(g._sum.totalAmountPaise ?? 0),
    billCount: g._count._all,
  }));
};

/**
 * Card 6 — own fleet. `Vehicle.status` only distinguishes AVAILABLE from
 * ON_TRIP, so workshop is derived from job cards and takes precedence: a truck
 * being worked on is never also counted as running. A job card means the truck
 * is in while it is still DRAFT and has no out time.
 */
export const fleet = async (): Promise<DashboardFleet> => {
  const [vehicles, openJobCards] = await Promise.all([
    db.vehicle.findMany({
      where: { ownershipType: "Own_Vehicle" },
      select: { id: true, status: true },
    }),
    db.jobCard.findMany({
      where: { status: "DRAFT", outDateTime: null },
      select: { vehicleId: true },
    }),
  ]);

  const inWorkshop = new Set(openJobCards.map((j) => j.vehicleId));
  let workshop = 0;
  let running = 0;
  let idle = 0;
  for (const vehicle of vehicles) {
    if (inWorkshop.has(vehicle.id)) workshop += 1;
    else if (vehicle.status === "ON_TRIP") running += 1;
    else idle += 1;
  }

  const total = vehicles.length;
  return {
    total,
    running,
    workshop,
    idle,
    utilisationPct: total > 0 ? Math.round((running / total) * 100) : 0,
  };
};

const LATE_IN_TRANSIT_DAYS = 7;
const UNBILLED_DAYS = 15;

/**
 * Card 7 — needs attention. Each row is one exception rule, included only
 * when the viewer may see that module and only when it actually fires.
 */
export const attention = async (
  req: Request,
  now: Date,
  can: { lr: boolean; billing: boolean; rail: boolean },
): Promise<DashboardAttentionRow[]> => {
  const lrBranch = lrBranchWhere(req);
  const lateBefore = new Date(now.getTime() - LATE_IN_TRANSIT_DAYS * DAY_MS);
  const unbilledBefore = new Date(now.getTime() - UNBILLED_DAYS * DAY_MS);

  const [lateTransit, readyToBill, awaitingAck, breaches, rakeCharges] =
    await Promise.all([
      can.lr
        ? db.lorryReceipt.count({
            where: {
              ...lrBranch,
              deletedAt: null,
              status: "FINALISED",
              createdAt: { lt: lateBefore },
            },
          })
        : null,
      can.billing
        ? db.lorryReceipt.count({
            where: {
              ...lrBranch,
              deletedAt: null,
              status: { in: ["DELIVERED", "ACKNOWLEDGED"] },
              billingStatus: "READY_TO_BILL",
              createdAt: { lt: unbilledBefore },
            },
          })
        : null,
      can.lr
        ? db.lorryReceipt.count({
            where: {
              ...lrBranch,
              deletedAt: null,
              status: "DELIVERED",
              acknowledgement: { is: null },
            },
          })
        : null,
      can.billing ? creditBreaches(req) : null,
      can.rail
        ? db.railRakeCharge.aggregate({
            where: {
              balanceAmount: { gt: 0 },
              status: { in: ["ASSESSED", "PARTIALLY_SETTLED"] },
            },
            _sum: { balanceAmount: true },
            _count: true,
          })
        : null,
    ]);

  const rows: DashboardAttentionRow[] = [];

  if (lateTransit) {
    rows.push({
      key: "late_transit",
      severity: "critical",
      title: `${lateTransit} LRs in transit over ${LATE_IN_TRANSIT_DAYS} days`,
      detail: "Finalised, with no delivery recorded",
      value: String(lateTransit),
    });
  }

  if (readyToBill) {
    rows.push({
      key: "unbilled",
      severity: "critical",
      title: `${readyToBill} LRs delivered, not billed`,
      detail: `Ready to bill for over ${UNBILLED_DAYS} days`,
      value: String(readyToBill),
    });
  }

  if (breaches && breaches.length > 0) {
    const worst = breaches[0]!;
    rows.push({
      key: "credit_limit",
      severity: "warning",
      title:
        breaches.length === 1
          ? `${worst.name} is over its credit limit`
          : `${breaches.length} customers over their credit limit`,
      detail: `Highest: ${worst.name} at ${worst.usedPct}% of limit`,
      value: `${worst.usedPct}%`,
    });
  }

  if (rakeCharges && rakeCharges._count > 0) {
    rows.push({
      key: "rake_charges",
      severity: "warning",
      title: `${rakeCharges._count} rake charges unpaid`,
      detail: "Demurrage and wharfage with a balance outstanding",
      value: formatLakh(Number(rakeCharges._sum.balanceAmount ?? 0)),
    });
  }

  if (awaitingAck) {
    rows.push({
      key: "awaiting_ack",
      severity: "info",
      title: `${awaitingAck} LRs awaiting acknowledgement`,
      detail: "Delivered, signed copy not received at the office",
      value: String(awaitingAck),
    });
  }

  return rows;
};

/**
 * Customers whose open bills exceed the credit limit on their master.
 * `creditLimit` is nullable, so only customers with one set are checked.
 */
const creditBreaches = async (
  req: Request,
): Promise<{ name: string; usedPct: number }[]> => {
  const grouped = await db.bill.groupBy({
    by: ["serviceCustomerId"],
    where: openBillWhere(req),
    _sum: { outstandingAmountPaise: true },
  });
  if (grouped.length === 0) return [];

  const customers = await db.customer.findMany({
    where: {
      id: { in: grouped.map((g) => g.serviceCustomerId) },
      creditLimit: { not: null },
    },
    select: { id: true, name: true, creditLimit: true },
  });

  const outstanding = new Map(
    grouped.map((g) => [
      g.serviceCustomerId,
      Number(g._sum.outstandingAmountPaise ?? 0),
    ]),
  );

  return customers
    .flatMap((c) => {
      const limit = Number(c.creditLimit ?? 0);
      const used = outstanding.get(c.id) ?? 0;
      if (limit <= 0 || used <= limit) return [];
      return [{ name: c.name, usedPct: Math.round((used / limit) * 100) }];
    })
    .sort((a, b) => b.usedPct - a.usedPct);
};

/** Paise to a short "₹1.24 L" / "₹1.20 Cr" string for a row's value column. */
const formatLakh = (paise: number): string => {
  const rupees = paise / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)} Cr`;
  return `₹${(rupees / 100_000).toFixed(2)} L`;
};
