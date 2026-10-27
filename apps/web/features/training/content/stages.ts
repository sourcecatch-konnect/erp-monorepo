import type { TrainingStageKey } from "@skerp/types";

/**
 * Longer, plain-language explanation for each business step, shown when a
 * step is opened on the process map. Typed as a full Record so adding a stage
 * to the catalog without writing its explanation is a compile error.
 *
 * Status names match what the screens show. Keep sentences short.
 */
export type StageContent = {
  explain: string;
  /** What has to exist before this step can be done. */
  needs: string[];
  /** How the document's status moves at this step, in order. */
  statusFlows?: { document: string; steps: string[]; also?: string }[];
  tip?: string;
};

export const STAGE_CONTENT: Record<TrainingStageKey, StageContent> = {
  "setup.masters": {
    explain:
      "Master data is the list of customers, routes, rates, vehicles and drivers that the rest of the ERP picks from. If something is missing here, an order or trip can't be made.",
    needs: ["Nothing. This is where everything starts."],
    tip: "Check that a customer and its rate exist before booking its first order.",
  },
  "booking.order": {
    explain:
      "An order is the customer's request to move goods: from which branch to which branch, when, and by truck or by item. Saving it sends it for approval.",
    needs: [
      "The customer and its pickup and delivery locations",
      "A route between the two branches",
      "A rate for this route in the rate matrix, so the freight can be worked out",
      "The vehicle type, for truck orders",
    ],
    statusFlows: [
      {
        document: "Order",
        steps: [
          "Pending approval",
          "Confirmed",
          "LR created",
          "In progress",
          "Completed",
        ],
        also: "Rejected or Cancelled if it does not go ahead.",
      },
    ],
  },
  "booking.order-approval": {
    explain:
      "A manager checks the order and the freight the system worked out from the rate matrix, adds the contact person, and confirms or rejects it. Only confirmed orders can have LRs.",
    needs: ["An order that is 'Pending approval'"],
    statusFlows: [
      {
        document: "Order",
        steps: ["Pending approval", "Confirmed"],
        also: "or Rejected.",
      },
    ],
  },
  "booking.lr": {
    explain:
      "The LR (Lorry Receipt) is the legal proof that SK accepted the goods. Make one LR per consignment: who sends it, who receives it, the goods and the freight. Finalising gives it its LR number.",
    needs: [
      "A confirmed order",
      "The consignee's name and address",
      "The goods and their quantities",
    ],
    statusFlows: [
      {
        document: "LR",
        steps: ["Draft", "Finalised", "Delivered", "Acknowledged"],
        also: "Cancelled if it was made by mistake.",
      },
    ],
  },
  "booking.ewaybill": {
    explain:
      "The customer makes the e-way bill on the government portal and gives SK the number. You attach it to the LR and update Part-B with the vehicle, and extend it if the truck is late.",
    needs: [
      "The e-way bill number from the customer (needed for goods over ₹50,000)",
      "The vehicle number, for Part-B",
    ],
    statusFlows: [
      {
        document: "E-way bill",
        steps: ["Part-B pending", "Active", "In transit", "Delivered"],
        also: "Expired if its validity runs out, or Cancelled.",
      },
    ],
  },
  "road.trip": {
    explain:
      "A trip puts the LRs on a truck with a driver. Own trucks and hired market trucks both go through a trip, so you always know which vehicle carries which goods.",
    needs: ["Finalised LRs to carry", "A free vehicle and a driver"],
    statusFlows: [
      {
        document: "Trip",
        steps: ["Planned", "In transit", "Closed"],
        also: "Cancelled if the truck does not go.",
      },
    ],
  },
  "road.expenses": {
    explain:
      "While the truck is on the road, diesel, toll and other spends are entered against the trip, along with any cash advance given to the driver. A manager approves them.",
    needs: ["A trip that has started"],
    tip: "Enter expenses as they happen. It makes closing the trip much quicker.",
  },
  "road.close": {
    explain:
      "When the vehicle is back, enter the end kilometres and close the journey. The Log Slip, the official record of the trip with its kilometres and expenses, is ready straight away.",
    needs: [
      "The vehicle has returned",
      "The end kilometre reading",
      "All trip expenses entered",
    ],
    statusFlows: [
      {
        document: "Vehicle journey",
        steps: ["Draft", "Active", "Returned", "Ready for Log Slip", "Settled"],
        also: "Can be Reopened to correct a mistake.",
      },
      {
        document: "Log Slip",
        steps: ["Generated", "Posted to accounts"],
      },
    ],
    tip: "There is no need to wait after closing. The old system needed a 10-minute wait; this one doesn't.",
  },
  "rail.vp-schedule": {
    explain:
      "For long distances, goods go by rake (a full goods train). A VP is one wagon's worth of space on the rake. The VP schedule plans which LRs travel in which VP.",
    needs: [
      "A rake booked with Indian Railways",
      "Finalised LRs going by rail",
    ],
    statusFlows: [
      {
        document: "VP schedule",
        steps: [
          "Draft",
          "Planned",
          "MR/RR created",
          "Loading",
          "Loaded",
          "Verified",
          "Finalised",
        ],
      },
    ],
  },
  "rail.mrrr": {
    explain:
      "The railway gives paper receipts: the RR (Railway Receipt) for each VP and the MR (Money Receipt) for the freight SK paid. Type them in against the VP schedule.",
    needs: ["A VP schedule", "The paper RR and MR from the railway"],
    statusFlows: [{ document: "MR / RR", steps: ["Draft", "Submitted"] }],
  },
  "rail.vp-loading": {
    explain:
      "Record what was physically loaded into each wagon. The ERP warns you if a wagon is loaded over its capacity.",
    needs: ["A VP schedule with its MR / RR", "The goods at the rail head"],
    statusFlows: [{ document: "VP loading", steps: ["Draft", "Loaded"] }],
  },
  "rail.rail-head": {
    explain:
      "Record the rake's times at the rail head with any demurrage (railway charge for holding the rake too long), wharfage or waiver, and the GRN for the goods received there.",
    needs: [
      "The rake's arrival or departure times",
      "The goods received at the rail head",
    ],
    statusFlows: [
      { document: "Rake record", steps: ["Draft", "Submitted"] },
      { document: "GRN at rail head", steps: ["Draft", "Submitted"] },
    ],
  },
  "rail.branch": {
    explain:
      "When the goods reach the destination branch, record the rake there and the GRN for what was actually received, including any shortage.",
    needs: [
      "The rake has reached the destination",
      "The goods unloaded at the branch",
    ],
    statusFlows: [
      { document: "Rake record", steps: ["Draft", "Submitted"] },
      { document: "GRN at branch", steps: ["Draft", "Submitted"] },
    ],
  },
  "rail.dc": {
    explain:
      "A Delivery Challan (DC) hands a group of LRs to the truck that does the last-mile delivery from the railhead. One challan can cover many LRs.",
    needs: [
      "The goods received at the destination (branch GRN)",
      "The broker or truck doing the last-mile delivery",
    ],
    statusFlows: [
      {
        document: "Delivery challan",
        steps: ["Draft", "Issued"],
        also: "Cancelled if made by mistake.",
      },
    ],
  },
  "delivery.deliver": {
    explain:
      "When the goods reach the consignee, mark the LR delivered and note any shortage or damage. Then upload the signed POD (proof of delivery). Accounts can only bill an LR once its delivery is confirmed.",
    needs: [
      "A finalised LR that has reached the consignee",
      "The signed POD to upload",
    ],
    statusFlows: [
      { document: "LR", steps: ["Finalised", "Delivered", "Acknowledged"] },
      {
        document: "LR billing",
        steps: ["Not billable", "Ready to bill", "Billed"],
      },
    ],
  },
  "accounts.bill": {
    explain:
      "Accounts picks who pays (the consignor or the consignee), selects the delivered LRs and creates the bill. The freight comes from the LR and GST is worked out from where the goods went.",
    needs: ["Delivered LRs with their POD", "Who pays: consignor or consignee"],
    statusFlows: [
      {
        document: "Bill",
        steps: [
          "Draft",
          "Pending review",
          "Approved",
          "Finalised",
          "Sent",
          "Partially paid",
          "Paid",
        ],
        also: "Cancelled, or corrected later with a credit note.",
      },
    ],
  },
  "accounts.receipt": {
    explain:
      "When a customer pays, record the amount and match it to their bills. Many customers deduct TDS. Record that too, so the bill shows as fully settled.",
    needs: [
      "Bills sent to the customer",
      "The payment details: amount, date, bank and any TDS",
    ],
    statusFlows: [
      {
        document: "Receipt",
        steps: ["Draft", "Pending approval", "Posted"],
        also: "or Cancelled.",
      },
    ],
  },
  "accounts.vendor-payment": {
    explain:
      "Money going out to brokers, transporters and labour (hamali) goes through a payment slip: someone raises it, a manager approves it, and then it is paid.",
    needs: [
      "Who is being paid",
      "What the payment is for, such as a delivery challan or hamali",
    ],
    statusFlows: [
      {
        document: "Payment slip",
        steps: [
          "Draft",
          "Pending approval",
          "Approved",
          "Partially paid",
          "Paid",
        ],
        also: "or Cancelled.",
      },
    ],
  },
  "accounts.ledger": {
    explain:
      "Every bill, receipt and payment posts entries to the ledgers automatically. The day book shows everything posted on one day. Manual journals are only for corrections.",
    needs: ["Nothing. Entries appear here on their own as work is done."],
  },
  "workshop.purchase-order": {
    explain:
      "When the workshop needs parts, it raises a purchase order on a spare-part supplier. A manager approves it before anything is bought, so spending is agreed up front.",
    needs: [
      "The spare-part supplier",
      "The parts wanted, with quantities",
      "A budget holder who can approve the order",
    ],
    statusFlows: [
      {
        document: "Purchase order",
        steps: [
          "Draft",
          "Approved",
          "Sent",
          "Partially received",
          "Received",
          "Closed",
        ],
      },
    ],
    tip: "Raise one purchase order per supplier, not per vehicle — it makes receiving and paying simpler.",
  },
  "workshop.inward": {
    explain:
      "The parts arrive and are booked in against the purchase order. This is what makes the stock count right and gives every part a cost, which later lands on a job card.",
    needs: [
      "An approved purchase order",
      "The supplier's challan or invoice",
      "The parts physically in hand to count",
    ],
    statusFlows: [{ document: "Spare inward", steps: ["Draft", "Posted"] }],
    tip: "Count before you post. Correcting stock afterwards means a return, not an edit.",
  },
  "workshop.job-card": {
    explain:
      "A job card is one repair on one vehicle. You add the parts taken from stock and the labour done, then finalise it. Finalising takes the parts out of stock and puts the cost against that vehicle.",
    needs: [
      "The vehicle that needs work",
      "The parts in stock, received through inward",
    ],
    statusFlows: [{ document: "Job card", steps: ["Draft", "Finalised"] }],
    tip: "Finalise the job card the day the work is done, so the vehicle's running cost stays true.",
  },
  "workshop.service-bill": {
    explain:
      "Not every repair happens in our own workshop. When an outside garage does the work, their bill is entered here and paid, so the cost still reaches the right vehicle.",
    needs: ["The garage's bill", "The vehicle the work was done on"],
    statusFlows: [{ document: "Service bill", steps: ["Draft", "Posted"] }],
  },
  "workshop.replacement": {
    explain:
      "A part that fails under warranty goes back to the supplier. This tracks what went back and what came in return — a replacement part or a credit note.",
    needs: ["The faulty part and which inward it came from", "The supplier"],
    statusFlows: [
      {
        document: "Supplier replacement",
        steps: ["Sent", "Received", "Closed"],
      },
    ],
  },
  "driver.advance": {
    explain:
      "Drivers often need money before payday — for a trip, or at home. An advance is recorded here and is recovered automatically from the next salary run, so nothing is forgotten.",
    needs: ["The driver", "The amount and how it is paid"],
    tip: "Record the advance the moment the money is handed over. An advance remembered at month-end is an argument.",
  },
  "driver.salary-run": {
    explain:
      "Once a month, the pay for every driver is worked out together: salary and trip earnings, less the advances already taken. A manager approves the run before anyone is paid.",
    needs: [
      "The month's trips closed, so earnings are complete",
      "Every advance for the month recorded",
    ],
    statusFlows: [
      {
        document: "Salary run",
        steps: ["Draft", "Pending approval", "Approved", "Paid"],
      },
    ],
  },
  "driver.payout": {
    explain:
      "The approved amount is handed over or transferred. The payment posts to the books straight away, so the driver's balance and the cash position both move together.",
    needs: ["An approved salary run", "Cash or a bank account to pay from"],
  },
  "admin.access": {
    explain:
      "People, the role each person holds, and the branches each person can see. A role is a set of permissions — change the role once and everyone holding it changes with it.",
    needs: ["Permission to manage roles", "The person's branch and job"],
    tip: "Give the role that matches the job, not the permissions one person asked for. The next joiner inherits it.",
  },
  "admin.audit": {
    explain:
      "Every change in the ERP is recorded: who did it, what changed and when. This is where you look when a number does not match what someone remembers.",
    needs: ["Permission to read the audit log"],
  },
  "daily.my-work": {
    explain:
      "One list of everything waiting on you, pulled from every module — orders to approve, LRs to finalise, bills to raise. It only shows work you already have permission to do.",
    needs: ["Nothing. It fills itself from your role."],
    tip: "Start the day here rather than in each screen; it is the fastest way to see what is blocked on you.",
  },
  "daily.tracking": {
    explain:
      "Where the vehicles are right now, on a map. Enough to answer a customer asking where their goods are without ringing the driver.",
    needs: ["A vehicle on an active journey with tracking fitted"],
  },
  "cash.planning": {
    explain:
      "Each day, the cash position and the payments planned for the day are entered and approved, so everyone knows how much money is available.",
    needs: [
      "Today's bank and cash balances",
      "The payments planned for the day",
    ],
    statusFlows: [{ document: "Cash day", steps: ["Open", "Closed"] }],
  },
};

