import {
  IconBuildingBank,
  IconCashBanknote,
  IconClipboardList,
  IconDatabase,
  IconTool,
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
    description: "Short distances go by road. Long distances usually go by rail.",
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
    key: "accounts",
    title: "Accounts",
    description: "Money comes in from customers and goes out to vendors.",
    icon: IconWallet,
    paths: [
      { label: "Money coming in", stages: ["accounts.bill", "accounts.receipt"] },
      { label: "Money going out", stages: ["accounts.vendor-payment"] },
    ],
  },
  {
    key: "books",
    title: "Books",
    description: "Every bill, receipt and payment ends up in the ledgers.",
    icon: IconBuildingBank,
    paths: [{ stages: ["accounts.ledger"] }],
  },
];

/** Work that runs alongside the main flow rather than in sequence with it. */
export const SIDE_FLOWS: MapSection[] = [
  {
    key: "workshop",
    title: "Workshop",
    description: "Keeps SK's own vehicles running.",
    icon: IconTool,
    paths: [{ stages: ["workshop.repair"] }],
  },
  {
    key: "cash",
    title: "Cash planning",
    description: "The day's money, planned and approved.",
    icon: IconCashBanknote,
    paths: [{ stages: ["cash.planning"] }],
  },
];
