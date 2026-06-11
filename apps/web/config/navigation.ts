import {
  IconActivity,
  IconClipboardList,
  IconDatabase,
  IconFileBarcode,
  IconLayoutDashboard,
  IconReceipt2,
  IconSettings,
  IconTruckDelivery,
  IconUser,
  IconWallet,
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
    ],
  },
  {
    label: "Master Data",
    items: [
      {
        title: "Masters",
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
