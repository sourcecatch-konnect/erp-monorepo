import type { Request } from "express";
import { PERMS } from "@skerp/types";
import type {
  MyWorkArea,
  MyWorkQueueKey,
  MyWorkRow,
  MyWorkScope,
  PermissionKey,
} from "@skerp/types";

import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { branchFilter } from "../../auth/branch-scope.js";

/**
 * Queue definitions for "My Work". Each queue is a status + age rule over an
 * existing table — nothing is stored. To add a queue: append one makeQueue()
 * call below and add its key to MyWorkQueueKey.
 *
 * Age model, per queue:
 *   grace      items younger than this are not "waiting" yet (still in flow)
 *   lateAfter  waiting items at least this old are flagged late
 *   staleAfter items at least this old are dead-weight clutter, shown apart
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type Range = { lte?: Date; gt?: Date };

type RowCore = {
  id: string;
  number: string;
  party: string;
  detail: string;
  amount: bigint | null;
  since: Date;
  href: string;
  /** Defaults to `href` when the button already opens the record. */
  recordHref?: string;
};

type QueueConfig<W, R> = {
  key: MyWorkQueueKey;
  area: MyWorkArea;
  title: string;
  reason: string;
  actionLabel: string;
  permission: PermissionKey;
  listHref: string;
  grace: number;
  lateAfter: number;
  staleAfter: number;
  baseWhere: (req: Request) => W;
  /** Constrain the queue's "age date" to a range. */
  sinceWhere: (range: Range) => W;
  count: (where: W) => Promise<number>;
  find: (where: W, take: number, skip: number) => Promise<R[]>;
  sum?: (where: W) => Promise<bigint | null>;
  toRow: (row: R) => RowCore;
};

export type QueueSummary = {
  key: MyWorkQueueKey;
  area: MyWorkArea;
  title: string;
  reason: string;
  actionLabel: string;
  listHref: string;
  lateAfterDays: number;
  staleAfterDays: number;
  waiting: number;
  late: number;
  stale: number;
  amountPaise: string | null;
  rows: MyWorkRow[];
};

export type QueueRunner = {
  key: MyWorkQueueKey;
  permission: PermissionKey;
  summarise: (req: Request, now: Date) => Promise<QueueSummary>;
  page: (
    req: Request,
    scope: MyWorkScope,
    skip: number,
    take: number,
    now: Date,
  ) => Promise<{ rows: MyWorkRow[]; total: number }>;
};

const daysAgo = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY_MS);

const makeQueue = <W, R>(cfg: QueueConfig<W, R>): QueueRunner => {
  const and = (a: W, b: W) => ({ AND: [a, b] }) as unknown as W;

  const rangeFor = (scope: MyWorkScope, now: Date): Range =>
    scope === "stale"
      ? { lte: daysAgo(now, cfg.staleAfter) }
      : { lte: daysAgo(now, cfg.grace), gt: daysAgo(now, cfg.staleAfter) };

  const toRow = (row: R, now: Date): MyWorkRow => {
    const core = cfg.toRow(row);
    const ageDays = Math.max(
      0,
      Math.floor((now.getTime() - core.since.getTime()) / DAY_MS),
    );
    return {
      id: core.id,
      number: core.number,
      party: core.party,
      detail: core.detail,
      amountPaise: core.amount === null ? null : core.amount.toString(),
      ageDays,
      isLate: ageDays >= cfg.lateAfter,
      href: core.href,
      recordHref: core.recordHref ?? core.href,
    };
  };

  return {
    key: cfg.key,
    permission: cfg.permission,

    summarise: async (req, now) => {
      const base = cfg.baseWhere(req);
      const active = and(base, cfg.sinceWhere(rangeFor("active", now)));
      const late = and(
        base,
        cfg.sinceWhere({
          lte: daysAgo(now, Math.max(cfg.lateAfter, cfg.grace)),
          gt: daysAgo(now, cfg.staleAfter),
        }),
      );
      const stale = and(base, cfg.sinceWhere(rangeFor("stale", now)));

      const [waiting, lateCount, staleCount, amount, rows] = await Promise.all([
        cfg.count(active),
        cfg.count(late),
        cfg.count(stale),
        cfg.sum ? cfg.sum(active) : Promise.resolve(null),
        cfg.find(active, 5, 0),
      ]);

      return {
        key: cfg.key,
        area: cfg.area,
        title: cfg.title,
        reason: cfg.reason,
        actionLabel: cfg.actionLabel,
        listHref: cfg.listHref,
        lateAfterDays: cfg.lateAfter,
        staleAfterDays: cfg.staleAfter,
        waiting,
        late: lateCount,
        stale: staleCount,
        amountPaise: amount === null ? null : amount.toString(),
        rows: rows.map((r) => toRow(r, now)),
      };
    },

    page: async (req, scope, skip, take, now) => {
      const where = and(
        cfg.baseWhere(req),
        cfg.sinceWhere(rangeFor(scope, now)),
      );
      const [total, rows] = await Promise.all([
        cfg.count(where),
        cfg.find(where, take, skip),
      ]);
      return { total, rows: rows.map((r) => toRow(r, now)) };
    },
  };
};

