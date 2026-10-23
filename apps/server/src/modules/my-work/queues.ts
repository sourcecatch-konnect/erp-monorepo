import type { Request } from "express";
import { PERMS } from "@skerp/types";
import type {
  MyWorkGroup,
  MyWorkModule,
  MyWorkQueueKey,
  MyWorkRow,
  MyWorkScope,
  MyWorkSection,
  MyWorkStep,
  MyWorkUrgency,
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

/** Which work area (top card on My Work) each queue belongs to. */
const MODULE_OF: Record<MyWorkQueueKey, MyWorkModule> = {
  orders_to_confirm: "orders",
  orders_need_lr: "orders",
  draft_lrs: "lr",
  late_deliveries: "lr",
  pending_ack: "lr",
  vp_schedules: "rail",
  mrrr_draft: "rail",
  vp_loaded: "rail",
  grn_draft: "rail",
  ready_to_bill: "billing",
  draft_bills: "billing",
  receipts_approve: "billing",
  overdue_payments: "billing",
  vendor_payments: "accounts",
  salary_runs: "accounts",
  log_slips: "accounts",
  trips_to_close: "trips",
  trip_expenses: "trips",
  job_cards: "workshop",
  service_bills: "workshop",
  po_approve: "workshop",
};

/** Filter for the cross-queue list. */
export type BandFilter = {
  /** active = waiting work; stale = old leftovers. */
  scope: MyWorkScope;
  /** Ignored for stale. */
  urgency: MyWorkUrgency;
  search: string;
};

const like = (term: string) => ({
  contains: term,
  mode: Prisma.QueryMode.insensitive,
});

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
  section: MyWorkSection;
  /** Flow queues: the step of the overview strip this queue feeds. */
  step?: MyWorkStep;
  /** "other" queues: which card they belong to. */
  group?: MyWorkGroup;
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
  /** Match the row's number or party for the To do search. */
  searchWhere: (term: string) => W;
  count: (where: W) => Promise<number>;
  find: (where: W, take: number, skip: number) => Promise<R[]>;
  toRow: (row: R) => RowCore;
};

export type QueueSummary = {
  key: MyWorkQueueKey;
  module: MyWorkModule;
  section: MyWorkSection;
  step: MyWorkStep | null;
  group: MyWorkGroup | null;
  title: string;
  reason: string;
  actionLabel: string;
  listHref: string;
  lateAfterDays: number;
  staleAfterDays: number;
  waiting: number;
  late: number;
  veryLate: number;
  stale: number;
};

export type QueueRunner = {
  key: MyWorkQueueKey;
  module: MyWorkModule;
  section: MyWorkSection;
  group: MyWorkGroup | null;
  permission: PermissionKey;
  title: string;
  actionLabel: string;
  lateAfter: number;
  /** The counts the page shows for this queue (4 count queries). */
  summarise: (req: Request, now: Date) => Promise<QueueSummary>;
  /** Waiting items only — one count, for the sidebar badge. */
  waitingCount: (req: Request, now: Date) => Promise<number>;
  /** Rows matching a filter, oldest first. */
  band: (
    req: Request,
    filter: BandFilter,
    skip: number,
    take: number,
    now: Date,
  ) => Promise<{ rows: MyWorkRow[]; total: number }>;
};

const daysAgo = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY_MS);

/** Late items more than this many days past their deadline are "very late". */
const VERY_LATE_DAYS = 3;

/**
 * Move an age window by `days`. Used when a queue's real deadline sits at a
 * fixed offset from the date it filters on (pickup date, transit time):
 * since = date - days, so a window on "since" is a window on date shifted +days.
 */
const shiftRange = (range: Range, days: number): Range => ({
  ...(range.lte && { lte: daysAgo(range.lte, -days) }),
  ...(range.gt && { gt: daysAgo(range.gt, -days) }),
});

