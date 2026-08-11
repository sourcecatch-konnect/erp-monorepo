/**
 * RBAC permission registry — single source of truth for every gated action.
 *
 * Convention: lowercase `resource.action` strings, dot-separated.
 *   - Masters: `masters.<slug>.<action>` (slug matches the master registry).
 *   - Non-master resources: `<resource>.<action>`.
 *   - Non-CRUD verbs: `.approve`, `.cancel`, `.close`, `.bulk_import`,
 *     `.export`, `.generate_invoice`.
 *
 * Add new keys here, then re-run the seed script so they appear in the
 * `Permission` catalog table. Never hard-code a string at a call site.
 */

type CrudAction = "view" | "create" | "update" | "delete";

export type MasterSlug =
  | "state"
  | "city"
  | "area"
  | "transport"
  | "vehicle"
  | "spare-category"
  | "spare-part"
  | "spare-part-supplier"
  | "customer"
  | "company"
  | "branch"
  | "route"
  | "warehouse"
  | "driver"
  | "labour"
  | "goods"
  | "unit-of-measure"
  | "pump"
  | "wagon"
  | "railway-freight"
  | "agreement"
  | "rate-matrix"
  | "vehicle-type"
  | "creditor"
  | "cash-account";

type MasterPermissionKey =
  | `masters.${MasterSlug}.${CrudAction}`
  | `masters.${MasterSlug}.bulk_import`
  | `masters.${MasterSlug}.export`;

type LorryReceiptPermissionKey =
  | `lorry_receipt.${CrudAction}`
  | "lorry_receipt.approve"
  | "lorry_receipt.cancel"
  | "lorry_receipt.generate_invoice"
  | "lorry_receipt.deliver"
  | "lorry_receipt.acknowledge";

type TripPermissionKey =
  | `trip.${CrudAction}`
  | "trip.close"
  | "trip.cancel"
  | "trip.correct_closed";

type VehicleJourneyPermissionKey =
  | "vehicle_journey.view"
  | "vehicle_journey.create"
  | "vehicle_journey.update"
  | "vehicle_journey.close"
  | "vehicle_journey.cancel"
  | "vehicle_journey.reopen_settlement"
  | "vehicle_journey.override_chain";

type TripExpensePermissionKey =
  | "trip_expense.view"
  | "trip_expense.create"
  | "trip_expense.update"
  | "trip_expense.approve"
  | "trip_expense.reverse";

type TripAdvancePermissionKey =
  | "trip_advance.view"
  | "trip_advance.create"
  | "trip_advance.reverse";

type LogSlipPermissionKey =
  | "logslip.view"
  | "logslip.generate"
  | "logslip.post_accounts"
  | "logslip.reopen"
  | "logslip.print";

type VPSchedulePermissionKey =
  | `vp_schedule.${CrudAction}`
  | "vp_schedule.confirm"
  | "vp_schedule.cancel";

type MRRRPermissionKey = `mrrr.${CrudAction}` | "mrrr.submit" | "mrrr.cancel";

type GRNPermissionKey = `grn.${CrudAction}` | "grn.submit" | "grn.cancel";
type RailBranchGRNPermissionKey =
  | `rail_branch_grn.${CrudAction}`
  | "rail_branch_grn.submit";
type DeliveryChallanPermissionKey =
  | `delivery_challan.${CrudAction}`
  | "delivery_challan.issue"
  | "delivery_challan.cancel";
type RailRakeOperationPermissionKey =
  | `rail_rake_operation.${CrudAction}`
  | "rail_rake_operation.submit";
type RakeAtRailHeadPermissionKey =
  | `rake_at_rail_head.${CrudAction}`
  | "rake_at_rail_head.submit";
type RakeAtBranchPermissionKey =
  | `rake_at_branch.${CrudAction}`
  | "rake_at_branch.submit";
