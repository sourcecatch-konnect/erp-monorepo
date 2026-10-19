/**
 * "My Work" — a live worklist over existing documents. Nothing here is
 * stored: each queue is a status/age rule evaluated on request.
 */

export type MyWorkArea = "orders" | "lorry-receipts" | "billing" | "trips";

export type MyWorkQueueKey =
  | "orders_to_confirm"
  | "orders_need_lr"
  | "draft_lrs"
  | "late_deliveries"
  | "pending_ack"
  | "ready_to_bill"
  | "draft_bills"
  | "overdue_payments"
  | "trips_to_close";

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
  area: MyWorkArea;
  title: string;
  reason: string;
  actionLabel: string;
  /** Items in the active window. */
  waiting: number;
  /** Subset of `waiting` past the queue's late threshold. */
  late: number;
  /** Items older than the stale threshold (not in `waiting`). */
  stale: number;
  /** Sum of amounts across `waiting`, when the queue carries money. */
  amountPaise: string | null;
  lateAfterDays: number;
  staleAfterDays: number;
  /** Oldest active rows (first page). */
  rows: MyWorkRow[];
  /** "View all" target in the module's own list screen. */
  listHref: string;
}

export interface MyWorkGoingOn {
  key: string;
  title: string;
  count: number;
  href: string;
}

export interface MyWorkSummary {
  needsYou: number;
  late: number;
  stale: number;
  goingOn: number;
}

export interface MyWorkResponse {
  summary: MyWorkSummary;
  /** Highest-priority late rows across all queues. */
  doToday: (MyWorkRow & { queueKey: MyWorkQueueKey; actionLabel: string })[];
  queues: MyWorkQueue[];
  goingOn: MyWorkGoingOn[];
}

export interface MyWorkRowsResponse {
  rows: MyWorkRow[];
  /** Rows remaining after this page. */
  remaining: number;
}
