import type { DashboardAttentionKey, DashboardFunnelKey } from "@skerp/types";

/**
 * Every screen the Dashboard drills into, in one place.
 *
 * The server sends a `key` per funnel step and attention row and knows no web
 * paths of its own, so a route only ever has to be corrected here. The maps
 * are `Record<Key, …>` over the wire unions, which makes them exhaustive: add
 * a key to the union and this file stops compiling until it has a target.
 *
 * Keep every path in step with `apps/web/app/(dashboard)/…` — `typedRoutes`
 * is off in next.config.mjs, so a bad path here is a runtime 404, not a build
 * error.
 */

/** The bill register — where a raised bill is read. */
const BILLS = "/accounts/bills";
/** The ready-to-bill worklist — delivered freight waiting to be billed. */
const LR_TO_BILL = "/accounts/lr-to-bill";
const LORRY_RECEIPTS = "/lorry-receipts";

/** Card-level drill-ins, used for the header arrow on each widget. */
export const DASHBOARD_ROUTES = {
  revenue: BILLS,
  receipts: "/accounts/receipts",
  ageing: BILLS,
  branches: "/masters/branch",
  fleet: "/masters/vehicle",
  customers: "/masters/customer",
  myWork: "/my-work",
} as const;

/**
 * Cohort steps only — "orders" and "lr" are headline figures on the card now
 * rather than steps, but they keep their keys so the union stays the single
 * list of everything Operations can drill into.
 */
export const FUNNEL_ROUTES: Record<DashboardFunnelKey, string> = {
  orders: "/orders",
  lr: LORRY_RECEIPTS,
  dispatched: LORRY_RECEIPTS,
  delivered: LORRY_RECEIPTS,
  acknowledged: LORRY_RECEIPTS,
  billed: BILLS,
};

export const ATTENTION_ROUTES: Record<DashboardAttentionKey, string> = {
  late_transit: LORRY_RECEIPTS,
  // The worklist, not the register: these LRs have no bill yet.
  unbilled: LR_TO_BILL,
  credit_limit: "/masters/customer",
  rake_charges: "/vp-management/rake-operations",
  awaiting_ack: LORRY_RECEIPTS,
};