type VPLoadingPermissionKey =
  | `vp_loading.${CrudAction}`
  | "vp_loading.mark_loaded"
  | "vp_loading.cancel"
  | "vp_loading.complete"
  | "vp_loading.verify"
  | "vp_loading.capacity_override"
  | "vp_loading.assign_tracker"
  | "vp_loading.replace_tracker"
  | "vp_loading.release_tracker";

type OrderPermissionKey =
  | `order.${CrudAction}`
  | "order.approve"
  | "order.reject"
  | "order.cancel";

type EwaybillPermissionKey =
  | `ewaybill.${CrudAction}`
  | "ewaybill.extend"
  | "ewaybill.cancel";

type TrackingPermissionKey = "tracking.view";

type CashPlanningPermissionKey =
  | "cashplanning.view"
  | "cashplanning.enter"
  | "cashplanning.approve"
  | "cashplanning.close";

type AdminPermissionKey = "admin.rbac.manage" | "admin.audit_log.view";

type NotificationPermissionKey =
  | "notifications.view"
  | "notifications.manage_rules"
  | "notifications.manage_templates"
  | "notifications.test_send";
type OneLapTrackerPermissionKey =
  | "masters.one-lap-tracker.view"
  | "masters.one-lap-tracker.update"
  | "masters.one-lap-tracker.sync";
type AttachmentPermissionKey =
  | "attachments.view"
  | "attachments.create"
  | "attachments.download"
  | "attachments.delete";

export type PermissionKey =
  | MasterPermissionKey
  | LorryReceiptPermissionKey
  | TripPermissionKey
  | VehicleJourneyPermissionKey
  | TripExpensePermissionKey
  | TripAdvancePermissionKey
  | LogSlipPermissionKey
  | OrderPermissionKey
  | EwaybillPermissionKey
  | TrackingPermissionKey
  | VPLoadingPermissionKey
  | VPSchedulePermissionKey
  | CashPlanningPermissionKey
  | GRNPermissionKey
  | RailBranchGRNPermissionKey
  | DeliveryChallanPermissionKey
  | RailRakeOperationPermissionKey
  | RakeAtRailHeadPermissionKey
  | RakeAtBranchPermissionKey
  | AdminPermissionKey
  | OneLapTrackerPermissionKey
  | MRRRPermissionKey
  | NotificationPermissionKey
  | AttachmentPermissionKey;

type MasterPerms<Slug extends MasterSlug> = {
  VIEW: `masters.${Slug}.view`;
  CREATE: `masters.${Slug}.create`;
  UPDATE: `masters.${Slug}.update`;
  DELETE: `masters.${Slug}.delete`;
  BULK_IMPORT: `masters.${Slug}.bulk_import`;
  EXPORT: `masters.${Slug}.export`;
};

const masterPerms = <Slug extends MasterSlug>(
  slug: Slug,
): MasterPerms<Slug> => ({
  VIEW: `masters.${slug}.view`,
  CREATE: `masters.${slug}.create`,
  UPDATE: `masters.${slug}.update`,
  DELETE: `masters.${slug}.delete`,
  BULK_IMPORT: `masters.${slug}.bulk_import`,
  EXPORT: `masters.${slug}.export`,
});

