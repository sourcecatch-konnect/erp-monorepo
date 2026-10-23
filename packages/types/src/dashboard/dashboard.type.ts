/**
 * Dashboard — how the business is running, as opposed to My Work, which is
 * what the viewer has to do. Every figure is an aggregate over existing
 * documents, evaluated on request; nothing here is stored.
 *
 * A widget the viewer has no permission for comes back `null` rather than
 * zero, so the page can leave the card out instead of showing a false zero.
 * All money is paise (see lib/bigint-json.ts — BigInt serialises as number).
 */

/** The period selector. Every window runs from its start to now. */
export type DashboardPeriod = "today" | "week" | "month" | "quarter";

export interface DashboardRange {
  /** ISO timestamps of the window actually used. */
  from: string;
  to: string;
  /** What to print next to the card title, e.g. "Oct 2026". */
  label: string;
  /** The comparable earlier window the deltas are measured against. */
  previousLabel: string;
}

/** One month of a 12-month trend. */
export interface DashboardMonthPoint {
  /** YYYY-MM. */
  month: string;
  /** Single-letter month initial, for the axis. */
  label: string;
  valuePaise: number;
}

export interface DashboardRevenue {
  totalPaise: number;
  billCount: number;
  previousPaise: number;
  /** null when the earlier window had nothing to compare against. */
  deltaPct: number | null;
  /** Last 12 months including the current one, oldest first. */
  series: DashboardMonthPoint[];
}

/**
 * The four figures of the "at a glance" cluster. Each is null when the
 * viewer cannot see that module.
 */
export interface DashboardGlance {
  /** Receipts in the period. */
  collectedPaise: number | null;
  /** Live total across every open bill — not period-filtered. */
  outstandingPaise: number | null;
  tripsRunning: number | null;
  tripsClosingToday: number | null;
  billsPendingReview: number | null;
}

export type DashboardFunnelKey =
  | "orders"
  | "lr"
  | "dispatched"
  | "delivered"
  | "acknowledged"
  | "billed";

export interface DashboardFunnelStep {
  key: DashboardFunnelKey;
  label: string;
  count: number;
}

export type DashboardAgeingBucketKey = "0-30" | "31-60" | "61-90" | "90+";

export interface DashboardAgeingBucket {
  key: DashboardAgeingBucketKey;
  label: string;
  amountPaise: number;
  billCount: number;
}

export interface DashboardAgeing {
  totalPaise: number;
  buckets: DashboardAgeingBucket[];
}

export interface DashboardCustomerRow {
  customerId: string;
  name: string;
  amountPaise: number;
  billCount: number;
}

/**
 * Own-fleet split. `Vehicle.status` only distinguishes AVAILABLE from
 * ON_TRIP, so "workshop" is derived from open job cards and takes
 * precedence: a truck on an open job card is counted there even while its
 * status still says ON_TRIP.
 */
export interface DashboardFleet {
  total: number;
  running: number;
  workshop: number;
  idle: number;
  utilisationPct: number;
}

export type DashboardAttentionSeverity = "critical" | "warning" | "info";

/**
 * One exception rule. The key is the contract with the web side, which maps it
 * to the screen that rule drills into — the server deliberately knows no web
 * route paths (see features/dashboard/routes.ts).
 */
export type DashboardAttentionKey =
  | "late_transit"
  | "unbilled"
  | "credit_limit"
  | "rake_charges"
  | "awaiting_ack";

export interface DashboardAttentionRow {
  key: DashboardAttentionKey;
  severity: DashboardAttentionSeverity;
  title: string;
  detail: string;
  /** Already formatted — a count, a percentage or an amount. */
  value: string;
}

export interface DashboardResponse {
  period: DashboardPeriod;
  range: DashboardRange;
  /** Branches the viewer may narrow the page to (their scope). */
  branches: { id: string; name: string }[];
  revenue: DashboardRevenue | null;
  glance: DashboardGlance | null;
  funnel: DashboardFunnelStep[] | null;
  ageing: DashboardAgeing | null;
  topCustomers: DashboardCustomerRow[] | null;
  fleet: DashboardFleet | null;
  attention: DashboardAttentionRow[] | null;
}
