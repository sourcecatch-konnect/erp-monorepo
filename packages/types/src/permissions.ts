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

const CRUD = ["view", "create", "update", "delete"] as const;
type CrudAction = (typeof CRUD)[number];

const MASTER_SLUGS = [
  "state",
  "city",
  "area",
  "transport",
  "vehicle",
  "spare-category",
  "spare-part",
  "spare-part-supplier",
  "customer",
  "company",
  "branch",
  "route",
  "warehouse",
  "driver",
  "labour",
  "goods",
  "pump",
  "wagon",
  "railway-freight",
  "agreement",
  "rate-matrix",
  "vehicle-type",
  "creditor",
  "cash-account",
] as const;

export type MasterSlug = (typeof MASTER_SLUGS)[number];

type MasterPermissionKey =
  | `masters.${MasterSlug}.${CrudAction}`
  | `masters.${MasterSlug}.bulk_import`
  | `masters.${MasterSlug}.export`;

type LorryReceiptPermissionKey =
  | `lorry_receipt.${CrudAction}`
  | "lorry_receipt.approve"
  | "lorry_receipt.cancel"
  | "lorry_receipt.generate_invoice";

type TripPermissionKey =
  | `trip.${CrudAction}`
  | "trip.close"
  | "trip.cancel";

type VPSchedulePermissionKey =
  | `vp_schedule.${CrudAction}`
  | "vp_schedule.confirm"
  | "vp_schedule.cancel";

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

type AdminPermissionKey =
  | "admin.rbac.manage"
  | "admin.audit_log.view";

type NotificationPermissionKey =
  | "notifications.view"
  | "notifications.manage_rules"
  | "notifications.manage_templates"
  | "notifications.test_send";

type AttachmentPermissionKey =
  | "attachments.view"
  | "attachments.create"
  | "attachments.download"
  | "attachments.delete";

export type PermissionKey =
  | MasterPermissionKey
  | LorryReceiptPermissionKey
  | TripPermissionKey
  | OrderPermissionKey
  | EwaybillPermissionKey
  | TrackingPermissionKey
  | VPSchedulePermissionKey
  | CashPlanningPermissionKey
  | AdminPermissionKey
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

const masterPerms = <Slug extends MasterSlug>(slug: Slug): MasterPerms<Slug> => ({
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
    COMPANY: masterPerms("company"),
    BRANCH: masterPerms("branch"),
    ROUTE: masterPerms("route"),
    WAREHOUSE: masterPerms("warehouse"),
    DRIVER: masterPerms("driver"),
    LABOUR: masterPerms("labour"),
    GOODS: masterPerms("goods"),
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
  },
  TRIP: {
    VIEW: "trip.view",
    CREATE: "trip.create",
    UPDATE: "trip.update",
    DELETE: "trip.delete",
    CLOSE: "trip.close",
    CANCEL: "trip.cancel",
  },
  VP_SCHEDULE: {
  VIEW: "vp_schedule.view",
  CREATE: "vp_schedule.create",
  UPDATE: "vp_schedule.update",
  DELETE: "vp_schedule.delete",
  CONFIRM: "vp_schedule.confirm",
  CANCEL: "vp_schedule.cancel",
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