export const PERMS = {
  MASTERS: {
    STATE: masterPerms("state"),
    CITY: masterPerms("city"),
    AREA: masterPerms("area"),
    TRANSPORT: masterPerms("transport"),
    VEHICLE: masterPerms("vehicle"),
    SPARE_CATEGORY: masterPerms("spare-category"),
    SPARE_PART: masterPerms("spare-part"),
    SPARE_PART_SUPPLIER: masterPerms("spare-part-supplier"),
    CUSTOMER: masterPerms("customer"),
    ONE_LAP_TRACKER: {
      VIEW: "masters.one-lap-tracker.view",
      UPDATE: "masters.one-lap-tracker.update",
      SYNC: "masters.one-lap-tracker.sync",
    },
    COMPANY: masterPerms("company"),
    BRANCH: masterPerms("branch"),
    ROUTE: masterPerms("route"),
    WAREHOUSE: masterPerms("warehouse"),
    DRIVER: masterPerms("driver"),
    LABOUR: masterPerms("labour"),
    GOODS: masterPerms("goods"),
    UNIT_OF_MEASURE: masterPerms("unit-of-measure"),
    PUMP: masterPerms("pump"),
    WAGON: masterPerms("wagon"),
    RAILWAY_FREIGHT: masterPerms("railway-freight"),
    AGREEMENT: masterPerms("agreement"),
    RATE_MATRIX: masterPerms("rate-matrix"),
    VEHICLE_TYPE: masterPerms("vehicle-type"),
    CREDITOR: masterPerms("creditor"),
    CASH_ACCOUNT: masterPerms("cash-account"),
  },
  LORRY_RECEIPT: {
    VIEW: "lorry_receipt.view",
    CREATE: "lorry_receipt.create",
    UPDATE: "lorry_receipt.update",
    DELETE: "lorry_receipt.delete",
    APPROVE: "lorry_receipt.approve",
    CANCEL: "lorry_receipt.cancel",
    GENERATE_INVOICE: "lorry_receipt.generate_invoice",
    DELIVER: "lorry_receipt.deliver",
    ACKNOWLEDGE: "lorry_receipt.acknowledge",
  },
  VP_LOADING: {
    VIEW: "vp_loading.view",
    CREATE: "vp_loading.create",
    UPDATE: "vp_loading.update",
    DELETE: "vp_loading.delete",
    MARK_LOADED: "vp_loading.mark_loaded",
    CANCEL: "vp_loading.cancel",
    COMPLETE: "vp_loading.complete",
    VERIFY: "vp_loading.verify",
    CAPACITY_OVERRIDE: "vp_loading.capacity_override",
    ASSIGN_TRACKER: "vp_loading.assign_tracker",
    REPLACE_TRACKER: "vp_loading.replace_tracker",
    RELEASE_TRACKER: "vp_loading.release_tracker",
  },
  TRIP: {
    VIEW: "trip.view",
    CREATE: "trip.create",
    UPDATE: "trip.update",
    DELETE: "trip.delete",
    CLOSE: "trip.close",
    CANCEL: "trip.cancel",
    CORRECT_CLOSED: "trip.correct_closed",
  },
  VEHICLE_JOURNEY: {
    VIEW: "vehicle_journey.view",
    CREATE: "vehicle_journey.create",
    UPDATE: "vehicle_journey.update",
    CLOSE: "vehicle_journey.close",
    CANCEL: "vehicle_journey.cancel",
    REOPEN_SETTLEMENT: "vehicle_journey.reopen_settlement",
    OVERRIDE_CHAIN: "vehicle_journey.override_chain",
  },
  TRIP_EXPENSE: {
    VIEW: "trip_expense.view",
    CREATE: "trip_expense.create",
    UPDATE: "trip_expense.update",
    APPROVE: "trip_expense.approve",
    REVERSE: "trip_expense.reverse",
  },
  TRIP_ADVANCE: {
    VIEW: "trip_advance.view",
    CREATE: "trip_advance.create",
    REVERSE: "trip_advance.reverse",
  },
  LOGSLIP: {
    VIEW: "logslip.view",
    GENERATE: "logslip.generate",
    POST_ACCOUNTS: "logslip.post_accounts",
    REOPEN: "logslip.reopen",
    PRINT: "logslip.print",
  },
  VP_SCHEDULE: {
    VIEW: "vp_schedule.view",
    CREATE: "vp_schedule.create",
    UPDATE: "vp_schedule.update",
    DELETE: "vp_schedule.delete",
    CONFIRM: "vp_schedule.confirm",
    CANCEL: "vp_schedule.cancel",
  },
  MRRR: {
    VIEW: "mrrr.view",
    CREATE: "mrrr.create",
    UPDATE: "mrrr.update",
    DELETE: "mrrr.delete",
    SUBMIT: "mrrr.submit",
    CANCEL: "mrrr.cancel",
  },
  GRN: {
    VIEW: "grn.view",
    CREATE: "grn.create",
    UPDATE: "grn.update",
    DELETE: "grn.delete",
    SUBMIT: "grn.submit",
    CANCEL: "grn.cancel",
  },
  RAIL_BRANCH_GRN: {
    VIEW: "rail_branch_grn.view",
    CREATE: "rail_branch_grn.create",
    UPDATE: "rail_branch_grn.update",
    DELETE: "rail_branch_grn.delete",
    SUBMIT: "rail_branch_grn.submit",
    CANCEL: "rail_branch_grn.cancel",
  },
  DELIVERY_CHALLAN: {
    VIEW: "delivery_challan.view",
    CREATE: "delivery_challan.create",
    UPDATE: "delivery_challan.update",
    DELETE: "delivery_challan.delete",
    ISSUE: "delivery_challan.issue",
    CANCEL: "delivery_challan.cancel",
  },
  RAIL_RAKE_OPERATION: {
    VIEW: "rail_rake_operation.view",
    CREATE: "rail_rake_operation.create",
    UPDATE: "rail_rake_operation.update",
    DELETE: "rail_rake_operation.delete",
    SUBMIT: "rail_rake_operation.submit",
  },
  RAKE_AT_RAIL_HEAD: {
    VIEW: "rake_at_rail_head.view",
    CREATE: "rake_at_rail_head.create",
    UPDATE: "rake_at_rail_head.update",
    DELETE: "rake_at_rail_head.delete",
    SUBMIT: "rake_at_rail_head.submit",
  },
  RAKE_AT_BRANCH: {
    VIEW: "rake_at_branch.view",
    CREATE: "rake_at_branch.create",
    UPDATE: "rake_at_branch.update",
    DELETE: "rake_at_branch.delete",
    SUBMIT: "rake_at_branch.submit",
  },
  ORDER: {
    VIEW: "order.view",
    CREATE: "order.create",
    UPDATE: "order.update",
    DELETE: "order.delete",
    APPROVE: "order.approve",
    REJECT: "order.reject",
    CANCEL: "order.cancel",
  },
  EWAYBILL: {
    VIEW: "ewaybill.view",
    CREATE: "ewaybill.create",
    UPDATE: "ewaybill.update",
    DELETE: "ewaybill.delete",
    EXTEND: "ewaybill.extend",
    CANCEL: "ewaybill.cancel",
  },
  TRACKING: {
    VIEW: "tracking.view",
  },
  CASH_PLANNING: {
    VIEW: "cashplanning.view",
    ENTER: "cashplanning.enter",
    APPROVE: "cashplanning.approve",
    CLOSE: "cashplanning.close",
  },
  ADMIN: {
    RBAC_MANAGE: "admin.rbac.manage",
    AUDIT_LOG_VIEW: "admin.audit_log.view",
  },
  NOTIFICATIONS: {
    VIEW: "notifications.view",
    MANAGE_RULES: "notifications.manage_rules",
    MANAGE_TEMPLATES: "notifications.manage_templates",
    TEST_SEND: "notifications.test_send",
  },
  ATTACHMENTS: {
    VIEW: "attachments.view",
    CREATE: "attachments.create",
    DOWNLOAD: "attachments.download",
    DELETE: "attachments.delete",
  },
} as const;

/**
 * Flat list of every permission key. Used by the seed script to upsert the
 * `Permission` catalog table and by the resolver to validate inputs.
 */
export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = (() => {
  const keys = new Set<string>();
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      keys.add(node);
      return;
    }
    if (node && typeof node === "object") {
      for (const v of Object.values(node as Record<string, unknown>)) walk(v);
    }
  };
  walk(PERMS);
  return Array.from(keys).sort() as PermissionKey[];
})();

/**
 * Derive the module code from a permission key. The module is the first two
 * segments for masters (`masters.customer`) and the first segment otherwise
 * (`lorry_receipt`, `trip`, `admin`).
 */
export const moduleCodeOf = (key: PermissionKey): string => {
  const parts = key.split(".");
  return parts[0] === "masters" ? `${parts[0]}.${parts[1]}` : parts[0]!;
};