/* ------------------------------------------------------------------ */
/* Branch scoping                                                      */
/* ------------------------------------------------------------------ */

/**
 * LRs carry no branch of their own — it lives on the group. Same rule as the
 * LR list (origin, railhead or destination branch).
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

/* ------------------------------------------------------------------ */
/* Shared selects                                                      */
/* ------------------------------------------------------------------ */

const orderSelect = {
  id: true,
  orderNumber: true,
  createdAt: true,
  approvedAt: true,
  truckQuantity: true,
  customer: { select: { name: true } },
  fromBranch: { select: { name: true } },
  toBranch: { select: { name: true } },
} satisfies Prisma.OrderSelect;

const lrSelect = {
  id: true,
  lrNumber: true,
  createdAt: true,
  group: {
    select: {
      finalisedAt: true,
      marketVehicleNumber: true,
      consignor: { select: { name: true } },
      originBranch: { select: { name: true } },
      destinationBranch: { select: { name: true } },
      primaryTrip: {
        select: { vehicle: { select: { vehicleNumber: true } } },
      },
    },
  },
  delivery: { select: { deliveredAt: true } },
  acknowledgement: { select: { receivedAt: true } },
} satisfies Prisma.LorryReceiptSelect;

type LrRow = Prisma.LorryReceiptGetPayload<{ select: typeof lrSelect }>;

const lrParty = (r: LrRow) => r.group.consignor.name;

const lrDetail = (r: LrRow) => {
  const route = `${r.group.originBranch.name} → ${r.group.destinationBranch.name}`;
  const vehicle =
    r.group.primaryTrip?.vehicle.vehicleNumber ?? r.group.marketVehicleNumber;
  return vehicle ? `${route} · ${vehicle}` : route;
};

const lrHref = (r: LrRow) => `/lorry-receipts/${r.id}`;

const orderDetail = (r: Prisma.OrderGetPayload<{ select: typeof orderSelect }>) => {
  const route = `${r.fromBranch.name} → ${r.toBranch.name}`;
  return r.truckQuantity ? `${route} · ${r.truckQuantity} truck(s)` : route;
};

/* ------------------------------------------------------------------ */
/* Queues                                                              */
/* ------------------------------------------------------------------ */