/** Glossary words used at each step (ids from content/glossary.ts). */
export const STAGE_TERMS: Partial<Record<TrainingStageKey, string[]>> = {
  "setup.masters": ["master-data", "rate-matrix"],
  "booking.order": ["order", "tbb", "to-pay", "rate-matrix"],
  "booking.order-approval": ["rate-matrix"],
  "booking.lr": ["lr", "consignor", "consignee", "fy"],
  "booking.ewaybill": ["ewb", "part-b", "transin"],
  "road.trip": ["market-vehicle"],
  "road.expenses": ["happay"],
  "road.close": ["vehicle-journey", "log-slip"],
  "rail.vp-schedule": ["rake", "vp"],
  "rail.mrrr": ["rr", "mr"],
  "rail.vp-loading": ["vp"],
  "rail.rail-head": ["grn", "dc-wc", "demurrage", "wharfage", "waiver"],
  "rail.branch": ["grn"],
  "rail.dc": ["dc", "ldc", "broker"],
  "delivery.deliver": ["pod", "docket", "detention"],
  "accounts.bill": ["place-of-supply", "gst", "rcm", "gta", "hsn-sac"],
  "accounts.receipt": ["tds"],
  "accounts.vendor-payment": ["broker", "hamali"],
};

/**
 * What a step hands to the next one. "Comes before / comes next" says where a
 * step sits; this says what actually travels between them, which is the part
 * people argue about when something goes wrong. A full Record, so a new stage
 * without an output is a compile error.
 */
