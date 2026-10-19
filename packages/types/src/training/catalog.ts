import type { PermissionKey } from "../permissions.js";

/**
 * Training catalog — the business flow described in plain language.
 *
 * Shared by server (which stages a user owns, who owns the others) and web
 * (what to show). Ownership is derived from permissions, never role names:
 * a user "owns" a stage when they hold any of its `permissions`.
 *
 * Wording rule: write for a branch operator, not a developer. One short
 * sentence per summary, no internal jargon beyond the glossary terms.
 */

export type TrainingLaneKey =
  | "setup"
  | "booking"
  | "road"
  | "rail"
  | "delivery"
  | "accounts"
  | "workshop"
  | "cash";

export type TrainingLane = {
  key: TrainingLaneKey;
  title: string;
  description: string;
};

export const TRAINING_LANES: readonly TrainingLane[] = [
  {
    key: "setup",
    title: "Set up",
    description: "Basic records that every order and trip depends on.",
  },
  {
    key: "booking",
    title: "Booking",
    description: "Taking a customer's order and creating the LRs.",
  },
  {
    key: "road",
    title: "Road transport",
    description: "Trucks, trips, trip expenses and closing the trip.",
  },
  {
    key: "rail",
    title: "Rail transport",
    description: "Rakes, wagon space (VP), railway receipts and GRNs.",
  },
  {
    key: "delivery",
    title: "Delivery",
    description: "Handing over the goods and confirming delivery.",
  },
  {
    key: "accounts",
    title: "Accounts",
    description: "Billing customers, receiving money and paying vendors.",
  },
  {
    key: "workshop",
    title: "Workshop",
    description: "Vehicle repairs, spare parts and service bills.",
  },
  {
    key: "cash",
    title: "Cash planning",
    description: "The day's cash position and planned payments.",
  },
];

export type TrainingStageKey =
  | "setup.masters"
  | "booking.order"
  | "booking.order-approval"
  | "booking.lr"
  | "booking.ewaybill"
  | "road.trip"
  | "road.expenses"
  | "road.close"
  | "rail.vp-schedule"
  | "rail.mrrr"
  | "rail.vp-loading"
  | "rail.rail-head"
  | "rail.branch"
  | "rail.dc"
  | "delivery.deliver"
  | "accounts.bill"
  | "accounts.receipt"
  | "accounts.vendor-payment"
  | "accounts.ledger"
  | "workshop.repair"
  | "cash.planning";

export type TrainingStage = {
  key: TrainingStageKey;
  lane: TrainingLaneKey;
  title: string;
  summary: string;
  /** Screen where the work is done (same hrefs as the sidebar). */
  href: string;
  /** Needed to open `href`; the "Open" link hides without it. */
  viewPermission: PermissionKey;
  /** The user owns this stage if they hold ANY of these. */
  permissions: readonly PermissionKey[];
  /** What usually happens after this stage. */
  next: readonly TrainingStageKey[];
};