export const QUEUES: QueueRunner[] = [
  makeQueue({
    key: "orders_to_confirm",
    area: "orders",
    title: "Confirm customer orders",
    reason: "Customers are waiting to hear that their truck is booked.",
    actionLabel: "Confirm",
    permission: PERMS.ORDER.APPROVE,
    listHref: "/orders",
    grace: 0,
    lateAfter: 1,
    staleAfter: 45,
    baseWhere: (req): Prisma.OrderWhereInput => ({
      deletedAt: null,
      status: "PendingApproval",
      ...branchFilter(req, "fromBranchId"),
    }),
    sinceWhere: (range): Prisma.OrderWhereInput => ({ createdAt: range }),
    count: (where) => db.order.count({ where }),
    find: (where, take, skip) =>
      db.order.findMany({
        where,
        select: orderSelect,
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.orderNumber,
      party: r.customer.name,
      detail: orderDetail(r),
      amount: null,
      since: r.createdAt,
      href: `/orders/${r.id}`,
    }),
  }),

  makeQueue({
    key: "orders_need_lr",
    area: "orders",
    title: "Make LR for confirmed orders",
    reason: "Order is confirmed but no LR has been made yet.",
    actionLabel: "Make LR",
    permission: PERMS.LORRY_RECEIPT.CREATE,
    listHref: "/orders",
    grace: 0,
    lateAfter: 2,
    staleAfter: 60,
    baseWhere: (req): Prisma.OrderWhereInput => ({
      deletedAt: null,
      status: "Confirmed",
      ...branchFilter(req, "fromBranchId"),
    }),
    sinceWhere: (range): Prisma.OrderWhereInput => ({
      OR: [
        { approvedAt: range },
        { approvedAt: null, createdAt: range },
      ],
    }),
    count: (where) => db.order.count({ where }),
    find: (where, take, skip) =>
      db.order.findMany({
        where,
        select: orderSelect,
        orderBy: [{ approvedAt: "asc" }, { createdAt: "asc" }],
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.orderNumber,
      party: r.customer.name,
      detail: orderDetail(r),
      amount: null,
      since: r.approvedAt ?? r.createdAt,
      href: `/lorry-receipts/new?orderId=${r.id}`,
      recordHref: `/orders/${r.id}`,
    }),
  }),

  makeQueue({
    key: "draft_lrs",
    area: "lorry-receipts",
    title: "Finish draft LRs",
    reason: "Draft LRs cannot be dispatched or billed.",
    actionLabel: "Finish",
    permission: PERMS.LORRY_RECEIPT.APPROVE,
    listHref: "/lorry-receipts",
    grace: 1,
    lateAfter: 3,
    staleAfter: 60,
    baseWhere: (req): Prisma.LorryReceiptWhereInput => ({
      deletedAt: null,
      status: "DRAFT",
      ...lrBranchWhere(req),
    }),
    sinceWhere: (range): Prisma.LorryReceiptWhereInput => ({
      createdAt: range,
    }),
    count: (where) => db.lorryReceipt.count({ where }),
    find: (where, take, skip) =>
      db.lorryReceipt.findMany({
        where,
        select: lrSelect,
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.lrNumber,
      party: lrParty(r),
      detail: lrDetail(r),
      amount: null,
      since: r.createdAt,
      href: lrHref(r),
    }),
  }),

  makeQueue({
    key: "late_deliveries",
    area: "lorry-receipts",
    title: "Confirm delivery of late trucks",
    reason: "These trucks left a while ago. Call the driver and mark delivered.",
    actionLabel: "Mark delivered",
    permission: PERMS.LORRY_RECEIPT.DELIVER,
    listHref: "/lorry-receipts/deliveries",
    grace: 3,
    lateAfter: 7,
    staleAfter: 90,
    baseWhere: (req): Prisma.LorryReceiptWhereInput => ({
      deletedAt: null,
      status: "FINALISED",
      ...lrBranchWhere(req),
    }),
    sinceWhere: (range): Prisma.LorryReceiptWhereInput => ({
      group: { is: { finalisedAt: range } },
    }),
    count: (where) => db.lorryReceipt.count({ where }),
    find: (where, take, skip) =>
      db.lorryReceipt.findMany({
        where,
        select: lrSelect,
        orderBy: { group: { finalisedAt: "asc" } },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.lrNumber,
      party: lrParty(r),
      detail: lrDetail(r),
      amount: null,
      since: r.group.finalisedAt ?? r.createdAt,
      href: lrHref(r),
    }),
  }),

  makeQueue({
    key: "pending_ack",
    area: "lorry-receipts",
    title: "Receive signed LRs",
    reason: "Delivered, but the signed copy is not back yet. Billing waits on it.",
    actionLabel: "Acknowledge",
    permission: PERMS.LORRY_RECEIPT.ACKNOWLEDGE,
    listHref: "/lorry-receipts/deliveries",
    grace: 0,
    lateAfter: 7,
    staleAfter: 90,
    baseWhere: (req): Prisma.LorryReceiptWhereInput => ({
      deletedAt: null,
      status: "DELIVERED",
      ...lrBranchWhere(req),
    }),
    sinceWhere: (range): Prisma.LorryReceiptWhereInput => ({
      delivery: { is: { deliveredAt: range } },
    }),
    count: (where) => db.lorryReceipt.count({ where }),
    find: (where, take, skip) =>
      db.lorryReceipt.findMany({
        where,
        select: lrSelect,
        orderBy: { delivery: { deliveredAt: "asc" } },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.lrNumber,
      party: lrParty(r),
      detail: lrDetail(r),
      amount: null,
      since: r.delivery?.deliveredAt ?? r.createdAt,
      href: lrHref(r),
    }),
  }),

  makeQueue({
    key: "ready_to_bill",
    area: "billing",
    title: "Create bills for delivered LRs",
    reason: "Signed LR is back. This freight is earned but not invoiced.",
    actionLabel: "Create bill",
    permission: PERMS.BILLING.CREATE,
    listHref: "/accounts/lr-to-bill",
    grace: 0,
    lateAfter: 7,
    staleAfter: 120,
    baseWhere: (req): Prisma.LorryReceiptWhereInput => ({
      deletedAt: null,
      status: "ACKNOWLEDGED",
      billingStatus: "READY_TO_BILL",
      ...lrBranchWhere(req),
    }),
    sinceWhere: (range): Prisma.LorryReceiptWhereInput => ({
      acknowledgement: { is: { receivedAt: range } },
    }),
    count: (where) => db.lorryReceipt.count({ where }),
    find: (where, take, skip) =>
      db.lorryReceipt.findMany({
        where,
        select: lrSelect,
        orderBy: { acknowledgement: { receivedAt: "asc" } },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.lrNumber,
      party: lrParty(r),
      detail: lrDetail(r),
      amount: null,
      since: r.acknowledgement?.receivedAt ?? r.createdAt,
      href: "/accounts/lr-to-bill",
      recordHref: lrHref(r),
    }),
  }),

  makeQueue({
    key: "draft_bills",
    area: "billing",
    title: "Review bills",
    reason: "Bills waiting to be reviewed, approved or finalised.",
    actionLabel: "Review",
    permission: PERMS.BILLING.APPROVE,
    listHref: "/accounts/bills",
    grace: 0,
    lateAfter: 3,
    staleAfter: 60,
    baseWhere: (req): Prisma.BillWhereInput => ({
      status: { in: ["DRAFT", "PENDING_REVIEW", "APPROVED"] },
      ...branchFilter(req, "branchId"),
    }),
    sinceWhere: (range): Prisma.BillWhereInput => ({ createdAt: range }),
    count: (where) => db.bill.count({ where }),
    sum: async (where) =>
      (await db.bill.aggregate({ where, _sum: { totalAmountPaise: true } }))
        ._sum.totalAmountPaise,
    find: (where, take, skip) =>
      db.bill.findMany({
        where,
        select: {
          id: true,
          billNumber: true,
          createdAt: true,
          status: true,
          billingPartyNameSnapshot: true,
          totalAmountPaise: true,
        },
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.billNumber ?? "Draft bill",
      party: r.billingPartyNameSnapshot,
      detail: r.status.replace(/_/g, " ").toLowerCase(),
      amount: r.totalAmountPaise,
      since: r.createdAt,
      href: `/accounts/bills/${r.id}`,
    }),
  }),

  makeQueue({
    key: "overdue_payments",
    area: "billing",
    title: "Chase overdue payments",
    reason: "These bills are past their due date and still unpaid.",
    actionLabel: "Open bill",
    permission: PERMS.RECEIPT.CREATE,
    listHref: "/accounts/bills",
    grace: 0,
    lateAfter: 15,
    staleAfter: 180,
    baseWhere: (req): Prisma.BillWhereInput => ({
      status: { in: ["SENT", "PARTIALLY_PAID"] },
      dueDate: { not: null },
      ...branchFilter(req, "branchId"),
    }),
    // Age here is "days past due", so the range applies to dueDate.
    sinceWhere: (range): Prisma.BillWhereInput => ({ dueDate: range }),
    count: (where) => db.bill.count({ where }),
    sum: async (where) =>
      (
        await db.bill.aggregate({
          where,
          _sum: { outstandingAmountPaise: true },
        })
      )._sum.outstandingAmountPaise,
    find: (where, take, skip) =>
      db.bill.findMany({
        where,
        select: {
          id: true,
          billNumber: true,
          dueDate: true,
          createdAt: true,
          billingPartyNameSnapshot: true,
          outstandingAmountPaise: true,
        },
        orderBy: { dueDate: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.billNumber ?? "Bill",
      party: r.billingPartyNameSnapshot,
      detail: "Past due date",
      amount: r.outstandingAmountPaise,
      since: r.dueDate ?? r.createdAt,
      href: `/accounts/bills/${r.id}`,
    }),
  }),

  makeQueue({
    key: "trips_to_close",
    area: "trips",
    title: "Close finished trips",
    reason: "Trucks that have been out a long time. Close the trip once it is back.",
    actionLabel: "Close trip",
    permission: PERMS.TRIP.CLOSE,
    listHref: "/trips",
    grace: 7,
    lateAfter: 14,
    staleAfter: 90,
    // Trips carry no branch column; the existing trip routes are unscoped too.
    baseWhere: (): Prisma.VehicleTripWhereInput => ({
      deletedAt: null,
      status: "InTransit",
    }),
    sinceWhere: (range): Prisma.VehicleTripWhereInput => ({
      startDateTime: range,
    }),
    count: (where) => db.vehicleTrip.count({ where }),
    find: (where, take, skip) =>
      db.vehicleTrip.findMany({
        where,
        select: {
          id: true,
          tripNumber: true,
          tripName: true,
          createdAt: true,
          startDateTime: true,
          vehicle: { select: { vehicleNumber: true } },
        },
        orderBy: { startDateTime: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.tripNumber,
      party: r.vehicle.vehicleNumber,
      detail: r.tripName,
      amount: null,
      since: r.startDateTime ?? r.createdAt,
      href: `/trips/${r.id}`,
    }),
  }),
];

export const QUEUE_BY_KEY = new Map(QUEUES.map((q) => [q.key, q]));

/* ------------------------------------------------------------------ */
/* "Going on" — read-only counts of work already in motion             */
/* ------------------------------------------------------------------ */

export type GoingOnDef = {
  key: string;
  title: string;
  href: string;
  permission: PermissionKey;
  count: (req: Request) => Promise<number>;
};

export const GOING_ON: GoingOnDef[] = [
  {
    key: "trips_in_transit",
    title: "Trucks in transit",
    href: "/trips",
    permission: PERMS.TRIP.VIEW,
    count: () =>
      db.vehicleTrip.count({ where: { deletedAt: null, status: "InTransit" } }),
  },
  {
    key: "lrs_on_road",
    title: "LRs on the road",
    href: "/lorry-receipts",
    permission: PERMS.LORRY_RECEIPT.VIEW,
    count: (req) =>
      db.lorryReceipt.count({
        where: { deletedAt: null, status: "FINALISED", ...lrBranchWhere(req) },
      }),
  },
  {
    key: "vp_loading",
    title: "VP schedules loading",
    href: "/vp-management/vp-schedule",
    permission: PERMS.VP_SCHEDULE.VIEW,
    count: (req) =>
      db.vPSchedule.count({
        where: {
          deletedAt: null,
          status: "LOADING",
          ...branchFilter(req, "fromBranchId"),
        },
      }),
  },
];
