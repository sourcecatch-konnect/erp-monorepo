import type { PermissionKey } from "../permissions.js";

/**
 * Training catalog — the business flow and the role tracks, in plain language.
 *
 * Shared by server (which stages a user owns, who owns the others, which
 * tracks apply) and web (what to show). Ownership comes from permissions,
 * never role names: a user "owns" a stage when they hold any of its actions.
 *
 * Wording rule: write for a branch operator, not a developer. Short
 * sentences, everyday words, glossary terms only where the screen uses them.
 * Longer stage explanations live in apps/web/features/training/content/.
 */

/* ------------------------------------------------------------------ */
/* Lanes + stages (the business flow)                                  */
/* ------------------------------------------------------------------ */

export type TrainingLaneKey =
  | "setup"
  | "booking"
  | "road"
  | "rail"
  | "delivery"
  | "accounts"
  | "workshop"
  | "driver"
  | "cash"
  | "admin"
  | "daily";

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
    key: "driver",
    title: "Driver pay",
    description: "Advances, monthly salary runs and payouts to drivers.",
  },
  {
    key: "cash",
    title: "Cash planning",
    description: "The day's cash position and planned payments.",
  },
  {
    key: "admin",
    title: "Administration",
    description: "Users, roles, branch access and the audit log.",
  },
  {
    key: "daily",
    title: "Every day",
    description: "The screens you open whatever your role is.",
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
  | "workshop.purchase-order"
  | "workshop.inward"
  | "workshop.job-card"
  | "workshop.service-bill"
  | "workshop.replacement"
  | "driver.advance"
  | "driver.salary-run"
  | "driver.payout"
  | "cash.planning"
  | "admin.access"
  | "admin.audit"
  | "daily.my-work"
  | "daily.tracking";

/** One thing a user can do at a stage, phrased for "What you can do". */
export type TrainingAction = { key: PermissionKey; label: string };

export type TrainingStage = {
  key: TrainingStageKey;
  lane: TrainingLaneKey;
  title: string;
  summary: string;
  /** Screen where the work is done (same hrefs as the sidebar). */
  href: string;
  /**
   * Needed to open `href`; the "Open" link hides without it. `null` for the
   * few screens every signed-in user can open (My Work), so the map does not
   * have to invent a permission that does not exist in the registry.
   */
  viewPermission: PermissionKey | null;
  /** The user owns this stage if they hold ANY of these. */
  actions: readonly TrainingAction[];
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
    actions: [
      { key: "masters.customer.create", label: "Add and edit customers" },
      { key: "masters.route.create", label: "Add routes" },
      {
        key: "masters.rate-matrix.create",
        label: "Set freight rates (rate matrix)",
      },
      { key: "masters.agreement.create", label: "Add customer agreements" },
      { key: "masters.vehicle.create", label: "Add vehicles" },
      { key: "masters.driver.create", label: "Add drivers" },
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
    actions: [
      { key: "order.create", label: "Book new orders" },
      { key: "order.update", label: "Change orders before approval" },
      { key: "order.cancel", label: "Cancel orders" },
    ],
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
    actions: [
      { key: "order.approve", label: "Confirm orders" },
      { key: "order.reject", label: "Reject orders" },
    ],
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
    actions: [
      { key: "lorry_receipt.create", label: "Create LRs" },
      { key: "lorry_receipt.update", label: "Edit draft LRs" },
      { key: "lorry_receipt.approve", label: "Finalise LRs" },
      { key: "lorry_receipt.cancel", label: "Cancel LRs" },
    ],
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
    actions: [
      { key: "ewaybill.create", label: "Attach e-way bills to LRs" },
      { key: "ewaybill.update", label: "Update Part-B (vehicle details)" },
      { key: "ewaybill.extend", label: "Extend e-way bill validity" },
      { key: "ewaybill.cancel", label: "Cancel e-way bills" },
    ],
    next: ["road.trip"],
  },
  {
    key: "road.trip",
    lane: "road",
    title: "Plan the trip",
    summary: "Assign a vehicle and driver and send the truck on its way.",
    href: "/trips",
    viewPermission: "trip.view",
    actions: [
      { key: "trip.create", label: "Plan trips" },
      { key: "trip.update", label: "Change planned trips" },
      { key: "vehicle_journey.create", label: "Start vehicle journeys" },
      { key: "trip.cancel", label: "Cancel trips" },
    ],
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
    actions: [
      { key: "trip_expense.create", label: "Enter trip expenses" },
      { key: "trip_expense.approve", label: "Approve trip expenses" },
      { key: "trip_advance.create", label: "Give driver advances" },
      { key: "trip_expense.reverse", label: "Reverse wrong expenses" },
    ],
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
    actions: [
      { key: "trip.close", label: "Close trips" },
      { key: "vehicle_journey.close", label: "Close vehicle journeys" },
      { key: "logslip.generate", label: "Generate Log Slips" },
      { key: "logslip.post_accounts", label: "Post Log Slips to accounts" },
      { key: "logslip.reopen", label: "Reopen Log Slips" },
    ],
    next: ["delivery.deliver"],
  },
  {
    key: "rail.vp-schedule",
    lane: "rail",
    title: "Schedule the VP",
    summary: "Plan which wagon space (VP) on the rake each LR will travel in.",
    href: "/vp-management/vp-schedule",
    viewPermission: "vp_schedule.view",
    actions: [
      { key: "vp_schedule.create", label: "Create VP schedules" },
      { key: "vp_schedule.confirm", label: "Confirm VP schedules" },
      { key: "vp_schedule.cancel", label: "Cancel VP schedules" },
    ],
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
    actions: [
      { key: "mrrr.create", label: "Enter MR / RR" },
      { key: "mrrr.submit", label: "Submit MR / RR" },
    ],
    next: ["rail.vp-loading"],
  },
  {
    key: "rail.vp-loading",
    lane: "rail",
    title: "Load the VP",
    summary: "Record the goods physically loaded into each wagon.",
    href: "/vp-management/vp-loading",
    viewPermission: "vp_loading.view",
    actions: [
      { key: "vp_loading.create", label: "Record VP loading" },
      { key: "vp_loading.mark_loaded", label: "Mark wagons loaded" },
      { key: "vp_loading.verify", label: "Verify loading" },
      {
        key: "vp_loading.capacity_override",
        label: "Allow loading over capacity",
      },
      { key: "vp_loading.assign_tracker", label: "Assign GPS trackers" },
    ],
    next: ["rail.rail-head"],
  },
  {
    key: "rail.rail-head",
    lane: "rail",
    title: "Rake and GRN at the rail head",
    summary:
      "Record the rake at the rail head with demurrage and other charges, and the goods received there.",
    href: "/vp-management/grn",
    viewPermission: "grn.view",
    actions: [
      {
        key: "rake_at_rail_head.create",
        label: "Record the rake at the rail head",
      },
      { key: "grn.create", label: "Enter the GRN at the rail head" },
      { key: "grn.submit", label: "Submit the rail head GRN" },
    ],
    next: ["rail.branch"],
  },
  {
    key: "rail.branch",
    lane: "rail",
    title: "Rake and GRN at the branch",
    summary: "Record the goods received at the destination branch.",
    href: "/vp-management/branch-grn",
    viewPermission: "rail_branch_grn.view",
    actions: [
      { key: "rake_at_branch.create", label: "Record the rake at the branch" },
      { key: "rail_branch_grn.create", label: "Enter the GRN at the branch" },
      { key: "rail_branch_grn.submit", label: "Submit the branch GRN" },
    ],
    next: ["rail.dc"],
  },
  {
    key: "rail.dc",
    lane: "rail",
    title: "Issue the Delivery Challan",
    summary: "Hand the LRs over to the truck that does the last-mile delivery.",
    href: "/vp-management/delivery-challans",
    viewPermission: "delivery_challan.view",
    actions: [
      { key: "delivery_challan.create", label: "Create delivery challans" },
      { key: "delivery_challan.issue", label: "Issue delivery challans" },
      { key: "delivery_challan.cancel", label: "Cancel delivery challans" },
    ],
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
    actions: [
      { key: "lorry_receipt.deliver", label: "Mark LRs delivered" },
      {
        key: "lorry_receipt.acknowledge",
        label: "Confirm delivery with the POD",
      },
    ],
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
    actions: [
      { key: "billing.create", label: "Create bills from delivered LRs" },
      { key: "billing.approve", label: "Approve bills" },
      { key: "billing.finalise", label: "Finalise bills" },
      { key: "billing.credit_note_create", label: "Raise credit notes" },
      { key: "billing.cancel", label: "Cancel bills" },
    ],
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
    actions: [
      { key: "receipt.create", label: "Record customer payments" },
      { key: "receipt.approve", label: "Approve receipts" },
      { key: "receipt.cancel", label: "Cancel receipts" },
    ],
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
    actions: [
      { key: "accounts.payment.create", label: "Raise payment slips" },
      { key: "accounts.payment.approve", label: "Approve payment slips" },
      { key: "accounts.payment.disburse", label: "Pay approved slips" },
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
    actions: [
      { key: "ledger.view", label: "Read ledgers" },
      { key: "ledger.voucher_view", label: "See the day book" },
      { key: "ledger.journal_create", label: "Add manual journals" },
      { key: "ledger.manage", label: "Manage the chart of accounts" },
    ],
    next: [],
  },
  {
    key: "workshop.purchase-order",
    lane: "workshop",
    title: "Order spare parts",
    summary:
      "Raise a purchase order on a parts supplier and get it approved before the parts are bought.",
    href: "/workshop/purchase-orders",
    viewPermission: "workshop.po.view",
    actions: [
      { key: "workshop.po.manage", label: "Raise purchase orders for parts" },
      { key: "workshop.po.approve", label: "Approve purchase orders" },
    ],
    next: ["workshop.inward"],
  },
  {
    key: "workshop.inward",
    lane: "workshop",
    title: "Receive parts into stock",
    summary:
      "Book the parts in against the purchase order so the stock count and the part cost are right.",
    href: "/workshop/inward",
    viewPermission: "workshop.inward.view",
    actions: [
      { key: "workshop.inward.manage", label: "Receive parts into stock" },
    ],
    next: ["workshop.job-card", "workshop.replacement"],
  },
  {
    key: "workshop.job-card",
    lane: "workshop",
    title: "Repair on a job card",
    summary:
      "Open a job card for the vehicle, add the parts used and the labour, then finalise it.",
    href: "/workshop/job-cards",
    viewPermission: "workshop.jobcard.view",
    actions: [
      { key: "workshop.jobcard.manage", label: "Open job cards" },
      { key: "workshop.jobcard.finalise", label: "Finalise job cards" },
    ],
    next: ["workshop.service-bill"],
  },
  {
    key: "workshop.service-bill",
    lane: "workshop",
    title: "Outside garage bills",
    summary:
      "Enter the bill from an outside garage for work done there, and pay it.",
    href: "/workshop/service-bills",
    viewPermission: "workshop.servicebill.view",
    actions: [
      { key: "workshop.servicebill.manage", label: "Enter service bills" },
      { key: "workshop.servicebill.pay", label: "Pay service bills" },
    ],
    next: [],
  },
  {
    key: "workshop.replacement",
    lane: "workshop",
    title: "Send a faulty part back",
    summary:
      "Return a part that failed to its supplier and track the replacement or the credit note.",
    href: "/workshop/supplier-replacement",
    viewPermission: "workshop.replacement.view",
    actions: [
      {
        key: "workshop.replacement.manage",
        label: "Send faulty parts back to the supplier",
      },
    ],
    next: [],
  },
  {
    key: "driver.advance",
    lane: "driver",
    title: "Driver advances",
    summary:
      "Money paid to a driver before payday, which is recovered from the next salary run.",
    href: "/accounts/driver-salary-advances",
    viewPermission: "driver_finance.salary_view",
    actions: [
      { key: "driver_finance.advance_manage", label: "Give driver advances" },
    ],
    next: ["driver.salary-run"],
  },
  {
    key: "driver.salary-run",
    lane: "driver",
    title: "Monthly salary run",
    summary:
      "Work out each driver's pay for the month, less the advances already taken, and get it approved.",
    href: "/accounts/driver-salary-runs",
    viewPermission: "driver_finance.salary_view",
    actions: [
      { key: "driver_finance.salary_manage", label: "Prepare salary runs" },
      { key: "driver_finance.salary_approve", label: "Approve salary runs" },
    ],
    next: ["driver.payout"],
  },
  {
    key: "driver.payout",
    lane: "driver",
    title: "Pay the driver",
    summary:
      "Hand over or transfer the approved amount, which posts to the books.",
    href: "/accounts/driver-payments",
    viewPermission: "driver_finance.salary_view",
    actions: [{ key: "driver_finance.pay", label: "Pay drivers" }],
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
    actions: [
      { key: "cashplanning.enter", label: "Enter the day's cash plan" },
      { key: "cashplanning.approve", label: "Approve cash plans" },
      { key: "cashplanning.close", label: "Close the cash day" },
    ],
    next: [],
  },
  {
    key: "admin.access",
    lane: "admin",
    title: "Users, roles and branch access",
    summary:
      "Add people, give them a role, and decide which branches they can see.",
    href: "/settings/access",
    viewPermission: "admin.rbac.manage",
    actions: [
      { key: "admin.rbac.manage", label: "Manage users, roles and access" },
    ],
    next: ["admin.audit"],
  },
  {
    key: "admin.audit",
    lane: "admin",
    title: "Audit log",
    summary:
      "Who changed what, and when. The record you check when a number does not look right.",
    href: "/settings/audit-log",
    viewPermission: "admin.audit_log.view",
    actions: [{ key: "admin.audit_log.view", label: "Read the audit log" }],
    next: [],
  },
  {
    key: "daily.my-work",
    lane: "daily",
    title: "My Work",
    summary:
      "Everything waiting on you, across every module, in one list. Most days start here.",
    href: "/my-work",
    // Open to every signed-in user; the list itself only shows work they
    // already have permission to see.
    viewPermission: null,
    actions: [],
    next: [],
  },
  {
    key: "daily.tracking",
    lane: "daily",
    title: "Vehicle tracking",
    summary:
      "Where the trucks are now, so you can answer a customer without ringing the driver.",
    href: "/tracking",
    viewPermission: "tracking.view",
    actions: [{ key: "tracking.view", label: "See where vehicles are" }],
    next: [],
  },
];

/** Every permission key referenced by a stage — used to find stage owners. */
export const TRAINING_STAGE_PERMISSION_KEYS: readonly PermissionKey[] =
  Array.from(
    new Set(
      TRAINING_STAGES.flatMap((stage) =>
        stage.actions.map((action) => action.key),
      ),
    ),
  );

export const isStageOwned = (
  stage: TrainingStage,
  has: (key: PermissionKey) => boolean,
): boolean => stage.actions.some((action) => has(action.key));

/* ------------------------------------------------------------------ */
/* Tracks (role-based training checklists)                             */
/* ------------------------------------------------------------------ */

export type TrainingTrackKey =
  | "basics"
  | "ops"
  | "branch-manager"
  | "rail"
  | "accounts"
  | "workshop"
  | "auditor"
  | "admin";

/**
 * Proof that a user really did something, checked against the records they
 * created / approved (A6). Each key maps to one read-only lookup on the
 * server (modules/training/training.verifiers.ts).
 */
export type TrainingVerifierKey =
  | "order.created"
  | "order.approved"
  | "lr.created"
  | "lr.finalised"
  | "lr.delivered"
  | "lr.acknowledged"
  | "trip.created"
  | "trip_expense.created"
  | "trip_expense.approved"
  | "journey.closed"
  | "vp_schedule.created"
  | "mrrr.created"
  | "vp_loading.created"
  | "rake.rail_head"
  | "grn.created"
  | "branch_grn.created"
  | "delivery_challan.created"
  | "bill.created"
  | "bill.approved"
  | "bill.finalised"
  | "receipt.created"
  | "payment_slip.created"
  | "payment_slip.approved"
  | "purchase_order.created"
  | "inward.created"
  | "job_card.created"
  | "job_card.finalised"
  | "service_bill.created";

export type TrainingStep = {
  /** Stored in TrainingProgress.stepKey — never rename a shipped key. */
  key: string;
  title: string;
  /** What to do, in one or two short sentences. */
  summary: string;
  /** Screen to open for this step ("Open screen"). */
  href?: string;
  /** Hidden unless the user holds this. Omit for steps everyone can do. */
  requires?: PermissionKey;
  /** Ticked automatically once the user has really done it (A6). */
  verifier?: TrainingVerifierKey;
  /** Ticked as soon as the user opens `href` (for "look at this page" steps). */
  completesOnVisit?: true;
};

export type TrainingTrack = {
  key: TrainingTrackKey;
  title: string;
  description: string;
  /**
   * Required for users holding ANY of these, until an admin assigns tracks to
   * the role explicitly (TrainingRoleTrack). Empty = required for everyone.
   */
  suggestedFor: readonly PermissionKey[];
  steps: readonly TrainingStep[];
};

export const TRAINING_TRACKS: readonly TrainingTrack[] = [
  {
    key: "basics",
    title: "ERP basics",
    description:
      "How to move around the ERP and use the screens every role shares.",
    suggestedFor: [],
    steps: [
      {
        key: "basics.navigation",
        title: "Find your way around",
        summary:
          "Use the menu on the left to open a module. The button at the top left makes the menu smaller or bigger.",
        href: "/dashboard",
      },
      {
        key: "basics.my-role",
        completesOnVisit: true,
        title: "See what your role does",
        summary:
          "Open Training to see which steps of the business are yours and who does the step after you.",
        href: "/training",
      },
      {
        key: "basics.process-map",
        completesOnVisit: true,
        title: "Look at the whole business",
        summary:
          "Open the process map to follow an order from booking all the way to payment.",
        href: "/training/process-map",
      },
      {
        key: "basics.lists",
        title: "Search and filter a list",
        summary:
          "On any list, type in the search box, use the filters, and click a column heading to sort. You can hide columns you don't need.",
      },
      {
        key: "basics.notifications",
        title: "Check your notifications",
        summary:
          "The bell at the top shows alerts meant for you, such as an order waiting for approval.",
        href: "/notifications",
        requires: "notifications.view",
      },
      {
        key: "basics.profile",
        title: "Check your profile",
        summary:
          "Make sure your name, mobile number and notification choices are correct.",
        href: "/settings/profile",
      },
      {
        key: "basics.glossary",
        completesOnVisit: true,
        title: "Learn the common words",
        summary:
          "LR, POD, VP, TBB… the glossary explains the words used across the ERP.",
        href: "/training/glossary",
      },
    ],
  },
  {
    key: "ops",
    title: "Operations: from booking to delivery",
    description: "Book orders, make LRs, plan trips and confirm delivery.",
    suggestedFor: ["order.create", "lorry_receipt.create"],
    steps: [
      {
        key: "ops.masters",
        title: "Check the master data you need",
        summary:
          "An order needs the customer, their locations, a route and a rate in the rate matrix. If one is missing, ask the person who manages masters.",
        href: "/masters/customer",
        requires: "masters.customer.view",
      },
      {
        key: "ops.book-order",
        verifier: "order.created",
        title: "Book an order",
        summary:
          "Click New order, pick the customer, the from and to branch, the pickup date and the number of trucks. Save it to send it for approval.",
        href: "/orders/new",
        requires: "order.create",
      },
      {
        key: "ops.order-status",
        title: "Follow the order's approval",
        summary:
          "The order shows 'Pending approval' until a manager confirms it. Once it says 'Confirmed' you can make the LRs.",
        href: "/orders",
        requires: "order.view",
      },
      {
        key: "ops.create-lr",
        verifier: "lr.created",
        title: "Create the LRs",
        summary:
          "From a confirmed order, create the LR group and one LR for each consignment: consignor, consignee, goods and freight.",
        href: "/lorry-receipts/new",
        requires: "lorry_receipt.create",
      },
      {
        key: "ops.ewaybill",
        title: "Attach the e-way bill",
        summary:
          "Add the e-way bill number the customer gave you, and update Part-B with the vehicle number.",
        href: "/ewaybills",
        requires: "ewaybill.create",
      },
      {
        key: "ops.trip",
        verifier: "trip.created",
        title: "Plan the trip",
        summary:
          "Create a trip, pick the vehicle and driver, and attach the LRs it carries.",
        href: "/trips/new",
        requires: "trip.create",
      },
      {
        key: "ops.expenses",
        verifier: "trip_expense.created",
        title: "Record trip expenses and advances",
        summary:
          "Open the trip and enter diesel, toll and other spends, and any cash given to the driver.",
        href: "/trips",
        requires: "trip_expense.create",
      },
      {
        key: "ops.deliver",
        verifier: "lr.delivered",
        title: "Mark delivery and upload the POD",
        summary:
          "When goods reach the consignee, mark the LR delivered, then upload the signed POD from the Pending POD tab.",
        href: "/lorry-receipts/deliveries",
        requires: "lorry_receipt.deliver",
      },
    ],
  },
  {
    key: "branch-manager",
    title: "Branch Manager: approvals and control",
    description:
      "Approve orders and expenses, close journeys and keep deliveries ready for billing.",
    suggestedFor: ["order.approve"],
    steps: [
      {
        key: "bm.approve-order",
        verifier: "order.approved",
        title: "Approve or reject orders",
        summary:
          "Open an order that is 'Pending approval', check the freight and the contact person, then confirm or reject it.",
        href: "/orders",
        requires: "order.approve",
      },
      {
        key: "bm.finalise-lr",
        verifier: "lr.finalised",
        title: "Check and finalise LRs",
        summary:
          "Review LRs before they are finalised. A finalised LR gets its LR number and can't be freely changed.",
        href: "/lorry-receipts",
        requires: "lorry_receipt.approve",
      },
      {
        key: "bm.trip-expenses",
        verifier: "trip_expense.approved",
        title: "Approve trip expenses",
        summary:
          "Check the expenses entered on a trip and approve the ones that are correct.",
        href: "/trips",
        requires: "trip_expense.approve",
      },
      {
        key: "bm.close-journey",
        verifier: "journey.closed",
        title: "Close the journey and get the Log Slip",
        summary:
          "When the vehicle is back, enter the end kilometres and close the journey. The Log Slip is created straight away, with no waiting.",
        href: "/vehicle-journeys",
        requires: "vehicle_journey.close",
      },
      {
        key: "bm.confirm-delivery",
        verifier: "lr.acknowledged",
        title: "Make sure deliveries have their POD",
        summary:
          "Delivered LRs need the signed POD before Accounts can bill them. Check the Pending POD tab.",
        href: "/lorry-receipts/deliveries",
        requires: "lorry_receipt.acknowledge",
      },
      {
        key: "bm.approve-bills",
        verifier: "bill.approved",
        title: "Approve bills",
        summary:
          "Bills waiting for review are in the Billing Register. Check them and approve.",
        href: "/accounts/bills",
        requires: "billing.approve",
      },
    ],
  },
  {
    key: "rail",
    title: "Rail and VP operations",
    description:
      "Move goods by rake: schedule wagon space, load it and receive it at the other end.",
    suggestedFor: [
      "vp_schedule.create",
      "mrrr.create",
      "vp_loading.create",
      "grn.create",
    ],
    steps: [
      {
        key: "rail.vp-schedule",
        verifier: "vp_schedule.created",
        title: "Schedule the VP",
        summary:
          "Create a VP schedule for the rake and plan which LRs go into each wagon space (VP).",
        href: "/vp-management/vp-schedule/new",
        requires: "vp_schedule.create",
      },
      {
        key: "rail.mrrr",
        verifier: "mrrr.created",
        title: "Enter the MR / RR",
        summary:
          "Type in the Railway Receipt and Money Receipt from the paper copies, against the VP schedule.",
        href: "/vp-management/mrrr/new",
        requires: "mrrr.create",
      },
      {
        key: "rail.vp-loading",
        verifier: "vp_loading.created",
        title: "Record the VP loading",
        summary:
          "Record the goods physically loaded into each wagon, then mark it loaded.",
        href: "/vp-management/vp-loading/new",
        requires: "vp_loading.create",
      },
      {
        key: "rail.rake-rail-head",
        verifier: "rake.rail_head",
        title: "Record the rake at the rail head",
        summary:
          "Enter the rake's times and any demurrage, wharfage or waiver at the rail head.",
        href: "/vp-management/rake-at-rail-head",
        requires: "rake_at_rail_head.create",
      },
      {
        key: "rail.grn-rail-head",
        verifier: "grn.created",
        title: "Enter the GRN at the rail head",
        summary: "Record the goods received at the rail head, then submit it.",
        href: "/vp-management/grn/new",
        requires: "grn.create",
      },
      {
        key: "rail.grn-branch",
        verifier: "branch_grn.created",
        title: "Enter the GRN at the branch",
        summary:
          "When the goods reach the destination branch, record what was received.",
        href: "/vp-management/branch-grn/new",
        requires: "rail_branch_grn.create",
      },
      {
        key: "rail.dc",
        verifier: "delivery_challan.created",
        title: "Issue the Delivery Challan",
        summary:
          "Make one challan for the LRs going out on the same last-mile truck, then issue it.",
        href: "/vp-management/delivery-challans/new",
        requires: "delivery_challan.create",
      },
    ],
  },
  {
    key: "accounts",
    title: "Accounts: from bill to payment",
    description:
      "Bill delivered LRs, record customer payments, pay vendors and read the books.",
    suggestedFor: [
      "billing.create",
      "receipt.create",
      "accounts.payment.create",
      "ledger.journal_create",
    ],
    steps: [
      {
        key: "acc.lr-to-bill",
        verifier: "bill.created",
        title: "Bill delivered LRs",
        summary:
          "Open LR to Bill, choose who pays (consignor or consignee) and the client, tick the LRs and create the bill. GST is worked out for you.",
        href: "/accounts/lr-to-bill",
        requires: "billing.create",
      },
      {
        key: "acc.finalise-bill",
        verifier: "bill.finalised",
        title: "Check and finalise bills",
        summary:
          "In the Billing Register, open a draft bill, check the amounts and finalise it so it gets its bill number.",
        href: "/accounts/bills",
        requires: "billing.finalise",
      },
      {
        key: "acc.receipt",
        verifier: "receipt.created",
        title: "Record a customer payment",
        summary:
          "Enter the amount received and match it to the customer's bills, including any TDS they deducted.",
        href: "/accounts/receipts/new",
        requires: "receipt.create",
      },
      {
        key: "acc.payment-slip",
        verifier: "payment_slip.created",
        title: "Raise a payment slip",
        summary:
          "Create a slip to pay a broker, transporter or labour. It goes for approval before anyone pays it.",
        href: "/accounts/vendor-payments/new",
        requires: "accounts.payment.create",
      },
      {
        key: "acc.approve-slips",
        verifier: "payment_slip.approved",
        title: "Approve payment slips",
        summary: "Check waiting slips and approve the ones that are correct.",
        href: "/accounts/vendor-payments/approvals",
        requires: "accounts.payment.approve",
      },
      {
        key: "acc.disburse",
        title: "Pay approved slips",
        summary: "Record the payment for slips that have been approved.",
        href: "/accounts/vendor-payments/disbursements",
        requires: "accounts.payment.disburse",
      },
      {
        key: "acc.ledger",
        title: "Read a ledger and the day book",
        summary:
          "See every posting for an account, or everything posted on one day.",
        href: "/ledger",
        requires: "ledger.view",
      },
      {
        key: "acc.cash-plan",
        title: "Plan the day's cash",
        summary:
          "Enter today's cash position and planned payments, and send them for approval.",
        href: "/cash-planning",
        requires: "cashplanning.enter",
      },
    ],
  },
  {
    key: "workshop",
    title: "Workshop: repairs and spare parts",
    description:
      "Buy parts, repair vehicles with job cards and settle service bills.",
    suggestedFor: [
      "workshop.po.manage",
      "workshop.inward.manage",
      "workshop.jobcard.manage",
      "workshop.servicebill.manage",
    ],
    steps: [
      {
        key: "ws.purchase-order",
        verifier: "purchase_order.created",
        title: "Raise a purchase order for parts",
        summary: "Order spare parts from a supplier with a purchase order.",
        href: "/workshop/purchase-orders",
        requires: "workshop.po.manage",
      },
      {
        key: "ws.inward",
        verifier: "inward.created",
        title: "Receive parts into stock",
        summary: "When parts arrive, record them so they show in stock.",
        href: "/workshop/inward",
        requires: "workshop.inward.manage",
      },
      {
        key: "ws.job-card",
        verifier: "job_card.created",
        title: "Open a job card for a repair",
        summary:
          "Create a job card for the vehicle and add the work done and parts used.",
        href: "/workshop/job-cards/new",
        requires: "workshop.jobcard.manage",
      },
      {
        key: "ws.finalise-job-card",
        verifier: "job_card.finalised",
        title: "Finalise the job card",
        summary:
          "When the repair is complete, check the job card and finalise it.",
        href: "/workshop/job-cards",
        requires: "workshop.jobcard.finalise",
      },
      {
        key: "ws.service-bill",
        verifier: "service_bill.created",
        title: "Enter service bills",
        summary: "Record bills from outside garages and service providers.",
        href: "/workshop/service-bills",
        requires: "workshop.servicebill.manage",
      },
      {
        key: "ws.replacement",
        title: "Handle supplier replacements",
        summary:
          "Track faulty parts sent back to the supplier for replacement.",
        href: "/workshop/supplier-replacement",
        requires: "workshop.replacement.manage",
      },
    ],
  },
  {
    key: "auditor",
    title: "Finding information",
    description:
      "Look up orders, LRs, bills and ledgers, and see who changed what.",
    suggestedFor: ["admin.audit_log.view"],
    steps: [
      {
        key: "aud.orders",
        title: "Look up an order",
        summary:
          "Search orders by number or customer and open one to see its LRs.",
        href: "/orders",
        requires: "order.view",
      },
      {
        key: "aud.lr",
        title: "Open an LR and its documents",
        summary:
          "Open any LR to see its goods, freight, delivery and attached documents such as the POD.",
        href: "/lorry-receipts",
        requires: "lorry_receipt.view",
      },
      {
        key: "aud.bills",
        title: "Check bills",
        summary: "The Billing Register lists every bill with its status.",
        href: "/accounts/bills",
        requires: "billing.view",
      },
      {
        key: "aud.ledger",
        title: "Read a ledger",
        summary: "See every posting for an account between two dates.",
        href: "/ledger",
        requires: "ledger.view",
      },
      {
        key: "aud.day-book",
        title: "See the day book",
        summary: "See everything posted on a given day.",
        href: "/accounts/day-book",
        requires: "ledger.voucher_view",
      },
      {
        key: "aud.audit-log",
        title: "Check who changed what",
        summary:
          "The audit log records changes to users and roles, and important actions such as closing trips.",
        href: "/settings/audit-log",
        requires: "admin.audit_log.view",
      },
    ],
  },
  {
    key: "admin",
    title: "Administration",
    description: "Add users, set up roles and decide who can see which branch.",
    suggestedFor: ["admin.rbac.manage"],
    steps: [
      {
        key: "admin.users",
        title: "Add and manage users",
        summary: "Create a login for a new employee and give them a role.",
        href: "/settings/users",
        requires: "admin.rbac.manage",
      },
      {
        key: "admin.roles",
        title: "Set up roles",
        summary:
          "A role is a set of permissions. Change a role once and everyone with it gets the change.",
        href: "/settings/roles",
        requires: "admin.rbac.manage",
      },
      {
        key: "admin.access",
        title: "Give branch access",
        summary: "Choose which branches each user can see and work in.",
        href: "/settings/access",
        requires: "admin.rbac.manage",
      },
      {
        key: "admin.notifications",
        title: "Set notification rules",
        summary:
          "Decide who gets told about events like a new order or a late trip.",
        href: "/settings/notifications",
        requires: "notifications.manage_rules",
      },
      {
        key: "admin.audit-log",
        title: "Check the audit log",
        summary: "See who changed users, roles and other important records.",
        href: "/settings/audit-log",
        requires: "admin.audit_log.view",
      },
    ],
  },
];

/** Step key for the one-time first-login welcome (A11). */
export const TRAINING_WELCOME_STEP = "welcome";