export const TRAINING_STAGES: readonly TrainingStage[] = [
  {
    key: "setup.masters",
    lane: "setup",
    title: "Master data",
    summary:
      "Customers, routes, rates, vehicles and drivers that every order uses.",
    href: "/masters",
    viewPermission: "masters.customer.view",
    permissions: [
      "masters.customer.create",
      "masters.route.create",
      "masters.rate-matrix.create",
      "masters.agreement.create",
      "masters.vehicle.create",
      "masters.driver.create",
    ],
    next: ["booking.order"],
  },
  {
    key: "booking.order",
    lane: "booking",
    title: "Book an order",
    summary:
      "Record a customer's request to move goods: from where, to where, when and how many trucks.",
    href: "/orders",
    viewPermission: "order.view",
    permissions: ["order.create"],
    next: ["booking.order-approval"],
  },
  {
    key: "booking.order-approval",
    lane: "booking",
    title: "Approve the order",
    summary:
      "Check the freight worked out from the rate matrix, then confirm or reject the order.",
    href: "/orders",
    viewPermission: "order.view",
    permissions: ["order.approve", "order.reject"],
    next: ["booking.lr"],
  },
  {
    key: "booking.lr",
    lane: "booking",
    title: "Create the LRs",
    summary:
      "Make a Lorry Receipt for each consignment: the legal document for the goods.",
    href: "/lorry-receipts",
    viewPermission: "lorry_receipt.view",
    permissions: ["lorry_receipt.create"],
    next: ["booking.ewaybill", "road.trip", "rail.vp-schedule"],
  },
  {
    key: "booking.ewaybill",
    lane: "booking",
    title: "Attach the e-way bill",
    summary:
      "Add the customer's e-way bill number and update Part-B with the vehicle.",
    href: "/ewaybills",
    viewPermission: "ewaybill.view",
    permissions: ["ewaybill.create", "ewaybill.update"],
    next: ["road.trip"],
  },
  {
    key: "road.trip",
    lane: "road",
    title: "Plan the trip",
    summary: "Assign a vehicle and driver and send the truck on its way.",
    href: "/trips",
    viewPermission: "trip.view",
    permissions: ["trip.create", "vehicle_journey.create"],
    next: ["road.expenses"],
  },
  {
    key: "road.expenses",
    lane: "road",
    title: "Trip expenses and advances",
    summary:
      "Record diesel, toll and other spends, and cash given to the driver.",
    href: "/trips",
    viewPermission: "trip.view",
    permissions: ["trip_expense.create", "trip_advance.create"],
    next: ["road.close"],
  },
  {
    key: "road.close",
    lane: "road",
    title: "Close the trip",
    summary:
      "Enter the end kilometres and close the trip. The Log Slip is ready straight away.",
    href: "/vehicle-journeys",
    viewPermission: "vehicle_journey.view",
    permissions: ["trip.close", "vehicle_journey.close", "logslip.generate"],
    next: ["delivery.deliver"],
  },
  {
    key: "rail.vp-schedule",
    lane: "rail",
    title: "Schedule the VP",
    summary:
      "Plan which wagon space (VP) on the rake each LR will travel in.",
    href: "/vp-management/vp-schedule",
    viewPermission: "vp_schedule.view",
    permissions: ["vp_schedule.create"],
    next: ["rail.mrrr"],
  },
  {
    key: "rail.mrrr",
    lane: "rail",
    title: "Enter MR / RR",
    summary:
      "Type in the Railway Receipt (RR) and Money Receipt (MR) from the paper copies.",
    href: "/vp-management/mrrr",
    viewPermission: "mrrr.view",
    permissions: ["mrrr.create"],
    next: ["rail.vp-loading"],
  },
  {
    key: "rail.vp-loading",
    lane: "rail",
    title: "Load the VP",
    summary: "Record the goods physically loaded into each wagon.",
    href: "/vp-management/vp-loading",
    viewPermission: "vp_loading.view",
    permissions: ["vp_loading.create"],
    next: ["rail.rail-head"],
  },
  {
    key: "rail.rail-head",
    lane: "rail",
    title: "Rake and GRN at the rail head",
    summary:
      "Record the rake's arrival and the goods received at the rail head, with demurrage and other charges.",
    href: "/vp-management/grn",
    viewPermission: "grn.view",
    permissions: ["grn.create", "rake_at_rail_head.create"],
    next: ["rail.branch"],
  },
  {
    key: "rail.branch",
    lane: "rail",
    title: "Rake and GRN at the branch",
    summary: "Record the goods received at the destination branch.",
    href: "/vp-management/branch-grn",
    viewPermission: "rail_branch_grn.view",
    permissions: ["rail_branch_grn.create", "rake_at_branch.create"],
    next: ["rail.dc"],
  },
  {
    key: "rail.dc",
    lane: "rail",
    title: "Issue the Delivery Challan",
    summary:
      "Hand the LRs over to the truck that does the last-mile delivery.",
    href: "/vp-management/delivery-challans",
    viewPermission: "delivery_challan.view",
    permissions: ["delivery_challan.create", "delivery_challan.issue"],
    next: ["delivery.deliver"],
  },
  {
    key: "delivery.deliver",
    lane: "delivery",
    title: "Deliver and confirm",
    summary:
      "Mark the goods delivered, note any shortage or damage, and upload the signed POD.",
    href: "/lorry-receipts/deliveries",
    viewPermission: "lorry_receipt.view",
    permissions: ["lorry_receipt.deliver", "lorry_receipt.acknowledge"],
    next: ["accounts.bill"],
  },
  {
    key: "accounts.bill",
    lane: "accounts",
    title: "Bill the customer",
    summary:
      "Pick the delivered LRs and create the bill. GST is worked out for you.",
    href: "/accounts/lr-to-bill",
    viewPermission: "billing.view",
    permissions: ["billing.create", "billing.finalise"],
    next: ["accounts.receipt"],
  },
  {
    key: "accounts.receipt",
    lane: "accounts",
    title: "Receive payment",
    summary:
      "Record money received from the customer and match it to bills, including TDS.",
    href: "/accounts/receipts",
    viewPermission: "receipt.view",
    permissions: ["receipt.create"],
    next: ["accounts.ledger"],
  },
  {
    key: "accounts.vendor-payment",
    lane: "accounts",
    title: "Pay vendors",
    summary:
      "Raise, approve and pay slips for brokers, transporters and labour.",
    href: "/accounts/vendor-payments",
    viewPermission: "accounts.payment.view",
    permissions: [
      "accounts.payment.create",
      "accounts.payment.approve",
      "accounts.payment.disburse",
    ],
    next: ["accounts.ledger"],
  },
  {
    key: "accounts.ledger",
    lane: "accounts",
    title: "Ledgers and day book",
    summary:
      "See every posting by account and date, and add a manual journal when needed.",
    href: "/ledger",
    viewPermission: "ledger.view",
    permissions: ["ledger.view", "ledger.journal_create"],
    next: [],
  },
  {
    key: "workshop.repair",
    lane: "workshop",
    title: "Workshop",
    summary:
      "Buy spare parts, open job cards for repairs and pay service bills.",
    href: "/workshop/job-cards",
    viewPermission: "workshop.jobcard.view",
    permissions: [
      "workshop.po.manage",
      "workshop.inward.manage",
      "workshop.jobcard.manage",
      "workshop.servicebill.manage",
    ],
    next: [],
  },
  {
    key: "cash.planning",
    lane: "cash",
    title: "Cash planning",
    summary:
      "Enter the day's cash position and planned payments, and get them approved.",
    href: "/cash-planning",
    viewPermission: "cashplanning.view",
    permissions: ["cashplanning.enter", "cashplanning.approve"],
    next: [],
  },
];

/** Every permission key referenced by a stage — used to find stage owners. */
export const TRAINING_STAGE_PERMISSION_KEYS: readonly PermissionKey[] =
  Array.from(new Set(TRAINING_STAGES.flatMap((stage) => stage.permissions)));

export const isStageOwned = (
  stage: TrainingStage,
  has: (key: PermissionKey) => boolean,
): boolean => stage.permissions.some(has);
