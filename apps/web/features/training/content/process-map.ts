import {
  IconBuildingBank,
  IconCashBanknote,
  IconClipboardList,
  IconDatabase,
  IconLayoutGrid,
  IconShieldLock,
  IconTool,
  IconUserDollar,
  IconTrain,
  IconTruck,
  IconTruckDelivery,
  IconWallet,
  type Icon,
} from "@tabler/icons-react";
import type { TrainingStageKey } from "@skerp/types";

/**
 * How the process map is drawn: numbered sections read top to bottom, each
 * with one or more paths that read left to right. Road and rail are two
 * paths side by side in "Transport", so they are visibly separate routes.
 */
export type MapPath = {
  label?: string;
  icon?: Icon;
  stages: TrainingStageKey[];
};

export type MapSection = {
  key: string;
  title: string;
  description: string;
  icon: Icon;
  paths: MapPath[];
};

export const MAIN_FLOW: MapSection[] = [
  {
    key: "setup",
    title: "Set up",
    description: "The lists everything else picks from.",
    icon: IconDatabase,
    paths: [{ stages: ["setup.masters"] }],
  },
  {
    key: "booking",
    title: "Booking",
    description: "The customer asks, a manager confirms, LRs are made.",
    icon: IconClipboardList,
    paths: [
      {
        stages: [
          "booking.order",
          "booking.order-approval",
          "booking.lr",
          "booking.ewaybill",
        ],
      },
    ],
  },
  {
    key: "transport",
    title: "Transport",
    description:
      "Short distances go by road. Long distances usually go by rail.",
    icon: IconTruck,
    paths: [
      {
        label: "By road (truck)",
        icon: IconTruck,
        stages: ["road.trip", "road.expenses", "road.close"],
      },
      {
        label: "By rail (train)",
        icon: IconTrain,
        stages: [
          "rail.vp-schedule",
          "rail.mrrr",
          "rail.vp-loading",
          "rail.rail-head",
          "rail.branch",
          "rail.dc",
        ],
      },
    ],
  },
  {
    key: "delivery",
    title: "Delivery",
    description: "The goods reach the consignee and the POD comes back.",
    icon: IconTruckDelivery,
    paths: [{ stages: ["delivery.deliver"] }],
  },
  {
    // "Books" used to be a sixth section holding one stage. A whole numbered
    // part of the business for one screen read as more than it was, so the
    // ledger now sits here, as the third thing money does.
    key: "accounts",
    title: "Accounts",
    description:
      "Money comes in from customers, goes out to vendors, and is recorded.",
    icon: IconWallet,
    paths: [
      {
        label: "Money coming in",
        icon: IconCashBanknote,
        stages: ["accounts.bill", "accounts.receipt"],
      },
      {
        label: "Money going out",
        icon: IconWallet,
        stages: ["accounts.vendor-payment"],
      },
      {
        label: "Into the books",
        icon: IconBuildingBank,
        stages: ["accounts.ledger"],
      },
    ],
  },
];

/** Work that runs alongside the main flow rather than in sequence with it. */
export const SIDE_FLOWS: MapSection[] = [
  {
    key: "workshop",
    title: "Workshop",
    description:
      "Keeps SK's own vehicles running — parts in, repairs done, bills paid.",
    icon: IconTool,
    paths: [
      {
        label: "Parts and repairs",
        icon: IconTool,
        stages: [
          "workshop.purchase-order",
          "workshop.inward",
          "workshop.job-card",
        ],
      },
      {
        label: "Bills and returns",
        icon: IconCashBanknote,
        stages: ["workshop.service-bill", "workshop.replacement"],
      },
    ],
  },
  {
    key: "driver",
    title: "Driver pay",
    description: "What the drivers are owed, and when they are paid.",
    icon: IconUserDollar,
    paths: [
      { stages: ["driver.advance", "driver.salary-run", "driver.payout"] },
    ],
  },
  {
    key: "cash",
    title: "Cash planning",
    description: "The day's money, planned and approved.",
    icon: IconCashBanknote,
    paths: [{ stages: ["cash.planning"] }],
  },
  {
    key: "admin",
    title: "Administration",
    description: "Who can do what, and the record of what they did.",
    icon: IconShieldLock,
    paths: [{ stages: ["admin.access", "admin.audit"] }],
  },
  {
    key: "daily",
    title: "Every day",
    description: "The screens you open whatever your role is.",
    icon: IconLayoutGrid,
    paths: [{ stages: ["daily.my-work", "daily.tracking"] }],
  },
];

/**
 * One learning accent per section, so the map reads as distinct parts of the
 * business rather than one long blue column. Keys match MAIN_FLOW /
 * SIDE_FLOWS; anything missing falls back to the primary tone.
 */
export const SECTION_TONES: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  setup: 6,
  booking: 4,
  transport: 1,
  delivery: 2,
  accounts: 5,
  books: 5,
  workshop: 3,
  driver: 5,
  cash: 2,
  admin: 6,
  daily: 4,
};