export const STAGE_OUTPUT: Record<TrainingStageKey, string> = {
  "setup.masters": "Customer, route, rate and vehicle records",
  "booking.order": "An order waiting for approval",
  "booking.order-approval": "A confirmed order",
  "booking.lr": "A finalised LR with its number",
  "booking.ewaybill": "An LR with a valid e-way bill",
  "road.trip": "A trip with an active vehicle journey",
  "road.expenses": "Diesel, advances and road costs on the journey",
  "road.close": "A posted log slip",
  "rail.vp-schedule": "Booked wagon space (VP) on a rake",
  "rail.mrrr": "The railway receipt (RR) for the consignment",
  "rail.vp-loading": "A loaded wagon, ready to move",
  "rail.rail-head": "A GRN for the goods received at the rail head",
  "rail.branch": "A GRN for the goods received at the branch",
  "rail.dc": "A delivery challan for the broker's leg",
  "delivery.deliver": "A delivered LR with its POD",
  "accounts.bill": "A finalised bill and a posted sales voucher",
  "accounts.receipt": "A receipt allocated against bills",
  "accounts.vendor-payment": "An approved slip and its disbursements",
  "accounts.ledger": "A balanced set of books",
  "workshop.purchase-order": "An approved purchase order",
  "workshop.inward": "Parts in stock, each with a cost",
  "workshop.job-card": "A finalised job card against the vehicle",
  "workshop.service-bill": "A posted service bill",
  "workshop.replacement": "A replacement part or a credit note",
  "driver.advance": "An advance to recover from the next salary run",
  "driver.salary-run": "An approved salary run",
  "driver.payout": "A paid driver and a posted payment",
  "admin.access": "People with the right role and branches",
  "admin.audit": "A record of who changed what",
  "daily.my-work": "A clear list of what is waiting on you",
  "daily.tracking": "An answer to 'where are my goods?'",
  "cash.planning": "An approved cash plan for the day",
};

