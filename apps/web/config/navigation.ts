import {
  IconActivity,
  IconClipboardList,
  IconDatabase,
  IconFileBarcode,
  IconLayoutDashboard,
  IconReceipt2,
  IconRoute,
  IconSettings,
  IconTrain,
  IconTruckDelivery,
  IconUser,
  IconWallet,
  IconCashBanknote,
  type Icon,
} from "@tabler/icons-react";
import { PERMS, type PermissionKey } from "@skerp/types";

export type NavIcon = Icon;

export type NavLeaf = {
  title: string;
  href: string;
  permission?: PermissionKey;
  disabled?: boolean;
};

export type NavLink = NavLeaf & { icon: NavIcon };

export type NavGroup = {
  title: string;
  icon: NavIcon;
  items: NavLeaf[];
};

export type NavItem = NavLink | NavGroup;

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const isNavGroup = (item: NavItem): item is NavGroup => "items" in item;

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: IconLayoutDashboard,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "Orders",
        href: "/orders",
        icon: IconClipboardList,
        permission: PERMS.ORDER.VIEW,
      },
      {
        title: "Lorry Receipts",
        href: "/lorry-receipts",
        icon: IconReceipt2,
        permission: PERMS.LORRY_RECEIPT.VIEW,
        disabled: false,
      },
      {
        title: "Deliveries",
        href: "/lorry-receipts/deliveries",
        icon: IconTruckDelivery,
        permission: PERMS.LORRY_RECEIPT.VIEW,
      },
      {
        title: "LR Unloading Report",
        href: "/lorry-receipts/unloading-report",
        icon: IconFileBarcode,
        permission: PERMS.LORRY_RECEIPT.VIEW,
      },
      {
        title: "VP Management",
        icon: IconTrain,
        items: [
          {
            title: "VP Schedule",
            href: "/vp-management/vp-schedule",
            permission: PERMS.VP_SCHEDULE.VIEW,
          },
          {
            title: "VP Loading",
            href: "/vp-management/vp-loading",
            permission: PERMS.VP_LOADING.VIEW,
          },
          {
            title: "MR / RR",
            href: "/vp-management/mrrr",
            permission: PERMS.MRRR.VIEW,
          },
          {
            title: "GRN At Rail Head",
            href: "/vp-management/grn",
            permission: PERMS.GRN.VIEW,
          },
          {
            title: "GRN At Branch",
            href: "/vp-management/branch-grn",
            permission: PERMS.RAIL_BRANCH_GRN.VIEW,
          },
          {
            title: "Rake & DC/WC At Rail Head",
            href: "/vp-management/rake-at-rail-head",
            permission: PERMS.RAKE_AT_RAIL_HEAD.VIEW,
          },
          {
            title: "Rake & DC/WC At Branch",
            href: "/vp-management/rake-at-branch",
            permission: PERMS.RAKE_AT_BRANCH.VIEW,
          },
          {
            title: "Delivery Challans",
            href: "/vp-management/delivery-challans",
            permission: PERMS.DELIVERY_CHALLAN.VIEW,
          },
        ],
      },
      {
        title: "E-Way Bills",
        icon: IconFileBarcode,
        items: [
          {
            title: "Dashboard",
            href: "/ewaybills",
            permission: PERMS.EWAYBILL.VIEW,
          },
          {
            title: "Inbox",
            href: "/ewaybills/inbox",
            permission: PERMS.EWAYBILL.VIEW,
          },
        ],
      },
    ],
  },
  {
    label: "Container",
    items: [
      {
        title: "Trips",
        href: "/trips",
        icon: IconTruckDelivery,
        permission: PERMS.TRIP.VIEW,
      },
      {
        title: "Vehicle Journeys",
        href: "/vehicle-journeys",
        icon: IconRoute,
        permission: PERMS.VEHICLE_JOURNEY.VIEW,
      },
      {
        title: "Wagon Tracking",
        href: "/tracking",
        icon: IconTrain,
        permission: PERMS.TRACKING.VIEW,
      },
    ],
  },
  {
    label: "Master Data",
    items: [
      {
        title: "Masters",
        href: "/masters",
        icon: IconDatabase,
        items: [
          {
            title: "States",
            href: "/masters/state",
            permission: PERMS.MASTERS.STATE.VIEW,
          },
          {
            title: "Cities",
            href: "/masters/city",
            permission: PERMS.MASTERS.CITY.VIEW,
          },
          {
            title: "Areas",
            href: "/masters/area",
            permission: PERMS.MASTERS.AREA.VIEW,
          },
          {
            title: "Drivers",
            href: "/masters/driver",
            permission: PERMS.MASTERS.DRIVER.VIEW,
          },
          {
            title: "Transports",
            href: "/masters/transport",
            permission: PERMS.MASTERS.TRANSPORT.VIEW,
          },
          {
            title: "Vehicles",
            href: "/masters/vehicle",
            permission: PERMS.MASTERS.VEHICLE.VIEW,
          },
          {
            title: "OneLap Trackers",
            href: "/masters/one-lap-trackers",
            permission: PERMS.MASTERS.ONE_LAP_TRACKER.VIEW,
          },
          {
            title: "Vehicle Types",
            href: "/masters/vehicle-type",
            permission: PERMS.MASTERS.VEHICLE_TYPE.VIEW,
          },
          {
            title: "Spare Parts",
            href: "/masters/spare-parts",
            permission: PERMS.MASTERS.SPARE_PART.VIEW,
          },
          {
            title: "Spare Categories",
            href: "/masters/spare-category",
            permission: PERMS.MASTERS.SPARE_CATEGORY.VIEW,
          },
          {
            title: "Spare Part Supplier",
            href: "/masters/spare-part-supplier",
            permission: PERMS.MASTERS.SPARE_PART_SUPPLIER.VIEW,
          },
          {
            title: "Customer",
            href: "/masters/customer",
            permission: PERMS.MASTERS.CUSTOMER.VIEW,
          },
          {
            title: "Company",
            href: "/masters/company",
            permission: PERMS.MASTERS.COMPANY.VIEW,
          },
          {
            title: "Branches",
            href: "/masters/branch",
            permission: PERMS.MASTERS.BRANCH.VIEW,
          },
          {
            title: "Routes",
            href: "/masters/route",
            permission: PERMS.MASTERS.ROUTE.VIEW,
          },
          {
            title: "Warehouses",
            href: "/masters/warehouse",
            permission: PERMS.MASTERS.WAREHOUSE.VIEW,
          },
          {
            title: "Labours",
            href: "/masters/labour",
            permission: PERMS.MASTERS.LABOUR.VIEW,
          },
          {
            title: "Goods",
            href: "/masters/goods",
            permission: PERMS.MASTERS.GOODS.VIEW,
          },
          {
            title: "Units of Measure",
            href: "/masters/unit-of-measure",
            permission: PERMS.MASTERS.UNIT_OF_MEASURE.VIEW,
          },
          {
            title: "Pumps",
            href: "/masters/pumps",
            permission: PERMS.MASTERS.PUMP.VIEW,
          },
          {
            title: "Wagons",
            href: "/masters/wagons",
            permission: PERMS.MASTERS.WAGON.VIEW,
          },
          {
            title: "Railway Freight",
            href: "/masters/railway-freight",
            permission: PERMS.MASTERS.RAILWAY_FREIGHT.VIEW,
          },
          {
            title: "Agreements",
            href: "/masters/agreement",
            permission: PERMS.MASTERS.AGREEMENT.VIEW,
          },
          {
            title: "Rate Matrix",
            href: "/masters/rate-matrix",
            permission: PERMS.MASTERS.RATE_MATRIX.VIEW,
          },
          {
            title: "Creditors",
            href: "/masters/creditor",
            permission: PERMS.MASTERS.CREDITOR.VIEW,
          },
          {
            title: "Cash Accounts",
            href: "/masters/cash-account",
            permission: PERMS.MASTERS.CASH_ACCOUNT.VIEW,
          },
        ],
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        title: "Cash Planning",
        href: "/cash-planning",
        icon: IconCashBanknote,
        permission: PERMS.CASH_PLANNING.VIEW,
      },
      {
        title: "Accounts",
        href: "/accounts",
        icon: IconWallet,
        disabled: true,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        title: "Notifications",
        href: "/notifications",
        icon: IconActivity,
        permission: PERMS.NOTIFICATIONS.VIEW,
      },
      {
        title: "Notification preferences",
        href: "/notifications/preferences",
        icon: IconUser,
        permission: PERMS.NOTIFICATIONS.VIEW,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Settings",
        icon: IconSettings,
        items: [
          { title: "Profile", href: "/settings/profile" },
          {
            title: "Users",
            href: "/settings/users",
            permission: PERMS.ADMIN.RBAC_MANAGE,
          },
          {
            title: "User access",
            href: "/settings/access",
            permission: PERMS.ADMIN.RBAC_MANAGE,
          },
          {
            title: "Roles",
            href: "/settings/roles",
            permission: PERMS.ADMIN.RBAC_MANAGE,
          },
          {
            title: "Notifications",
            href: "/settings/notifications",
            permission: PERMS.NOTIFICATIONS.MANAGE_RULES,
          },
          {
            title: "Audit log",
            href: "/settings/audit-log",
            permission: PERMS.ADMIN.AUDIT_LOG_VIEW,
          },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Nav search — flat, permission-filtered index of every reachable page
 * ------------------------------------------------------------------ */

/** A nav entry is visible when it carries no permission or the user has it. */
export const canShowNavLink = (
  link: { permission?: PermissionKey },
  permissions: string[] | undefined,
) => !link.permission || Boolean(permissions?.includes(link.permission));

export type NavSearchEntry = {
  /** Stable key — a page can appear once per href/title pair. */
  id: string;
  title: string;
  href: string;
  icon: NavIcon;
  /** Section label, e.g. "Operations". */
  section: string;
  /** Parent group title when the page sits inside one, e.g. "Masters". */
  group?: string;
  /** Lowercased text the matcher searches (title + group + section + href). */
  haystack: string;
};

const toEntry = (
  title: string,
  href: string,
  icon: NavIcon,
  section: string,
  group?: string,
): NavSearchEntry => ({
  id: `${href}:${title}`,
  title,
  href,
  icon,
  section,
  group,
  haystack: [title, group ?? "", section, href.replace(/[-/]/g, " ")]
    .join(" ")
    .toLowerCase(),
});

/**
 * Flattens `NAV_SECTIONS` into every page the user may open — top-level links,
 * group landing pages (e.g. Masters → /masters) and all group children.
 * Disabled ("coming soon") entries are left out; they can't be navigated to.
 */
export function buildNavSearchIndex(
  permissions: string[] | undefined,
): NavSearchEntry[] {
  const entries: NavSearchEntry[] = [];

  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (!isNavGroup(item)) {
        if (item.disabled || !canShowNavLink(item, permissions)) continue;
        entries.push(toEntry(item.title, item.href, item.icon, section.label));
        continue;
      }

      const children = item.items.filter(
        (child) => !child.disabled && canShowNavLink(child, permissions),
      );
      if (!children.length) continue;

      // Some groups double as a real page (Masters → /masters).
      if ("href" in item && typeof item.href === "string") {
        entries.push(toEntry(item.title, item.href, item.icon, section.label));
      }

      for (const child of children) {
        entries.push(
          toEntry(child.title, child.href, item.icon, section.label, item.title),
        );
      }
    }
  }

  return entries;
}

/**
 * Ranks the index against a free-text query. Every whitespace-separated token
 * must match somewhere; title matches outrank group/section/href matches, and a
 * title *prefix* outranks a title substring. An empty query returns the whole
 * index in nav order.
 */
export function searchNavEntries(
  entries: NavSearchEntry[],
  query: string,
): NavSearchEntry[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return entries;

  const scored: { entry: NavSearchEntry; score: number }[] = [];

  for (const entry of entries) {
    const title = entry.title.toLowerCase();
    let score = 0;
    let matchesAll = true;

    for (const token of tokens) {
      if (!entry.haystack.includes(token)) {
        matchesAll = false;
        break;
      }
      if (title.startsWith(token)) score += 3;
      else if (title.includes(token)) score += 2;
      else score += 1;
    }

    if (matchesAll) scored.push({ entry, score });
  }

  // Stable sort keeps nav order for equally-scoring pages.
  return scored.sort((a, b) => b.score - a.score).map(({ entry }) => entry);
}
