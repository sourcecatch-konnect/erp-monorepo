import {
  IconActivity,
  IconClipboardList,
  IconDatabase,
  IconFileBarcode,
  IconLayoutDashboard,
  IconReceipt2,
  IconSettings,
  IconTruckDelivery,
  IconWallet,
  type Icon,
} from "@tabler/icons-react";

/** A Tabler icon component. */
export type NavIcon = Icon;

/** A direct, navigable link. */
export type NavLeaf = {
  title: string;
  href: string;
  /** Module not built yet — rendered greyed out and non-clickable. */
  disabled?: boolean;
};

/** A top-level sidebar link (carries its own icon). */
export type NavLink = NavLeaf & { icon: NavIcon };

/** A collapsible group that expands to reveal child links (the "dropdown" menu type). */
export type NavGroup = {
  title: string;
  icon: NavIcon;
  items: NavLeaf[];
};

export type NavItem = NavLink | NavGroup;

/** A labelled section — the visual "break point" between menu blocks. */
export type NavSection = {
  label: string;
  items: NavItem[];
};

/** Narrows a NavItem to a collapsible group. */
export const isNavGroup = (item: NavItem): item is NavGroup => "items" in item;

/**
 * Sidebar navigation. `disabled` leaves are modules not built yet.
 * As a module ships: remove its `disabled` flag and add its route.
 */
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
        disabled: true,
      },
      {
        title: "Lorry Receipts",
        href: "/lorry-receipts",
        icon: IconReceipt2,
        disabled: true,
      },
      {
        title: "Trips",
        href: "/trips",
        icon: IconTruckDelivery,
        disabled: true,
      },
      {
        title: "Operations",
        href: "/operations",
        icon: IconActivity,
        disabled: true,
      },
      {
        title: "E-Way Bills",
        icon: IconFileBarcode,
        items: [
          { title: "Dashboard", href: "/ewaybills" },
          { title: "Inbox", href: "/ewaybills/inbox" },
        ],
      },
    ],
  },
  {
  label: "Master Data",
  items: [
    {
      title: "Masters",
      icon: IconDatabase,
      items: [
        { title: "States", href: "/masters/state" },
        { title: "Cities", href: "/masters/city" },
        { title: "Areas", href: "/masters/area" },
        { title: "Drivers", href: "/masters/driver" },
        { title: "Transports", href: "/masters/transport" },
        { title: "Vehicles", href: "/masters/vehicle" },
        { title: "Spare Parts", href: "/masters/spare-parts" },
        { title: "Spare Categories", href: "/masters/spare-category" },
        { title: "Spare Part Supplier", href: "/masters/spare-part-supplier" },
        { title: "Customer", href: "/masters/customer" },
        { title: "Company", href: "/masters/company" },
        { title: "Branches", href: "/masters/branch" },
        { title: "Routes", href: "/masters/route" },
        { title: "Warehouses", href: "/masters/warehouse" },
        { title: "Labours", href: "/masters/labour" },
        { title: "Goods", href: "/masters/goods" },
        { title: "Pumps", href: "/masters/pumps" },
        { title: "Wagons", href: "/masters/wagons" },
        { title: "Railway Freight", href: "/masters/railway-freight" },
         { title: "Agreements", href: "/masters/agreement" },
         { title: "Rate Matrix", href: "/masters/rate-matrix" }
      ],
    },
  ],
},
  {
    label: "Finance",
    items: [
      {
        title: "Accounts",
        href: "/accounts",
        icon: IconWallet,
        disabled: true,
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
          { title: "Users", href: "/settings/users" },
          { title: "User access", href: "/settings/access" },
          { title: "Roles", href: "/settings/roles" },
          { title: "Notifications", href: "/settings/notifications" },
          { title: "Audit log", href: "/settings/audit-log" },
        ],
      },
    ],
  },
];