/**
 * What a person actually does at a step, in order. The explanation says what
 * the step is for; this says what your hands do. A full Record, so a new stage
 * without its actions is a compile error.
 */
export const STAGE_STEPS: Record<
  TrainingStageKey,
  { title: string; detail: string }[]
> = {
  "setup.masters": [
    {
      title: "Add the customer",
      detail: "With its pickup and delivery locations and GST details.",
    },
    {
      title: "Add the route",
      detail: "Between the two branches that will trade.",
    },
    {
      title: "Set the freight rate",
      detail: "In the rate matrix, so orders can price themselves.",
    },
    {
      title: "Add vehicles and drivers",
      detail: "So trips can be planned against real vehicles.",
    },
  ],
  "booking.order": [
    {
      title: "Pick the customer and route",
      detail: "The freight fills in from the rate matrix.",
    },
    {
      title: "Add the goods and the date",
      detail: "By truck for a full load, by item for part loads.",
    },
    {
      title: "Save and send for approval",
      detail: "The order cannot move until a manager confirms it.",
    },
  ],
  "booking.order-approval": [
    {
      title: "Open the waiting order",
      detail: "Check it against the customer's agreement.",
    },
    {
      title: "Check the freight",
      detail:
        "The system worked it out from the rate matrix — confirm it is right.",
    },
    {
      title: "Add the contact person",
      detail: "Who the driver calls at pickup.",
    },
    {
      title: "Confirm or reject",
      detail: "Only a confirmed order can have LRs.",
    },
  ],
  "booking.lr": [
    {
      title: "Choose the confirmed order",
      detail: "One order can become several LRs.",
    },
    {
      title: "Enter consignor and consignee",
      detail: "Who sends the goods, and who receives them.",
    },
    {
      title: "Add goods, vehicle and freight",
      detail: "What travels, on what, and at what price.",
    },
    {
      title: "Check, then finalise",
      detail: "A finalised LR gets its number and cannot be edited.",
    },
  ],
  "booking.ewaybill": [
    {
      title: "Raise it on the GST portal",
      detail: "The e-way bill is created there and recorded here.",
    },
    {
      title: "Link it to the LR",
      detail: "So the goods and the paperwork travel together.",
    },
    {
      title: "Fill Part-B with the vehicle",
      detail: "Update it if the vehicle changes on the way.",
    },
    {
      title: "Watch the validity",
      detail: "Extend before it expires, or the load can be stopped.",
    },
  ],
  "road.trip": [
    {
      title: "Group the LRs going the same way",
      detail: "One trip can carry several LRs.",
    },
    {
      title: "Assign the vehicle and driver",
      detail: "Own truck, or a market vehicle with its hire rate.",
    },
    {
      title: "Start the vehicle journey",
      detail: "Tracking and expenses run from this point.",
    },
  ],
  "road.expenses": [
    {
      title: "Record the diesel",
      detail: "From the pump, against this journey.",
    },
    {
      title: "Enter driver advances",
      detail: "Recovered later from the driver's salary run.",
    },
    {
      title: "Add tolls and other road costs",
      detail: "Everything that belongs to this journey.",
    },
  ],
  "road.close": [
    {
      title: "Mark the journey returned",
      detail: "The vehicle is back and the trip is over.",
    },
    {
      title: "Check every expense is in",
      detail: "Nothing missing, nothing entered twice.",
    },
    {
      title: "Generate the log slip",
      detail: "The summary of what the journey earned and cost.",
    },
    {
      title: "Post it to accounts",
      detail: "The journey's profit lands in the books.",
    },
  ],
  "rail.vp-schedule": [
    {
      title: "Book the rake",
      detail: "Wagon space is reserved with Indian Railways in advance.",
    },
    {
      title: "Plan which LRs go in which VP",
      detail: "One VP is one wagon's worth of space.",
    },
    { title: "Confirm the schedule", detail: "Loading works from this plan." },
  ],
  "rail.mrrr": [
    {
      title: "Collect the paper RR and MR",
      detail: "The railways issue them against the booking.",
    },
    {
      title: "Type in the numbers",
      detail: "Railway receipt, money receipt and the freight paid.",
    },
    {
      title: "Attach them to the VP",
      detail: "So the rail leg has its proof.",
    },
  ],
  "rail.vp-loading": [
    {
      title: "Match the goods to the plan",
      detail: "Check what is at the yard against the VP schedule.",
    },
    {
      title: "Load the wagon",
      detail: "Hamali labour loads it to the wagon's limit.",
    },
    {
      title: "Record what actually went in",
      detail: "The plan and the load are rarely identical.",
    },
  ],
  "rail.rail-head": [
    {
      title: "Receive the rake",
      detail: "At the destination rail head, wagon by wagon.",
    },
    {
      title: "Record railway charges",
      detail: "Demurrage and wharfage, with any waiver claimed.",
    },
    { title: "Make the GRN", detail: "What arrived, and in what condition." },
  ],
  "rail.branch": [
    {
      title: "Receive the goods at the branch",
      detail: "After they come in from the rail head.",
    },
    {
      title: "Check against the rail-head GRN",
      detail: "The two counts must agree.",
    },
    {
      title: "Record shortage or damage",
      detail: "Raised now, not at billing time.",
    },
  ],
  "rail.dc": [
    {
      title: "Pick the LRs for the last leg",
      detail: "The part a broker's vehicle will deliver.",
    },
    {
      title: "Issue the delivery challan",
      detail: "The broker carries it instead of the LR.",
    },
    {
      title: "Track it to delivery",
      detail: "The DC closes when the goods are handed over.",
    },
  ],
  "delivery.deliver": [
    {
      title: "Check the goods against the LR",
      detail: "Count and condition, before handing over.",
    },
    {
      title: "Hand over and take the POD",
      detail: "Signed proof that the consignee received them.",
    },
    {
      title: "Record detention",
      detail: "If the vehicle waited, the customer is charged for it.",
    },
  ],
  "accounts.bill": [
    {
      title: "Pick the delivered LRs",
      detail: "Usually every delivered LR for that customer this period.",
    },
    {
      title: "Check charges and GST",
      detail: "Freight, detention, and the right tax component.",
    },
    {
      title: "Finalise the bill",
      detail: "Finalising posts the sales voucher to the ledger.",
    },
  ],
  "accounts.receipt": [
    {
      title: "Record what came in",
      detail: "Amount, date, and which account it landed in.",
    },
    {
      title: "Allocate it bill by bill",
      detail: "So outstanding-per-bill stays true.",
    },
    {
      title: "Record the TDS",
      detail: "Customers often deduct it — record it, do not chase it.",
    },
  ],
  "accounts.vendor-payment": [
    {
      title: "Build the payment slip",
      detail: "Freight due, less advances and any deductions.",
    },
    {
      title: "Get it approved",
      detail: "Above the threshold, a second person signs off.",
    },
    {
      title: "Disburse",
      detail: "Each payment is its own voucher against the same payable.",
    },
  ],
  "accounts.ledger": [
    {
      title: "Read the day book",
      detail: "Every voucher posted today, in one list.",
    },
    {
      title: "Check a party ledger",
      detail: "What a customer owes, or what we owe a vendor.",
    },
    {
      title: "Post a manual journal",
      detail: "For adjustments nothing else produces.",
    },
  ],
  "workshop.purchase-order": [
    {
      title: "List the parts needed",
      detail: "With quantities, from the spare-part master.",
    },
    {
      title: "Pick the supplier",
      detail: "One order per supplier, not per vehicle.",
    },
    {
      title: "Send it for approval",
      detail: "Nothing is bought before a manager approves.",
    },
  ],
  "workshop.inward": [
    {
      title: "Open the purchase order",
      detail: "Receive against what was ordered.",
    },
    {
      title: "Count what arrived",
      detail: "Short deliveries are recorded now, not later.",
    },
    {
      title: "Post the inward",
      detail: "Stock and part costs update from here.",
    },
  ],
  "workshop.job-card": [
    {
      title: "Open a job card",
      detail: "One card for one repair on one vehicle.",
    },
    {
      title: "Add parts and labour",
      detail: "Parts come out of stock at their real cost.",
    },
    {
      title: "Finalise it",
      detail: "The cost lands against the vehicle's running cost.",
    },
  ],
  "workshop.service-bill": [
    {
      title: "Enter the garage's bill",
      detail: "For work done outside our own workshop.",
    },
    {
      title: "Put it against the vehicle",
      detail: "So the cost reaches the right truck.",
    },
    { title: "Pay it", detail: "The payment posts to the books." },
  ],
  "workshop.replacement": [
    {
      title: "Identify the faulty part",
      detail: "And the inward it originally came in on.",
    },
    {
      title: "Send it back to the supplier",
      detail: "Recorded, so it is not forgotten.",
    },
    {
      title: "Record what came back",
      detail: "A replacement part, or a credit note.",
    },
  ],
  "driver.advance": [
    {
      title: "Pick the driver",
      detail: "And the branch the advance is paid from.",
    },
    {
      title: "Enter the amount",
      detail: "And whether it was cash or a transfer.",
    },
    {
      title: "Save it the same day",
      detail: "An advance remembered at month-end is an argument.",
    },
  ],
  "driver.salary-run": [
    {
      title: "Start the run for the month",
      detail: "Once the month's trips are closed.",
    },
    {
      title: "Check earnings and advances",
      detail: "Pay and trip earnings, less what was already taken.",
    },
    {
      title: "Send it for approval",
      detail: "Nobody is paid from an unapproved run.",
    },
  ],
  "driver.payout": [
    {
      title: "Open the approved run",
      detail: "Only approved runs can be paid.",
    },
    {
      title: "Pay from cash or bank",
      detail: "Choose the account the money leaves.",
    },
    {
      title: "Confirm the payment",
      detail: "The driver's balance and the books move together.",
    },
  ],
  "admin.access": [
    {
      title: "Add the person",
      detail: "Name, email and the branch they work at.",
    },
    {
      title: "Give them a role",
      detail: "The role that matches the job, not one person's request.",
    },
    {
      title: "Choose their branches",
      detail: "Which branches' data they can see.",
    },
  ],
  "admin.audit": [
    {
      title: "Pick the date range",
      detail: "And the screen or record you are asking about.",
    },
    {
      title: "Find the change",
      detail: "What the value was before, and what it became.",
    },
    { title: "See who made it", detail: "The user, and the exact time." },
  ],
  "daily.my-work": [
    {
      title: "Open My Work",
      detail: "It fills itself from your role — nothing to set up.",
    },
    {
      title: "Read what is waiting on you",
      detail: "Grouped by the part of the business it belongs to.",
    },
    {
      title: "Click straight through",
      detail: "Each row opens the screen where the work is done.",
    },
  ],
  "daily.tracking": [
    {
      title: "Find the vehicle",
      detail: "By number, or by the trip it is running.",
    },
    {
      title: "See where it is now",
      detail: "Its last reported position on the map.",
    },
    { title: "Answer the customer", detail: "Without ringing the driver." },
  ],
  "cash.planning": [
    {
      title: "Enter the opening balances",
      detail: "Today's bank and cash position.",
    },
    {
      title: "List the payments planned",
      detail: "What has to go out today.",
    },
    {
      title: "Get it approved and close",
      detail: "Everyone then knows how much is available.",
    },
  ],
};
