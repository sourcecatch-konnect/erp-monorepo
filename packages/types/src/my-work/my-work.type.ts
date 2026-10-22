/**
 * "My Work" — a live worklist over existing documents. Nothing here is
 * stored: each queue is a status/age rule evaluated on request.
 */

/**
 * flow      the order-to-cash chain, shown as steps on the overview
 * approval  waiting on someone's decision (approve / review)
 * other     work that is not part of the chain (trips settlement, workshop)
 */
export type MyWorkSection = "flow" | "approval" | "other";

/** Groups inside the "other" section. */
export type MyWorkGroup = "trips" | "workshop";

/**
 * The work area a queue belongs to, named the way staff think about the
 * business. These are the cards at the top of My Work.
 */
export type MyWorkModule =
  | "orders"
  | "lr"
  | "rail"
  | "billing"
  | "accounts"
  | "trips"
  | "workshop";

/** Steps of the flow strip that carry an actionable queue. */
export type MyWorkStep =
  | "o-confirm"
  | "o-lr"
  | "draft"
  | "sched"
  | "mrrr"
  | "loading"
  | "grn"
  | "deliv"
  | "signed"
  | "ready"
  | "overdue";

export type MyWorkQueueKey =
  | "orders_to_confirm"
  | "orders_need_lr"
  | "draft_lrs"
  | "late_deliveries"
  | "pending_ack"
  | "ready_to_bill"
  | "overdue_payments"
  | "vp_schedules"
  | "mrrr_draft"
  | "vp_loaded"
  | "grn_draft"
  | "draft_bills"
  | "vendor_payments"
  | "trip_expenses"
  | "receipts_approve"
  | "salary_runs"
  | "po_approve"
  | "trips_to_close"
  | "log_slips"
  | "job_cards"
  | "service_bills";

/** active = real work; stale = so old it is probably clutter to clean up. */
export type MyWorkScope = "active" | "stale";

export interface MyWorkRow {
  id: string;
  number: string;
  party: string;
  detail: string;
  /** Paise as a string (BigInt on the server), or null when not applicable. */
  amountPaise: string | null;
  ageDays: number;
  isLate: boolean;
  /** Where the action button goes. */
  href: string;
  /** The document itself (number link). */
  recordHref: string;
}

export interface MyWorkQueue {
  key: MyWorkQueueKey;
  module: MyWorkModule;
  section: MyWorkSection;
  /** Flow queues only: which step of the strip this queue feeds. */
  step: MyWorkStep | null;
  /** "other" queues only. */
  group: MyWorkGroup | null;
  title: string;
  reason: string;
  actionLabel: string;
  /** Items in the active window. */
  waiting: number;
  /** Subset of `waiting` past the queue's late threshold. */
  late: number;
  /** Subset of `late` more than 3 days past the deadline (shown red). */
  veryLate: number;
  /** Items older than the stale threshold (not in `waiting`). */
  stale: number;
  lateAfterDays: number;
  staleAfterDays: number;
  /** "View all" target in the module's own list screen. */
  listHref: string;
}

/** Work already moving that needs no action — shown as "watching". */
export interface MyWorkGoingOn {
  key: "trips_in_transit" | "rakes_moving";
  title: string;
  count: number;
  href: string;
}

export interface MyWorkSummary {
  needsYou: number;
  late: number;
  veryLate: number;
  stale: number;
  goingOn: number;
}

export interface MyWorkResponse {
  summary: MyWorkSummary;
  queues: MyWorkQueue[];
  goingOn: MyWorkGoingOn[];
  /** Branches the user may narrow the page to (their scope). */
  branches: { id: string; name: string }[];
}

/** The sidebar badge: how many items wait on the user. */
export interface MyWorkCountResponse {
  needsYou: number;
}

/**
 * Where a waiting item stands against its step's time limit.
 * late = past it, near = close to it (70%+), ontime = the rest.
 */
export type MyWorkUrgency = "all" | "late" | "near" | "ontime";

/** A waiting row from any queue, for the cross-queue "To do" list. */
export interface MyWorkPriorityRow extends MyWorkRow {
  queueKey: MyWorkQueueKey;
  queueTitle: string;
  actionLabel: string;
  lateAfterDays: number;
}

export interface MyWorkPriorityResponse {
  rows: MyWorkPriorityRow[];
  /** Every item matching the area and urgency filter. */
  total: number;
}