const makeQueue = <W, R>(cfg: QueueConfig<W, R>): QueueRunner => {
  const and = (a: W, b: W) => ({ AND: [a, b] }) as unknown as W;

  const rangeFor = (scope: MyWorkScope, now: Date): Range =>
    scope === "stale"
      ? { lte: daysAgo(now, cfg.staleAfter) }
      : { lte: daysAgo(now, cfg.grace), gt: daysAgo(now, cfg.staleAfter) };

  // Active items split into three bands by age. "Close to late" starts at 70%
  // of the way to the limit.
  const lateFrom = Math.max(cfg.lateAfter, cfg.grace);
  // "Very late": more than VERY_LATE_DAYS past the deadline. Shown red; the
  // rest of the late items are shown orange.
  const veryLateFrom = lateFrom + VERY_LATE_DAYS;
  const nearFrom = Math.max(cfg.grace, Math.floor(cfg.lateAfter * 0.7));
  const bandRange = (urgency: MyWorkUrgency, now: Date): Range => {
    const stale = daysAgo(now, cfg.staleAfter);
    if (urgency === "late") return { lte: daysAgo(now, lateFrom), gt: stale };
    if (urgency === "near") {
      return { lte: daysAgo(now, nearFrom), gt: daysAgo(now, lateFrom) };
    }
    if (urgency === "ontime") {
      return { lte: daysAgo(now, cfg.grace), gt: daysAgo(now, nearFrom) };
    }
    return rangeFor("active", now);
  };

  const toRow = (row: R, now: Date): MyWorkRow => {
    const core = cfg.toRow(row);
    // Negative for orders whose pickup is still far off (see pickupSince).
    const ageDays = Math.floor((now.getTime() - core.since.getTime()) / DAY_MS);
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
    module: MODULE_OF[cfg.key],
    section: cfg.section,
    group: cfg.group ?? null,
    permission: cfg.permission,
    title: cfg.title,
    actionLabel: cfg.actionLabel,
    lateAfter: cfg.lateAfter,

    summarise: async (req, now) => {
      const base = cfg.baseWhere(req);
      const active = and(base, cfg.sinceWhere(rangeFor("active", now)));
      const late = and(base, cfg.sinceWhere(bandRange("late", now)));
      const stale = and(base, cfg.sinceWhere(rangeFor("stale", now)));
      const veryLate = and(
        base,
        cfg.sinceWhere({
          lte: daysAgo(now, veryLateFrom),
          gt: daysAgo(now, cfg.staleAfter),
        }),
      );

      // Only what the page shows. Rows come from `band`, on demand.
      const [waiting, lateCount, veryLateCount, staleCount] = await Promise.all([
        cfg.count(active),
        cfg.count(late),
        cfg.count(veryLate),
        cfg.count(stale),
      ]);

      return {
        key: cfg.key,
        module: MODULE_OF[cfg.key],
        section: cfg.section,
        step: cfg.step ?? null,
        group: cfg.group ?? null,
        title: cfg.title,
        reason: cfg.reason,
        actionLabel: cfg.actionLabel,
        listHref: cfg.listHref,
        lateAfterDays: cfg.lateAfter,
        staleAfterDays: cfg.staleAfter,
        waiting,
        late: lateCount,
        veryLate: veryLateCount,
        stale: staleCount,
      };
    },

    waitingCount: (req, now) =>
      cfg.count(and(cfg.baseWhere(req), cfg.sinceWhere(rangeFor("active", now)))),

    band: async (req, filter, skip, take, now) => {
      const range =
        filter.scope === "stale"
          ? rangeFor("stale", now)
          : bandRange(filter.urgency, now);
      const banded = and(cfg.baseWhere(req), cfg.sinceWhere(range));
      const where = filter.search
        ? and(banded, cfg.searchWhere(filter.search))
        : banded;
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
  pickupDate: true,
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
      transportType: true,
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

const MODE_LABEL = {
  Road: "Road",
  Rail: "Rail",
  RoadAndRail: "Road + Rail",
} as const;

const lrDetail = (r: LrRow) => {
  const route = `${r.group.originBranch.name} → ${r.group.destinationBranch.name}`;
  const vehicle =
    r.group.primaryTrip?.vehicle.vehicleNumber ?? r.group.marketVehicleNumber;
  const mode = MODE_LABEL[r.group.transportType];
  return vehicle ? `${mode} · ${route} · ${vehicle}` : `${mode} · ${route}`;
};

// The LR screen looks up a group by group id, group number or LR number —
// not by the LR's own id — so link by LR number.
const lrHref = (r: LrRow) => `/lorry-receipts/${encodeURIComponent(r.lrNumber)}`;

const orderDetail = (r: Prisma.OrderGetPayload<{ select: typeof orderSelect }>) => {
  const pickup = r.pickupDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const route = `Pickup ${pickup} · ${r.fromBranch.name} → ${r.toBranch.name}`;
  return r.truckQuantity ? `${route} · ${r.truckQuantity} truck(s)` : route;
};

/*
 * Orders run on their pickup date, not on the day they were keyed in. The age
 * model counts days from a "since" date and calls an item late once it is
 * `lateAfter` days old, so "since" is placed to make the order turn late the
 * day after its deadline:
 *   deadline = pickup − leadDays
 *   since    = deadline − (lateAfter − 1)
 * A negative grace keeps orders with a far-off pickup in the list, on time.
 */
const ORDER_LATE_AFTER = 4;
const ORDER_GRACE = -400;
const pickupOffset = (leadDays: number) => leadDays + ORDER_LATE_AFTER - 1;
const pickupSince = (pickup: Date, leadDays: number) =>
  daysAgo(pickup, pickupOffset(leadDays));
/** The same window, moved from "since" onto the pickup date. */
const pickupWhere = (range: Range, leadDays: number): Prisma.OrderWhereInput => ({
  pickupDate: shiftRange(range, pickupOffset(leadDays)),
});

/*
 * How long a truck may take from LR finalise to delivery, by transport mode.
 * Rail and Road + Rail wait for a rake, so they get longer. The queue's
 * lateAfter is the road figure; slower modes start their clock later.
 */
const DELIVERY_DAYS = { Road: 7, Rail: 15, RoadAndRail: 15 } as const;
const SLOWER_MODES: ("Rail" | "RoadAndRail")[] = ["Rail", "RoadAndRail"];
const SLOWER_EXTRA_DAYS = DELIVERY_DAYS.Rail - DELIVERY_DAYS.Road;

/* ------------------------------------------------------------------ */
/* Queues                                                              */
/* ------------------------------------------------------------------ */

export const QUEUES: QueueRunner[] = [
  makeQueue({
    key: "orders_to_confirm",
    section: "flow",
    step: "o-confirm",
    title: "Confirm customer orders",
    reason: "Confirm by the day before pickup, so the truck can be arranged.",
    actionLabel: "Confirm",
    permission: PERMS.ORDER.APPROVE,
    listHref: "/orders",
    // Due the day before pickup.
    grace: ORDER_GRACE,
    lateAfter: ORDER_LATE_AFTER,
    staleAfter: 45,
    baseWhere: (req): Prisma.OrderWhereInput => ({
      deletedAt: null,
      status: "PendingApproval",
      ...branchFilter(req, "fromBranchId"),
    }),
    sinceWhere: (range) => pickupWhere(range, 1),
    searchWhere: (t): Prisma.OrderWhereInput => ({ OR: [{ orderNumber: like(t) }, { customer: { is: { name: like(t) } } }] }),
    count: (where) => db.order.count({ where }),
    find: (where, take, skip) =>
      db.order.findMany({
        where,
        select: orderSelect,
        orderBy: [{ pickupDate: "asc" }, { createdAt: "asc" }],
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.orderNumber,
      party: r.customer.name,
      detail: orderDetail(r),
      amount: null,
      since: pickupSince(r.pickupDate, 1),
      href: `/orders/${encodeURIComponent(r.orderNumber)}`,
    }),
  }),

  makeQueue({
    key: "orders_need_lr",
    section: "flow",
    step: "o-lr",
    title: "Make LR for confirmed orders",
    reason: "Order is confirmed but no LR has been made yet. Make it by the pickup date.",
    actionLabel: "Make LR",
    permission: PERMS.LORRY_RECEIPT.CREATE,
    listHref: "/orders",
    // Due on the pickup day.
    grace: ORDER_GRACE,
    lateAfter: ORDER_LATE_AFTER,
    staleAfter: 60,
    baseWhere: (req): Prisma.OrderWhereInput => ({
      deletedAt: null,
      status: "Confirmed",
      ...branchFilter(req, "fromBranchId"),
    }),
    sinceWhere: (range) => pickupWhere(range, 0),
    searchWhere: (t): Prisma.OrderWhereInput => ({ OR: [{ orderNumber: like(t) }, { customer: { is: { name: like(t) } } }] }),
    count: (where) => db.order.count({ where }),
    find: (where, take, skip) =>
      db.order.findMany({
        where,
        select: orderSelect,
        orderBy: [{ pickupDate: "asc" }, { createdAt: "asc" }],
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.orderNumber,
      party: r.customer.name,
      detail: orderDetail(r),
      amount: null,
      since: pickupSince(r.pickupDate, 0),
      href: `/lorry-receipts/new?orderId=${r.id}`,
      recordHref: `/orders/${encodeURIComponent(r.orderNumber)}`,
    }),
  }),

  makeQueue({
    key: "draft_lrs",
    section: "flow",
    step: "draft",
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
    searchWhere: (t): Prisma.LorryReceiptWhereInput => ({ OR: [{ lrNumber: like(t) }, { group: { is: { consignor: { is: { name: like(t) } } } } }, { group: { is: { marketVehicleNumber: like(t) } } }] }),
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
    section: "flow",
    step: "deliv",
    title: "Confirm delivery of late trucks",
    reason:
      "Past the normal delivery time (road 7 days, rail 15 days). Call the driver and mark delivered.",
    actionLabel: "Mark delivered",
    permission: PERMS.LORRY_RECEIPT.DELIVER,
    listHref: "/lorry-receipts/deliveries",
    grace: 3,
    lateAfter: DELIVERY_DAYS.Road,
    staleAfter: 90,
    baseWhere: (req): Prisma.LorryReceiptWhereInput => ({
      deletedAt: null,
      status: "FINALISED",
      ...lrBranchWhere(req),
    }),
    sinceWhere: (range): Prisma.LorryReceiptWhereInput => ({
      OR: [
        { group: { is: { transportType: "Road", finalisedAt: range } } },
        {
          group: {
            is: {
              transportType: { in: SLOWER_MODES },
              finalisedAt: shiftRange(range, -SLOWER_EXTRA_DAYS),
            },
          },
        },
      ],
    }),
    searchWhere: (t): Prisma.LorryReceiptWhereInput => ({ OR: [{ lrNumber: like(t) }, { group: { is: { consignor: { is: { name: like(t) } } } } }, { group: { is: { marketVehicleNumber: like(t) } } }] }),
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
      // Slower modes get their extra days by starting the clock later. Rows
      // come back by finalise date, so road and rail interleave only roughly
      // on deep pages of the merged list.
      since: daysAgo(
        r.group.finalisedAt ?? r.createdAt,
        r.group.transportType === "Road" ? 0 : -SLOWER_EXTRA_DAYS,
      ),
      href: lrHref(r),
    }),
  }),

  makeQueue({
    key: "pending_ack",
    section: "flow",
    step: "signed",
    title: "Receive signed LRs",
    reason: "Delivered, but the signed copy is not back yet. Billing waits on it.",
    actionLabel: "Acknowledge",
    permission: PERMS.LORRY_RECEIPT.ACKNOWLEDGE,
    listHref: "/lorry-receipts/deliveries",
    grace: 0,
    // The signed copy travels back to the Jalgaon office, so allow longer.
    lateAfter: 10,
    staleAfter: 90,
    baseWhere: (req): Prisma.LorryReceiptWhereInput => ({
      deletedAt: null,
      status: "DELIVERED",
      ...lrBranchWhere(req),
    }),
    sinceWhere: (range): Prisma.LorryReceiptWhereInput => ({
      delivery: { is: { deliveredAt: range } },
    }),
    searchWhere: (t): Prisma.LorryReceiptWhereInput => ({ OR: [{ lrNumber: like(t) }, { group: { is: { consignor: { is: { name: like(t) } } } } }, { group: { is: { marketVehicleNumber: like(t) } } }] }),
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
    section: "flow",
    step: "ready",
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
    searchWhere: (t): Prisma.LorryReceiptWhereInput => ({ OR: [{ lrNumber: like(t) }, { group: { is: { consignor: { is: { name: like(t) } } } } }, { group: { is: { marketVehicleNumber: like(t) } } }] }),
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
    section: "approval",
    title: "Bills to review",
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
    searchWhere: (t): Prisma.BillWhereInput => ({ OR: [{ billNumber: like(t) }, { billingPartyNameSnapshot: like(t) }] }),
    count: (where) => db.bill.count({ where }),
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
    section: "flow",
    step: "overdue",
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
    searchWhere: (t): Prisma.BillWhereInput => ({ OR: [{ billNumber: like(t) }, { billingPartyNameSnapshot: like(t) }] }),
    count: (where) => db.bill.count({ where }),
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
    section: "other",
    group: "trips",
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
    searchWhere: (t): Prisma.VehicleTripWhereInput => ({ OR: [{ tripNumber: like(t) }, { vehicle: { is: { vehicleNumber: like(t) } } }] }),
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
  /* ---------------------------- Rail steps ---------------------------- */

  makeQueue({
    key: "vp_schedules",
    section: "flow",
    step: "sched",
    title: "Move VP schedules forward",
    reason: "Planned schedules that still need their MR/RR and loading.",
    actionLabel: "Open",
    permission: PERMS.VP_SCHEDULE.UPDATE,
    listHref: "/vp-management/vp-schedule",
    grace: 1,
    lateAfter: 4,
    staleAfter: 60,
    baseWhere: (req): Prisma.VPScheduleWhereInput => ({
      deletedAt: null,
      status: { in: ["DRAFT", "PLANNED"] },
      ...branchFilter(req, "fromBranchId"),
    }),
    sinceWhere: (range): Prisma.VPScheduleWhereInput => ({
      scheduleDate: range,
    }),
    searchWhere: (t): Prisma.VPScheduleWhereInput => ({ OR: [{ scheduleNumber: like(t) }, { scheduleName: like(t) }] }),
    count: (where) => db.vPSchedule.count({ where }),
    find: (where, take, skip) =>
      db.vPSchedule.findMany({
        where,
        select: {
          id: true,
          scheduleNumber: true,
          scheduleName: true,
          scheduleDate: true,
          totalWagonCount: true,
          fromBranch: { select: { name: true } },
          toBranch: { select: { name: true } },
        },
        orderBy: { scheduleDate: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.scheduleNumber,
      party: r.scheduleName,
      detail: `${r.fromBranch.name} → ${r.toBranch.name} · ${r.totalWagonCount} wagons`,
      amount: null,
      since: r.scheduleDate,
      href: `/vp-management/vp-schedule/${encodeURIComponent(r.scheduleNumber)}`,
    }),
  }),

  makeQueue({
    key: "mrrr_draft",
    section: "flow",
    step: "mrrr",
    title: "Submit MR / RR",
    reason: "MR/RR documents saved as draft and not yet submitted.",
    actionLabel: "Submit",
    permission: PERMS.MRRR.SUBMIT,
    listHref: "/vp-management/mrrr",
    grace: 1,
    lateAfter: 3,
    staleAfter: 60,
    baseWhere: (req): Prisma.MRRRWhereInput => ({
      deletedAt: null,
      status: "DRAFT",
      vpSchedule: branchFilter(req, "fromBranchId"),
    }),
    sinceWhere: (range): Prisma.MRRRWhereInput => ({ createdAt: range }),
    searchWhere: (t): Prisma.MRRRWhereInput => ({ OR: [{ mrRrNumber: like(t) }, { vpSchedule: { is: { scheduleName: like(t) } } }] }),
    count: (where) => db.mRRR.count({ where }),
    find: (where, take, skip) =>
      db.mRRR.findMany({
        where,
        select: {
          id: true,
          mrRrNumber: true,
          createdAt: true,
          vpSchedule: { select: { scheduleNumber: true, scheduleName: true } },
        },
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.mrRrNumber ?? "Draft MR/RR",
      party: r.vpSchedule.scheduleName,
      detail: r.vpSchedule.scheduleNumber,
      amount: null,
      since: r.createdAt,
      href: `/vp-management/mrrr/${r.id}`,
    }),
  }),

  makeQueue({
    key: "vp_loaded",
    section: "flow",
    step: "loading",
    title: "Verify loaded schedules",
    reason: "Loading is complete. It must be verified before it can be finalised.",
    actionLabel: "Verify",
    permission: PERMS.VP_LOADING.VERIFY,
    listHref: "/vp-management/vp-schedule",
    grace: 0,
    lateAfter: 3,
    staleAfter: 60,
    baseWhere: (req): Prisma.VPScheduleWhereInput => ({
      deletedAt: null,
      status: "LOADED",
      ...branchFilter(req, "fromBranchId"),
    }),
    // No dedicated "loaded at" column, so the last update is the best proxy.
    sinceWhere: (range): Prisma.VPScheduleWhereInput => ({ updatedAt: range }),
    searchWhere: (t): Prisma.VPScheduleWhereInput => ({ OR: [{ scheduleNumber: like(t) }, { scheduleName: like(t) }] }),
    count: (where) => db.vPSchedule.count({ where }),
    find: (where, take, skip) =>
      db.vPSchedule.findMany({
        where,
        select: {
          id: true,
          scheduleNumber: true,
          scheduleName: true,
          updatedAt: true,
          totalWagonCount: true,
          fromBranch: { select: { name: true } },
          toBranch: { select: { name: true } },
        },
        orderBy: { updatedAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.scheduleNumber,
      party: r.scheduleName,
      detail: `${r.fromBranch.name} → ${r.toBranch.name} · ${r.totalWagonCount} wagons`,
      amount: null,
      since: r.updatedAt,
      href: `/vp-management/vp-schedule/${encodeURIComponent(r.scheduleNumber)}`,
    }),
  }),

  makeQueue({
    key: "grn_draft",
    section: "flow",
    step: "grn",
    title: "Submit draft GRNs",
    reason: "Goods receipt notes saved as draft and not yet submitted.",
    actionLabel: "Submit",
    permission: PERMS.GRN.SUBMIT,
    listHref: "/vp-management/grn",
    grace: 1,
    lateAfter: 5,
    staleAfter: 60,
    baseWhere: (req): Prisma.GRNWhereInput => ({
      deletedAt: null,
      status: "DRAFT",
      lorryReceipt: lrBranchWhere(req),
    }),
    sinceWhere: (range): Prisma.GRNWhereInput => ({ createdAt: range }),
    searchWhere: (t): Prisma.GRNWhereInput => ({ OR: [{ grnNumber: like(t) }, { lorryReceipt: { is: { lrNumber: like(t) } } }] }),
    count: (where) => db.gRN.count({ where }),
    find: (where, take, skip) =>
      db.gRN.findMany({
        where,
        select: {
          id: true,
          grnNumber: true,
          createdAt: true,
          lorryReceipt: { select: { lrNumber: true } },
        },
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.grnNumber,
      party: r.lorryReceipt.lrNumber,
      detail: "Draft GRN",
      amount: null,
      since: r.createdAt,
      href: `/vp-management/grn/${encodeURIComponent(r.grnNumber)}`,
    }),
  }),

  /* ----------------------------- Approvals ---------------------------- */

  makeQueue({
    key: "vendor_payments",
    section: "approval",
    title: "Vendor payments",
    reason: "Payment slips waiting for approval before money can go out.",
    actionLabel: "Review",
    permission: PERMS.ACCOUNTS.PAYMENT.APPROVE,
    listHref: "/accounts/vendor-payments/approvals",
    grace: 0,
    lateAfter: 2,
    staleAfter: 60,
    baseWhere: (req): Prisma.VendorPaymentSlipWhereInput => ({
      status: "PENDING_APPROVAL",
      ...branchFilter(req, "branchId"),
    }),
    sinceWhere: (range): Prisma.VendorPaymentSlipWhereInput => ({
      createdAt: range,
    }),
    searchWhere: (t): Prisma.VendorPaymentSlipWhereInput => ({ OR: [{ slipNumber: like(t) }, { transport: { is: { name: like(t) } } }, { labour: { is: { name: like(t) } } }] }),
    count: (where) => db.vendorPaymentSlip.count({ where }),
    find: (where, take, skip) =>
      db.vendorPaymentSlip.findMany({
        where,
        select: {
          id: true,
          slipNumber: true,
          createdAt: true,
          netPayablePaise: true,
          transport: { select: { name: true } },
          labour: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.slipNumber,
      party: r.transport?.name ?? r.labour?.name ?? "Vendor",
      detail: "Waiting for approval",
      amount: r.netPayablePaise,
      since: r.createdAt,
      href: `/accounts/vendor-payments/${r.id}`,
    }),
  }),

  makeQueue({
    key: "trip_expenses",
    section: "approval",
    title: "Trip expenses",
    reason: "Driver and trip expenses waiting for approval.",
    actionLabel: "Review",
    permission: PERMS.TRIP_EXPENSE.APPROVE,
    listHref: "/vehicle-journeys",
    grace: 0,
    lateAfter: 3,
    staleAfter: 60,
    // Expenses carry no branch column; the expense routes are unscoped too.
    baseWhere: (): Prisma.TripExpenseWhereInput => ({
      deletedAt: null,
      status: "DRAFT",
    }),
    sinceWhere: (range): Prisma.TripExpenseWhereInput => ({ createdAt: range }),
    searchWhere: (t): Prisma.TripExpenseWhereInput => ({ expenseType: { is: { name: like(t) } } }),
    count: (where) => db.tripExpense.count({ where }),
    find: (where, take, skip) =>
      db.tripExpense.findMany({
        where,
        select: {
          id: true,
          journeyId: true,
          createdAt: true,
          amountPaise: true,
          expenseType: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.expenseType.name,
      party: "Trip expense",
      detail: "Waiting for approval",
      amount: r.amountPaise,
      since: r.createdAt,
      href: `/vehicle-journeys/${r.journeyId}`,
    }),
  }),

  makeQueue({
    key: "receipts_approve",
    section: "approval",
    title: "Receipts",
    reason: "Customer receipts waiting for approval before they post.",
    actionLabel: "Review",
    permission: PERMS.RECEIPT.APPROVE,
    listHref: "/accounts/receipts",
    grace: 0,
    lateAfter: 2,
    staleAfter: 60,
    baseWhere: (req): Prisma.ReceiptWhereInput => ({
      status: "PENDING_APPROVAL",
      ...branchFilter(req, "branchId"),
    }),
    sinceWhere: (range): Prisma.ReceiptWhereInput => ({ createdAt: range }),
    searchWhere: (t): Prisma.ReceiptWhereInput => ({ OR: [{ receiptNumber: like(t) }, { customer: { is: { name: like(t) } } }] }),
    count: (where) => db.receipt.count({ where }),
    find: (where, take, skip) =>
      db.receipt.findMany({
        where,
        select: {
          id: true,
          receiptNumber: true,
          createdAt: true,
          amountPaise: true,
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.receiptNumber ?? "Draft receipt",
      party: r.customer.name,
      detail: "Waiting for approval",
      amount: r.amountPaise,
      since: r.createdAt,
      href: `/accounts/receipts/${r.id}`,
    }),
  }),

  makeQueue({
    key: "salary_runs",
    section: "approval",
    title: "Driver salary runs",
    reason: "Salary runs prepared and waiting for approval.",
    actionLabel: "Review",
    permission: PERMS.DRIVER_FINANCE.SALARY_APPROVE,
    listHref: "/accounts/driver-salary-runs",
    grace: 0,
    lateAfter: 3,
    staleAfter: 60,
    baseWhere: (req): Prisma.DriverSalaryRunWhereInput => ({
      status: "DRAFT",
      ...branchFilter(req, "branchId"),
    }),
    sinceWhere: (range): Prisma.DriverSalaryRunWhereInput => ({
      createdAt: range,
    }),
    searchWhere: (t): Prisma.DriverSalaryRunWhereInput => ({ OR: [{ runNumber: like(t) }, { branch: { is: { name: like(t) } } }] }),
    count: (where) => db.driverSalaryRun.count({ where }),
    find: (where, take, skip) =>
      db.driverSalaryRun.findMany({
        where,
        select: {
          id: true,
          runNumber: true,
          createdAt: true,
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.runNumber,
      party: r.branch.name,
      detail: "Salary run",
      amount: null,
      since: r.createdAt,
      href: `/accounts/driver-salary-runs/${r.id}`,
    }),
  }),

  makeQueue({
    key: "po_approve",
    section: "approval",
    title: "Purchase orders",
    reason: "Workshop purchase orders waiting for approval.",
    actionLabel: "Review",
    permission: PERMS.WORKSHOP.PO_APPROVE,
    listHref: "/workshop/purchase-orders",
    grace: 0,
    lateAfter: 3,
    staleAfter: 60,
    baseWhere: (req): Prisma.PurchaseOrderWhereInput => ({
      status: "DRAFT",
      ...branchFilter(req, "branchId"),
    }),
    sinceWhere: (range): Prisma.PurchaseOrderWhereInput => ({
      createdAt: range,
    }),
    searchWhere: (t): Prisma.PurchaseOrderWhereInput => ({ OR: [{ poNumber: like(t) }, { supplier: { is: { name: like(t) } } }] }),
    count: (where) => db.purchaseOrder.count({ where }),
    find: (where, take, skip) =>
      db.purchaseOrder.findMany({
        where,
        select: {
          id: true,
          poNumber: true,
          createdAt: true,
          supplier: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.poNumber ?? "Draft PO",
      party: r.supplier.name,
      detail: "Waiting for approval",
      amount: null,
      since: r.createdAt,
      href: `/workshop/purchase-orders/${r.id}`,
    }),
  }),

  /* ---------------------------- Other work ---------------------------- */

  makeQueue({
    key: "log_slips",
    section: "other",
    group: "trips",
    title: "Log slips to post",
    reason: "Generated log slips not yet posted to accounts.",
    actionLabel: "Post",
    permission: PERMS.LOGSLIP.POST_ACCOUNTS,
    listHref: "/vehicle-journeys",
    grace: 0,
    lateAfter: 3,
    staleAfter: 60,
    baseWhere: (): Prisma.LogSlipWhereInput => ({ status: "GENERATED" }),
    sinceWhere: (range): Prisma.LogSlipWhereInput => ({
      OR: [
        { generatedAt: range },
        { generatedAt: null, createdAt: range },
      ],
    }),
    searchWhere: (t): Prisma.LogSlipWhereInput => ({ OR: [{ logSlipNumber: like(t) }, { vehicle: { is: { vehicleNumber: like(t) } } }] }),
    count: (where) => db.logSlip.count({ where }),
    find: (where, take, skip) =>
      db.logSlip.findMany({
        where,
        select: {
          id: true,
          journeyId: true,
          logSlipNumber: true,
          generatedAt: true,
          createdAt: true,
          vehicle: { select: { vehicleNumber: true } },
        },
        orderBy: [{ generatedAt: "asc" }, { createdAt: "asc" }],
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.logSlipNumber ?? "Log slip",
      party: r.vehicle.vehicleNumber,
      detail: "Generated, not posted",
      amount: null,
      since: r.generatedAt ?? r.createdAt,
      href: `/vehicle-journeys/${r.journeyId}/log-slip`,
    }),
  }),

  makeQueue({
    key: "job_cards",
    section: "other",
    group: "workshop",
    title: "Job cards to finalise",
    reason: "Draft job cards. Parts and costs post only when finalised.",
    actionLabel: "Finalise",
    permission: PERMS.WORKSHOP.JOBCARD_FINALISE,
    listHref: "/workshop/job-cards",
    grace: 1,
    lateAfter: 5,
    staleAfter: 60,
    baseWhere: (req): Prisma.JobCardWhereInput => ({
      status: "DRAFT",
      ...branchFilter(req, "branchId"),
    }),
    sinceWhere: (range): Prisma.JobCardWhereInput => ({ inDateTime: range }),
    searchWhere: (t): Prisma.JobCardWhereInput => ({ OR: [{ jobCardNumber: like(t) }, { vehicle: { is: { vehicleNumber: like(t) } } }] }),
    count: (where) => db.jobCard.count({ where }),
    find: (where, take, skip) =>
      db.jobCard.findMany({
        where,
        select: {
          id: true,
          jobCardNumber: true,
          inDateTime: true,
          totalAmountPaise: true,
          vehicle: { select: { vehicleNumber: true } },
        },
        orderBy: { inDateTime: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.jobCardNumber ?? "Draft job card",
      party: r.vehicle.vehicleNumber,
      detail: "Vehicle in the workshop, job card still draft",
      amount: r.totalAmountPaise,
      since: r.inDateTime,
      href: `/workshop/job-cards/${r.id}`,
    }),
  }),

  makeQueue({
    key: "service_bills",
    section: "other",
    group: "workshop",
    title: "Service bills to post",
    reason: "Draft service bills not yet posted.",
    actionLabel: "Post",
    permission: PERMS.WORKSHOP.SERVICEBILL_MANAGE,
    listHref: "/workshop/service-bills",
    grace: 1,
    lateAfter: 5,
    staleAfter: 60,
    baseWhere: (req): Prisma.ServiceBillWhereInput => ({
      status: "DRAFT",
      ...branchFilter(req, "branchId"),
    }),
    sinceWhere: (range): Prisma.ServiceBillWhereInput => ({ createdAt: range }),
    searchWhere: (t): Prisma.ServiceBillWhereInput => ({ OR: [{ serviceBillNumber: like(t) }, { serviceProvider: { is: { name: like(t) } } }] }),
    count: (where) => db.serviceBill.count({ where }),
    find: (where, take, skip) =>
      db.serviceBill.findMany({
        where,
        select: {
          id: true,
          serviceBillNumber: true,
          createdAt: true,
          netAmountPaise: true,
          serviceProvider: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take,
        skip,
      }),
    toRow: (r) => ({
      id: r.id,
      number: r.serviceBillNumber ?? "Draft service bill",
      party: r.serviceProvider.name,
      detail: "Draft",
      amount: r.netAmountPaise,
      since: r.createdAt,
      href: `/workshop/service-bills/${r.id}`,
    }),
  }),

];

export const QUEUE_BY_KEY = new Map(QUEUES.map((q) => [q.key, q]));

/* ------------------------------------------------------------------ */
/* "Going on" — read-only counts of work already in motion             */
/* ------------------------------------------------------------------ */

export type GoingOnDef = {
  key: "trips_in_transit" | "rakes_moving";
  title: string;
  href: string;
  permission: PermissionKey;
  count: (req: Request) => Promise<number>;
};

export const GOING_ON: GoingOnDef[] = [
  {
    key: "trips_in_transit",
    title: "Truck in transit",
    href: "/trips",
    permission: PERMS.TRIP.VIEW,
    count: () =>
      db.vehicleTrip.count({ where: { deletedAt: null, status: "InTransit" } }),
  },
  {
    key: "rakes_moving",
    title: "Rake moving",
    href: "/vp-management/vp-schedule",
    permission: PERMS.VP_SCHEDULE.VIEW,
    count: (req) =>
      db.railRake.count({
        where: {
          status: { in: ["DISPATCHED", "UNLOADING"] },
          ...branchFilter(req, "fromBranchId"),
        },
      }),
  },
];
