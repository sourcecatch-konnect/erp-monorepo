import {
  IconBuildingWarehouse,
  IconClipboardList,
  IconFileInvoice,
  IconReceipt2,
  IconRoute,
  IconTool,
  IconTrain,
  IconTruckDelivery,
  type Icon,
} from "@tabler/icons-react";
import type { MyWorkModule } from "@skerp/types";

export type ModuleDef = {
  key: MyWorkModule;
  /** Full name, used in the list header. */
  label: string;
  /** Short name for the area chip, so it is never cut off. */
  short: string;
  /** What kind of work lives here, in the words staff use. */
  covers: string;
  icon: Icon;
};

/** The work-area cards, in the order the business runs. */
export const MODULES: ModuleDef[] = [
  {
    key: "orders",
    label: "Orders",
    short: "Orders",
    covers: "Confirm orders, make LRs",
    icon: IconClipboardList,
  },
  {
    key: "lr",
    label: "LR & delivery",
    short: "LR & delivery",
    covers: "Finish LRs, deliveries, signed copies",
    icon: IconTruckDelivery,
  },
  {
    key: "rail",
    label: "Rail & rake",
    short: "Rail & rake",
    covers: "VP schedule, MR/RR, loading, GRN",
    icon: IconTrain,
  },
  {
    key: "billing",
    label: "Billing & collection",
    short: "Billing",
    covers: "Bills, receipts, overdue payments",
    icon: IconFileInvoice,
  },
  {
    key: "accounts",
    label: "Payments & accounts",
    short: "Payments",
    covers: "Vendor payments, salary, log slips",
    icon: IconReceipt2,
  },
  {
    key: "trips",
    label: "Trips",
    short: "Trips",
    covers: "Close trips, trip expenses",
    icon: IconRoute,
  },
  {
    key: "workshop",
    label: "Workshop",
    short: "Workshop",
    covers: "Job cards, service bills, purchase",
    icon: IconTool,
  },
];

export const ALL_ICON = IconBuildingWarehouse;
