import {
  IconActivity,
  IconClipboardList,
  IconLayoutDashboard,
  IconReceipt2,
  IconTruckDelivery,
  IconUser,
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

/** A collapsible group that expands to reveal child links. */
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
export const isNavGroup = (item: NavItem): item is NavGroup =>
  "items" in item;

/**
 * Employee-portal navigation. `disabled` leaves are modules not built yet.
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
    label: "Account",
    items: [
      {
        title: "Notifications",
        href: "/notifications",
        icon: IconActivity,
      },
      {
        title: "Notification preferences",
        href: "/notifications/preferences",
        icon: IconUser,
      },
      {
        title: "Profile",
        href: "/profile",
        icon: IconUser,
        disabled: true,
      },
    ],
  },
];
